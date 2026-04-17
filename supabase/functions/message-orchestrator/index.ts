/**
 * message-orchestrator
 *
 * Centralized WhatsApp dispatcher with cross-module deduplication.
 * All automated sends (auto-notify, financial-notify, future modules) route
 * through here to prevent flooding the same number within the dedup window.
 *
 * Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *       (Edge Function-to-Edge Function calls use the service role JWT)
 *
 * ── Modes ────────────────────────────────────────────────────────────────────
 *
 * mode = 'send' (default)
 *   Check dedup → call UazAPI → log result
 *   Body: { module, template?, priority?, dedup_window_minutes?,
 *           phone, endpoint, payload }
 *   Response: { sent?, skipped?, reason?, wa_message_id?, error? }
 *
 * mode = 'check'
 *   Bulk dedup check without sending (used by batch callers like financial-notify)
 *   Body: { module, priority?, dedup_window_minutes?, phones }
 *   Response: { allowed: string[], blocked: string[] }
 *
 * ── Priority ─────────────────────────────────────────────────────────────────
 *   1 = financial  (highest — bills, overdue notices)
 *   2 = academic   (medium  — attendance, grades, confirmations)
 *   3 = general    (lowest  — marketing, reminders, misc)
 *
 * Dedup rule (v1): any message sent to a phone within the window blocks
 * subsequent messages from ANY module. Priority stored for future queue logic.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function authenticate(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) return false;
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${serviceKey}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PushBlock {
  user_ids: string[];
  notification: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
  };
}

interface SendRequest {
  mode?: "send" | "check";
  module: string;
  template?: string;
  priority?: 1 | 2 | 3;
  dedup_window_minutes?: number;
  // send mode
  phone?: string;
  endpoint?: string;
  payload?: Record<string, unknown>;
  // check mode
  phones?: string[];
  // push fan-out (opcional, paralelo ao WhatsApp — dedup independente)
  push?: PushBlock;
}

interface SendResult {
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  wa_message_id?: string;
  error?: string;
  push_sent?: number;
  push_failed?: number;
  push_revoked?: number;
  push_error?: string;
}

interface CheckResult {
  allowed: string[];
  blocked: string[];
}

// ── Dedup helpers ─────────────────────────────────────────────────────────────

async function isPhoneDeduped(
  service: ReturnType<typeof createClient>,
  phone: string,
  windowMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count } = await service
    .from("whatsapp_send_log")
    .select("*", { count: "exact", head: true })
    .eq("phone", phone)
    .eq("status", "sent")
    .gte("sent_at", since);
  return (count ?? 0) > 0;
}

async function filterDeduped(
  service: ReturnType<typeof createClient>,
  phones: string[],
  windowMinutes: number,
): Promise<{ allowed: string[]; blocked: string[] }> {
  if (phones.length === 0) return { allowed: [], blocked: [] };
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data } = await service
    .from("whatsapp_send_log")
    .select("phone")
    .in("phone", phones)
    .eq("status", "sent")
    .gte("sent_at", since);

  const blockedSet = new Set((data ?? []).map((r: { phone: string }) => r.phone));
  const allowed = phones.filter((p) => !blockedSet.has(p));
  const blocked = phones.filter((p) => blockedSet.has(p));
  return { allowed, blocked };
}

// ── Log helpers ───────────────────────────────────────────────────────────────

async function logSend(
  service: ReturnType<typeof createClient>,
  phone: string,
  module: string,
  template: string | undefined,
  priority: number,
  status: "sent" | "skipped" | "failed",
  opts?: { skip_reason?: string; error_msg?: string },
) {
  await service.from("whatsapp_send_log").insert({
    phone,
    module,
    template: template ?? null,
    priority,
    status,
    skip_reason: opts?.skip_reason ?? null,
    error_msg: opts?.error_msg ?? null,
    sent_at: new Date().toISOString(),
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!authenticate(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const {
    mode = "send",
    module: mod,
    template,
    priority = 3,
    dedup_window_minutes = 30,
  } = body;

  if (!mod) return json({ error: "Missing required field: module" }, 400);

  // ── mode = 'check' ─────────────────────────────────────────────────────────
  if (mode === "check") {
    const { phones } = body;
    if (!phones || !Array.isArray(phones)) {
      return json({ error: "mode='check' requires phones: string[]" }, 400);
    }
    const result: CheckResult = await filterDeduped(service, phones, dedup_window_minutes);
    console.log(
      `[message-orchestrator] check module=${mod} phones=${phones.length} ` +
        `allowed=${result.allowed.length} blocked=${result.blocked.length}`,
    );
    return json(result);
  }

  // ── mode = 'send' ──────────────────────────────────────────────────────────
  const { phone, endpoint, payload } = body;

  if (!phone) return json({ error: "mode='send' requires phone" }, 400);
  if (!endpoint) return json({ error: "mode='send' requires endpoint" }, 400);
  if (!payload) return json({ error: "mode='send' requires payload" }, 400);

  // 1. Dedup check
  const deduped = await isPhoneDeduped(service, phone, dedup_window_minutes);
  if (deduped) {
    await logSend(service, phone, mod, template, priority, "skipped", {
      skip_reason: `dedup_window_${dedup_window_minutes}m`,
    });
    console.log(`[message-orchestrator] SKIPPED (dedup) phone=${phone} module=${mod} template=${template}`);
    return json({ skipped: true, reason: `dedup_window_${dedup_window_minutes}m` } satisfies SendResult);
  }

  // 2. Load WhatsApp credentials
  const { data: waSettings } = await service
    .from("system_settings")
    .select("key, value")
    .eq("category", "whatsapp")
    .in("key", ["instance_url", "api_token"]);

  const waMap: Record<string, string> = {};
  (waSettings ?? []).forEach((s: { key: string; value: unknown }) => {
    waMap[s.key] = typeof s.value === "string" ? s.value : String(s.value);
  });

  if (!waMap.instance_url?.trim() || !waMap.api_token?.trim()) {
    await logSend(service, phone, mod, template, priority, "skipped", {
      skip_reason: "whatsapp_not_configured",
    });
    console.log(`[message-orchestrator] SKIPPED (not configured) module=${mod}`);
    return json({ skipped: true, reason: "whatsapp_not_configured" } satisfies SendResult);
  }

  const instanceUrl = waMap.instance_url.replace(/\/$/, "");
  const apiToken = waMap.api_token;

  // 3. Call UazAPI
  let result: SendResult;
  try {
    const apiRes = await fetch(`${instanceUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: apiToken },
      body: JSON.stringify(payload),
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json().catch(() => ({})) as Record<string, unknown>;
      const waMessageId =
        (apiData?.messageid as string) ??
        (typeof apiData?.id === "string" ? apiData.id.split(":").pop() : undefined);

      await logSend(service, phone, mod, template, priority, "sent");
      result = { sent: true, wa_message_id: waMessageId };
      console.log(
        `[message-orchestrator] SENT phone=${phone} module=${mod} template=${template} endpoint=${endpoint}`,
      );
    } else {
      const errMsg = await apiRes.text().catch(() => "api_error");
      await logSend(service, phone, mod, template, priority, "failed", {
        error_msg: errMsg.slice(0, 500),
      });
      result = { sent: false, error: errMsg };
      console.error(
        `[message-orchestrator] FAILED phone=${phone} module=${mod}: ${errMsg}`,
      );
    }
  } catch (fetchErr) {
    const errMsg = String(fetchErr);
    await logSend(service, phone, mod, template, priority, "failed", {
      error_msg: errMsg,
    });
    result = { sent: false, error: errMsg };
    console.error(`[message-orchestrator] ERROR phone=${phone} module=${mod}:`, fetchErr);
  }

  // 4. Push fan-out (paralelo, independente do resultado do WhatsApp)
  if (body.push && body.push.user_ids?.length && body.push.notification?.title) {
    try {
      const pushUrl = `${SUPABASE_URL}/functions/v1/push-send`;
      const pushRes = await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          user_ids: body.push.user_ids,
          notification: body.push.notification,
        }),
      });
      const pushData = await pushRes.json().catch(() => ({})) as {
        sent?: number; failed?: number; revoked?: number; error?: string;
      };
      result.push_sent = pushData.sent ?? 0;
      result.push_failed = pushData.failed ?? 0;
      result.push_revoked = pushData.revoked ?? 0;
      if (pushData.error) result.push_error = pushData.error;
      console.log(
        `[message-orchestrator] PUSH user_ids=${body.push.user_ids.length} ` +
          `sent=${result.push_sent} failed=${result.push_failed} revoked=${result.push_revoked}`,
      );
    } catch (pushErr) {
      result.push_error = String(pushErr);
      console.error(`[message-orchestrator] PUSH error:`, pushErr);
    }
  }

  return json(result);
});
