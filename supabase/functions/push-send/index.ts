/**
 * push-send — Sprint 13.N.1
 *
 * Envia Web Push notifications assinadas com VAPID para uma ou mais
 * subscriptions registradas em `push_subscriptions`.
 *
 * Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *       (chamada de Edge Function pra Edge Function; frontend nao invoca).
 *
 * ── Body ─────────────────────────────────────────────────────────────────────
 *   {
 *     user_ids?:        string[],          // alvo por auth.users.id
 *     user_type?:       'admin'|'guardian'|'student',  // filtro opcional
 *     subscription_ids?: string[],         // alvo direto (ignora user_ids)
 *     notification: {
 *       title:  string,
 *       body:   string,
 *       url?:   string,   // deep-link ao clicar (default: '/')
 *       tag?:   string,   // agrupa notificacoes do mesmo tipo
 *       icon?:  string,   // URL absoluta opcional
 *       badge?: string,
 *     }
 *   }
 *
 * ── Retorno ──────────────────────────────────────────────────────────────────
 *   { sent: number, failed: number, revoked: number, errors?: string[] }
 *
 * Subscriptions que retornam 404/410 sao automaticamente marcadas como
 * `revoked_at = now()` — o navegador ja invalidou a credencial.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

interface PushRequest {
  user_ids?: string[];
  user_type?: 'admin' | 'guardian' | 'student';
  subscription_ids?: string[];
  notification: PushPayload;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT     = Deno.env.get("VAPID_SUBJECT");
  const SUPABASE_URL      = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return json({ error: "VAPID_PRIVATE_KEY / VAPID_SUBJECT secrets missing" }, 500);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "Supabase env missing" }, 500);
  }

  let body: PushRequest;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if (!body?.notification?.title || !body?.notification?.body) {
    return json({ error: "notification.title and notification.body required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Load VAPID public key from system_settings
  const { data: pubKeyRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("category", "push")
    .eq("key", "vapid_public_key")
    .maybeSingle();
  const VAPID_PUBLIC_KEY = typeof pubKeyRow?.value === "string"
    ? pubKeyRow.value
    : String(pubKeyRow?.value ?? "").replace(/^"|"$/g, "");
  if (!VAPID_PUBLIC_KEY) {
    return json({ error: "vapid_public_key not configured in system_settings" }, 500);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // Resolve target subscriptions
  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .is("revoked_at", null);

  if (body.subscription_ids?.length) {
    query = query.in("id", body.subscription_ids);
  } else if (body.user_ids?.length) {
    query = query.in("user_id", body.user_ids);
    if (body.user_type) query = query.eq("user_type", body.user_type);
  } else {
    return json({ error: "user_ids or subscription_ids required" }, 400);
  }

  const { data: subs, error: subsErr } = await query;
  if (subsErr) return json({ error: subsErr.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, failed: 0, revoked: 0 });

  const payloadStr = JSON.stringify(body.notification);

  let sent = 0, failed = 0, revoked = 0;
  const errors: string[] = [];
  const revokedIds: string[] = [];
  const seenIds: string[] = [];

  await Promise.all((subs as SubscriptionRow[]).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payloadStr,
        { TTL: 60 * 60 * 24, urgency: "normal" },
      );
      sent++;
      seenIds.push(s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        revokedIds.push(s.id);
        revoked++;
      } else {
        failed++;
        errors.push(`${s.endpoint.slice(0, 40)}... → ${(err as Error).message}`);
      }
    }
  }));

  if (revokedIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .in("id", revokedIds);
  }
  if (seenIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_seen_at: new Date().toISOString() })
      .in("id", seenIds);
  }

  return json({ sent, failed, revoked, ...(errors.length > 0 ? { errors } : {}) });
});
