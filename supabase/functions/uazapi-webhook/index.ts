/**
 * uazapi-webhook
 * Receives real-time status updates from the WhatsApp API.
 * No JWT — the API calls this endpoint directly.
 * Validates identity via ?secret= URL param against system_settings.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

// WhatsApp / Baileys status code → our status
const WA_STATUS: Record<number, string> = {
  0: "failed",    // ERROR
  1: "queued",    // PENDING
  2: "sent",      // SERVER_ACK
  3: "delivered", // DELIVERY_ACK
  4: "read",      // READ
  5: "read",      // PLAYED (audio/video)
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

    const event = body.event || body.type || "";
    console.log(`[webhook] event=${event}`);

    // messages_update
    if (event === "messages_update") {
      const updates: unknown[] = Array.isArray(body.data) ? body.data : [body.data];

      for (const u of updates) {
        const upd = u as Record<string, unknown>;
        const trackId   = (upd?.trackId || upd?.track_id || "") as string;
        const statusCode = (upd as { update?: { status?: number } })?.update?.status;

        if (!trackId || statusCode === undefined || statusCode === null) continue;

        const newStatus = WA_STATUS[statusCode];
        if (!newStatus) continue;

        const { data: log } = await service
          .from("whatsapp_message_log")
          .select("status")
          .eq("id", trackId)
          .single();

        if (!log) continue;

        const currentIdx = STATUS_ORDER.indexOf(log.status);
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
          .eq("id", trackId);

        console.log(`[webhook] log ${trackId}: ${log.status} → ${newStatus}`);
      }
    }

    // connection_update
    if (event === "connection_update") {
      const data = body.data as Record<string, unknown> || {};
      const connected =
        data.connected === true ||
        data.state === "open" ||
        data.status === "connected";
      const disconnected =
        data.connected === false ||
        data.state === "close" ||
        data.state === "conflict" ||
        data.status === "disconnected";

      if (disconnected) {
        console.log("[webhook] connection_update: DISCONNECTED — notifying admins");

        const { data: admins } = await service
          .from("profiles")
          .select("id")
          .in("role", ["super_admin", "admin"])
          .eq("is_active", true);

        if (admins && admins.length > 0) {
          const notifications = admins.map((p: { id: string }) => ({
            recipient_id: p.id,
            type: "wa_disconnected",
            title: "WhatsApp desconectado",
            body: "A instância WhatsApp foi desconectada. Acesse Configurações para reconectar.",
            link: "/admin/configuracoes",
            related_module: "whatsapp",
          }));
          await service.from("notifications").insert(notifications);
          console.log(`[webhook] notified ${admins.length} admin(s) of disconnection`);
        }
      } else if (connected) {
        console.log("[webhook] connection_update: CONNECTED");
      }
    }

    return new Response("ok", { status: 200, headers: CORS });
  } catch (err) {
    console.error("[webhook] error:", err);
    return new Response("ok", { status: 200, headers: CORS });
  }
});
