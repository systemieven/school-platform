/**
 * uazapi-webhook
 * Receives real-time status updates from the WhatsApp API (ibotcloud / UazAPI GO format).
 * No JWT — the API calls this endpoint directly.
 * Validates identity via ?secret= URL param against system_settings.
 *
 * ibotcloud payload shape for messages_update:
 * {
 *   EventType: "messages_update",
 *   event: { MessageIDs: ["3EB0..."], Type: "Delivered"|"Read"|"Sent"|..., Chat, Sender, ... },
 *   state: "Delivered"|"Read"|"Sent"|...,
 *   owner: "...",
 *   ...
 * }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

// ibotcloud string state → our DB status
const STATE_MAP: Record<string, string> = {
  "Delivered": "delivered",
  "Read":      "read",
  "Sent":      "sent",
  "ServerAck": "sent",
  "Error":     "failed",
  "Pending":   "queued",
};

// Legacy Baileys numeric code → our status (kept for fallback compatibility)
const WA_STATUS: Record<number, string> = {
  0: "failed",
  1: "queued",
  2: "sent",
  3: "delivered",
  4: "read",
  5: "read",
};

// Status progression order (index = priority)
const STATUS_ORDER = ["failed", "queued", "sent", "delivered", "read"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Validate webhook secret
    const url            = new URL(req.url);
    const urlSecret      = url.searchParams.get("secret");
    const headerSecret   = req.headers.get("x-webhook-secret");
    const incomingSecret = urlSecret || headerSecret || "";

    const { data: secretRow } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "whatsapp")
      .eq("key", "webhook_secret")
      .single();

    const storedSecret = typeof secretRow?.value === "string" ? secretRow.value.trim() : "";

    if (storedSecret && incomingSecret !== storedSecret) {
      console.warn("[webhook] Invalid secret");
      return new Response("ok", { status: 200, headers: CORS });
    }

    // Parse body
    const body = await req.json().catch(() => null);
    if (!body) return new Response("ok", { status: 200, headers: CORS });

    // ── Detect event type ──────────────────────────────────────────────────────
    // ibotcloud: body.EventType = "messages_update", body.event = {...object...}
    // Baileys standard: body.event = "messages_update" (string)
    const eventType: string = typeof body.event === "string"
      ? (body.event as string)
      : ((body.EventType as string) || (body.type as string) || "");

    console.log(`[webhook] eventType=${eventType} payload=${JSON.stringify(body).slice(0, 600)}`);

    // ── messages_update ────────────────────────────────────────────────────────
    if (eventType === "messages_update") {
      const isIbotcloud = typeof body.event === "object" && body.event !== null;

      if (isIbotcloud) {
        // ── ibotcloud / UazAPI GO format ──────────────────────────────────────
        const evtData   = body.event as Record<string, unknown>;
        const msgIds    = (Array.isArray(evtData.MessageIDs) ? evtData.MessageIDs : []) as string[];
        const stateStr  = ((body.state as string) || (evtData.Type as string) || "").trim();
        const newStatus = STATE_MAP[stateStr];

        console.log(`[webhook] ibotcloud: state=${stateStr} ids=${JSON.stringify(msgIds)}`);

        if (!newStatus) {
          console.log(`[webhook] ibotcloud: unknown state="${stateStr}" — skipping`);
        } else {
          for (const waKeyId of msgIds) {
            if (!waKeyId) continue;

            // Match by wa_message_id
            let logId: string | null = null;
            let currentStatus: string | null = null;

            const { data: row } = await service
              .from("whatsapp_message_log")
              .select("id, status")
              .eq("wa_message_id", waKeyId)
              .maybeSingle();
            if (row) { logId = row.id; currentStatus = row.status; }

            // DEBUG: record for inspection
            await service.from("_webhook_debug").insert({
              event:       eventType,
              wa_key_id:   waKeyId,
              track_id:    "",
              status_code: null,
              raw_update:  evtData,
            }).then(() => {}).catch(() => {});

            if (!logId || !currentStatus) {
              console.log(`[webhook] ibotcloud: no log for waKeyId=${waKeyId}`);
              continue;
            }

            const currentIdx = STATUS_ORDER.indexOf(currentStatus);
            const newIdx     = STATUS_ORDER.indexOf(newStatus);
            if (newStatus !== "failed" && newIdx <= currentIdx) {
              console.log(`[webhook] ibotcloud: skip ${currentStatus} → ${newStatus} (no upgrade)`);
              continue;
            }

            await service
              .from("whatsapp_message_log")
              .update({
                status: newStatus,
                ...(newStatus === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
                ...(newStatus === "read"      ? { read_at:      new Date().toISOString() } : {}),
              })
              .eq("id", logId);

            console.log(`[webhook] ibotcloud: updated ${logId}: ${currentStatus} → ${newStatus}`);
          }
        }

      } else {
        // ── Legacy Baileys standard format ────────────────────────────────────
        // { event: "messages_update", data: [{ key: { id }, update: { status: N } }] }
        const updates: unknown[] = Array.isArray(body.data) ? body.data : [body.data];

        for (const u of updates) {
          const upd        = u as Record<string, unknown>;
          const key        = upd?.key as Record<string, unknown> | undefined;
          const waKeyId    = (key?.id || "") as string;
          const trackId    = (upd?.trackId || upd?.track_id || "") as string;
          const statusCode = (upd as { update?: { status?: number } })?.update?.status;

          console.log(`[webhook] baileys update: waKeyId=${waKeyId} trackId=${trackId} status=${statusCode}`);

          if (statusCode === undefined || statusCode === null) continue;
          const newStatus = WA_STATUS[statusCode];
          if (!newStatus) continue;

          let logId: string | null = null;
          let currentStatus: string | null = null;

          if (waKeyId) {
            const { data: row } = await service
              .from("whatsapp_message_log")
              .select("id, status")
              .eq("wa_message_id", waKeyId)
              .maybeSingle();
            if (row) { logId = row.id; currentStatus = row.status; }
          }

          if (!logId && trackId) {
            const { data: row } = await service
              .from("whatsapp_message_log")
              .select("id, status")
              .eq("id", trackId)
              .maybeSingle();
            if (row) { logId = row.id; currentStatus = row.status; }
          }

          // DEBUG
          await service.from("_webhook_debug").insert({
            event:       eventType,
            wa_key_id:   waKeyId,
            track_id:    trackId,
            status_code: statusCode,
            raw_update:  upd,
          }).then(() => {}).catch(() => {});

          if (!logId || !currentStatus) {
            console.log(`[webhook] baileys: no log for waKeyId=${waKeyId} trackId=${trackId}`);
            continue;
          }

          const currentIdx = STATUS_ORDER.indexOf(currentStatus);
          const newIdx     = STATUS_ORDER.indexOf(newStatus);
          if (newStatus !== "failed" && newIdx <= currentIdx) continue;

          await service
            .from("whatsapp_message_log")
            .update({
              status: newStatus,
              ...(newStatus === "sent"      ? { sent_at:      new Date().toISOString() } : {}),
              ...(newStatus === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
              ...(newStatus === "read"      ? { read_at:      new Date().toISOString() } : {}),
            })
            .eq("id", logId);

          console.log(`[webhook] baileys: updated ${logId}: ${currentStatus} → ${newStatus}`);
        }
      }
    }

    // ── connection (ibotcloud) / connection_update (Baileys legacy) ───────────
    // ibotcloud payload:
    //   { EventType: "connection", instance: { status: "disconnected"|"connected", lastDisconnectReason: "..." }, type: "LoggedOut"|... }
    if (eventType === "connection" || eventType === "connection_update") {
      // ibotcloud fields
      const instance   = body.instance as Record<string, unknown> | undefined;
      const instStatus = ((instance?.status as string) || "").toLowerCase();
      const bodyType   = ((body.type   as string) || "").toLowerCase();

      // Baileys legacy fields
      const legacyData = (typeof body.event === "object" ? body.event : body.data) as Record<string, unknown> | undefined || {};

      const connected =
        instStatus === "connected" ||
        instStatus === "open"      ||
        legacyData.connected === true ||
        legacyData.state     === "open" ||
        legacyData.status    === "connected" ||
        (body.state as string) === "open" ||
        (body.state as string) === "connected";

      const disconnected =
        instStatus === "disconnected" ||
        bodyType   === "loggedout"    ||
        bodyType   === "logged_out"   ||
        legacyData.connected === false  ||
        legacyData.state     === "close" ||
        legacyData.state     === "conflict" ||
        legacyData.status    === "disconnected" ||
        (body.state as string) === "close" ||
        (body.state as string) === "disconnected";

      console.log(`[webhook] connection: instStatus=${instStatus} bodyType=${bodyType} disconnected=${disconnected} connected=${connected}`);

      if (disconnected) {
        // ── Check notify_wa_connection toggle ──────────────────────────────
        const { data: notifRow } = await service
          .from("system_settings")
          .select("value")
          .eq("category", "notifications")
          .eq("key", "notify_wa_connection")
          .single();

        const shouldNotify =
          notifRow?.value === true   ||
          notifRow?.value === 1      ||
          notifRow?.value === "true" ||
          notifRow?.value === "1";

        if (!shouldNotify) {
          console.log("[webhook] connection: DISCONNECTED but notify_wa_connection is off — skipping");
        } else {
          console.log("[webhook] connection: DISCONNECTED — notifying admins");

          const disconnectReason = (instance?.lastDisconnectReason as string | undefined) || "";

          const { data: admins } = await service
            .from("profiles")
            .select("id")
            .in("role", ["super_admin", "admin"])
            .eq("is_active", true);

          if (admins && admins.length > 0) {
            const notifications = admins.map((p: { id: string }) => ({
              recipient_id:   p.id,
              type:           "wa_disconnected",
              title:          "WhatsApp desconectado",
              body:           disconnectReason
                ? `A instância foi desconectada: ${disconnectReason}`
                : "A instância WhatsApp foi desconectada. Acesse Configurações para reconectar.",
              link:           "/admin/configuracoes",
              related_module: "whatsapp",
            }));
            await service.from("notifications").insert(notifications);
            console.log(`[webhook] connection: notified ${admins.length} admin(s)`);
          }
        }
      } else if (connected) {
        console.log("[webhook] connection: CONNECTED");
      }
    }

    return new Response("ok", { status: 200, headers: CORS });
  } catch (err) {
    console.error("[webhook] error:", err);
    return new Response("ok", { status: 200, headers: CORS });
  }
});
