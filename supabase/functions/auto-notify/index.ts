/**
 * auto-notify
 *
 * Called by DB triggers (pg_net) and pg_cron when events occur.
 * Finds matching WhatsApp templates, renders variables, and sends messages.
 *
 * No JWT — called from DB triggers via pg_net.
 * Auth via X-Trigger-Secret header matching system_settings.internal.trigger_secret.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-trigger-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function render(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Button/List choice builders (mirrors whatsapp-api.ts logic) ──────────────

interface TemplateButton {
  id: string;
  text: string;
  type: "reply" | "url" | "copy" | "call";
  value: string;
}

function buttonsToChoices(
  buttons: TemplateButton[],
  vars: Record<string, string>,
): string[] {
  return buttons.map((b) => {
    const text = render(b.text, vars);
    const value = render(b.value, vars);
    switch (b.type) {
      case "url":
        return `${text}|${value.startsWith("http") ? value : `https://${value}`}`;
      case "copy":
        return `${text}|copy:${value}`;
      case "call":
        return `${text}|call:${value.startsWith("+") ? value : `+${value}`}`;
      case "reply":
      default:
        return `${text}|${value || render(b.id, vars)}`;
    }
  });
}

interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

function listSectionsToChoices(
  sections: ListSection[],
  vars: Record<string, string>,
): string[] {
  const choices: string[] = [];
  for (const section of sections) {
    choices.push(`[${render(section.title, vars)}]`);
    for (const row of section.rows) {
      const parts = [render(row.title, vars), render(row.id, vars)];
      if (row.description) parts.push(render(row.description, vars));
      choices.push(parts.join("|"));
    }
  }
  return choices;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Accept as-is only if already carries DDI 55 with valid length
  // (12 = fixed line: 55 + DDD2 + 8 digits; 13 = mobile: 55 + DDD2 + 9 digits)
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  return `55${digits}`;
}

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtTime(t: string): string {
  if (!t) return "";
  return t.substring(0, 5);
}

interface TriggerPayload {
  event: "on_create" | "on_status_change" | "on_reminder";
  module: "agendamento" | "matricula" | "contato";
  record_id: string;
  old_status?: string;
  new_status?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Auth: verify trigger secret from DB
    const incomingSecret = req.headers.get("x-trigger-secret") || "";

    const { data: secretRow } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "internal")
      .eq("key", "trigger_secret")
      .single();

    const storedSecret = typeof secretRow?.value === "string"
      ? secretRow.value
      : (secretRow?.value as string) || "";

    if (!storedSecret || incomingSecret !== storedSecret) {
      console.warn("[auto-notify] Invalid or missing trigger secret");
      return json({ error: "Unauthorized" }, 401);
    }

    // Parse payload
    const payload: TriggerPayload = await req.json();
    const { event, module: mod, record_id, old_status, new_status } = payload;

    if (!event || !mod || !record_id) {
      return json({ error: "Missing required fields: event, module, record_id" }, 400);
    }

    console.log(`[auto-notify] event=${event} module=${mod} record=${record_id} status=${old_status}→${new_status}`);

    // Check if auto-notify is enabled
    const moduleNotifKey: Record<string, string> = {
      agendamento: "auto_notify_on_visit",
      matricula: "auto_notify_on_enrollment",
      contato: "auto_notify_on_contact",
    };
    const notifKey = moduleNotifKey[mod];
    if (notifKey) {
      const { data: notifSetting } = await service
        .from("system_settings")
        .select("value")
        .eq("category", "notifications")
        .eq("key", notifKey)
        .single();
      const enabled = notifSetting?.value;
      if (enabled === "false" || enabled === false) {
        console.log(`[auto-notify] Disabled via ${notifKey}`);
        return json({ skipped: true, reason: "disabled_by_settings" });
      }
    }

    // Check if WhatsApp is configured
    const { data: waSettings } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "whatsapp")
      .in("key", ["instance_url", "api_token"]);

    const waMap: Record<string, string> = {};
    (waSettings || []).forEach((s: { key: string; value: unknown }) => {
      waMap[s.key] = typeof s.value === "string" ? s.value : String(s.value);
    });

    if (!waMap.instance_url?.trim() || !waMap.api_token?.trim()) {
      console.log("[auto-notify] WhatsApp not configured, skipping");
      return json({ skipped: true, reason: "whatsapp_not_configured" });
    }

    // Load general settings for template variables
    const { data: generalSettings } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "general");

    const general: Record<string, string> = {};
    (generalSettings || []).forEach((s: { key: string; value: unknown }) => {
      general[s.key] = typeof s.value === "string" ? s.value : String(s.value);
    });

    // Load record data and build variables
    let recipientPhone = "";
    let recipientName = "";
    const vars: Record<string, string> = {
      school_name: general.school_name || "Colégio Batista em Caruaru",
      school_phone: general.phone || "",
      school_address: general.address || "",
      current_date: new Date().toLocaleDateString("pt-BR"),
    };

    if (mod === "agendamento") {
      const { data: rec } = await service
        .from("visit_appointments")
        .select("*")
        .eq("id", record_id)
        .single();
      if (!rec) return json({ skipped: true, reason: "record_not_found" });

      recipientPhone = rec.visitor_phone;
      recipientName = rec.visitor_name;
      const companions = Array.isArray(rec.companions) ? rec.companions : [];
      vars.visitor_name = rec.visitor_name || "Visitante";
      vars.visitor_phone = rec.visitor_phone || "";
      vars.appointment_date = fmtDate(rec.appointment_date) || "a confirmar";
      vars.appointment_time = fmtTime(rec.appointment_time) || "a confirmar";
      vars.visit_reason = rec.visit_reason || "Não informado";
      vars.companions_count = String(companions.length);

    } else if (mod === "matricula") {
      const { data: rec } = await service
        .from("enrollments")
        .select("*")
        .eq("id", record_id)
        .single();
      if (!rec) return json({ skipped: true, reason: "record_not_found" });

      recipientPhone = rec.guardian_phone;
      recipientName = rec.guardian_name;
      vars.guardian_name = rec.guardian_name || "Responsável";
      vars.student_name = rec.student_name || "Aluno";
      vars.enrollment_status = rec.status || "";
      vars.enrollment_number = rec.enrollment_number || "";
      vars.pending_docs = "";

    } else if (mod === "contato") {
      const { data: rec } = await service
        .from("contact_requests")
        .select("*")
        .eq("id", record_id)
        .single();
      if (!rec) return json({ skipped: true, reason: "record_not_found" });

      recipientPhone = rec.phone;
      recipientName = rec.name;
      vars.contact_name = rec.name || "Contato";
      vars.contact_phone = rec.phone || "";
      vars.contact_reason = rec.contact_reason || "Não informado";
      vars.contact_status = rec.status || "";
    } else {
      return json({ skipped: true, reason: "unknown_module" });
    }

    if (!recipientPhone) {
      console.log("[auto-notify] No recipient phone, skipping");
      return json({ skipped: true, reason: "no_phone" });
    }

    // Find matching templates
    const categoryMap: Record<string, string[]> = {
      agendamento: ["agendamento"],
      matricula: ["matricula"],
      contato: ["contato"],
    };

    const { data: templates } = await service
      .from("whatsapp_templates")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_event", event)
      .in("category", categoryMap[mod] || [mod]);

    if (!templates || templates.length === 0) {
      console.log(`[auto-notify] No matching templates for event=${event} module=${mod}`);
      return json({ skipped: true, reason: "no_matching_templates" });
    }

    // Filter by trigger_conditions
    const matchingTemplates = templates.filter((t: Record<string, unknown>) => {
      const cond = t.trigger_conditions as Record<string, unknown> | null;
      if (!cond || Object.keys(cond).length === 0) return true;
      if (cond.module && cond.module !== mod) return false;
      if (cond.status && cond.status !== new_status) return false;
      if (cond.old_status && cond.old_status !== old_status) return false;
      return true;
    });

    if (matchingTemplates.length === 0) {
      console.log(`[auto-notify] Templates found but conditions don't match`);
      return json({ skipped: true, reason: "conditions_not_met" });
    }

    // Send messages
    const results = [];
    const instanceUrl = waMap.instance_url.replace(/\/$/, "");
    const apiToken = waMap.api_token;
    const phone = normalizePhone(recipientPhone);

    for (const tmpl of matchingTemplates) {
      const content = (tmpl.content || {}) as Record<string, unknown>;
      const body = (content.body as string) || "";
      if (!body) continue;

      const msgType = (tmpl.message_type as string) || "text";
      const rendered = render(body, vars);
      const delayMs = (tmpl.trigger_delay_minutes || 0) * 60 * 1000;

      // Create log entry
      const { data: log } = await service
        .from("whatsapp_message_log")
        .insert({
          template_id: tmpl.id,
          recipient_phone: recipientPhone,
          recipient_name: recipientName,
          rendered_content: { body: rendered, type: msgType },
          status: "queued",
          related_module: mod,
          related_record_id: record_id,
          sent_by: null,
        })
        .select("id")
        .single();

      const logId = log?.id || "";

      try {
        // Build payload based on message_type
        let endpoint = "/send/text";
        let sendPayload: Record<string, unknown> = {
          number: phone,
          text: rendered,
          track_id: logId,
          track_source: "colegio-batista",
        };
        if (delayMs > 0) sendPayload.delay = delayMs;

        if (msgType === "media" && content.media_url) {
          endpoint = "/send/media";
          sendPayload = {
            ...sendPayload,
            type: (content.media_type as string) || "image",
            file: content.media_url as string,
            ...(content.doc_name ? { docName: content.doc_name } : {}),
          };
        } else if (msgType === "buttons" && Array.isArray(content.buttons) && content.buttons.length > 0) {
          endpoint = "/send/menu";
          sendPayload = {
            ...sendPayload,
            type: "button",
            choices: buttonsToChoices(content.buttons as TemplateButton[], vars),
            ...(content.footer_text ? { footerText: content.footer_text } : {}),
            ...(content.image_url ? { imageButton: content.image_url } : {}),
          };
        } else if (msgType === "list" && Array.isArray(content.list_sections) && content.list_sections.length > 0) {
          endpoint = "/send/menu";
          sendPayload = {
            ...sendPayload,
            type: "list",
            choices: listSectionsToChoices(content.list_sections as ListSection[], vars),
            listButton: (content.list_button_text as string) || "Ver opções",
            ...(content.footer_text ? { footerText: content.footer_text } : {}),
            ...(content.image_url ? { imageButton: content.image_url } : {}),
          };
        }
        // else: default text payload already set

        const apiRes = await fetch(`${instanceUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: apiToken },
          body: JSON.stringify(sendPayload),
        });

        if (apiRes.ok) {
          const apiData = await apiRes.json().catch(() => ({}));
          const waKeyId = apiData?.messageid ||
            (typeof apiData?.id === "string" ? apiData.id.split(":").pop() : undefined);

          await service
            .from("whatsapp_message_log")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              ...(waKeyId ? { wa_message_id: waKeyId } : {}),
            })
            .eq("id", logId);
          results.push({ template: tmpl.name, type: msgType, status: "sent", logId });
          console.log(`[auto-notify] Sent "${tmpl.name}" (${msgType}) to ${phone} via ${endpoint}`);

          // ── Confirmation tracking: register if buttons template for agendamento ──
          if (mod === "agendamento" && msgType === "buttons" && waKeyId) {
            try {
              const { data: confirmSetting } = await service
                .from("system_settings")
                .select("value")
                .eq("category", "visit")
                .eq("key", "auto_confirm_enabled")
                .maybeSingle();
              const autoConfirmEnabled = confirmSetting?.value === "true" || confirmSetting?.value === true;

              if (autoConfirmEnabled) {
                await service.from("confirmation_tracking").insert({
                  wa_message_id:  waKeyId,
                  appointment_id: record_id,
                  template_id:    tmpl.id,
                  phone:          recipientPhone,
                });
                await service.from("visit_appointments")
                  .update({ confirmation_status: "awaiting" })
                  .eq("id", record_id);
                console.log(`[auto-notify] Created confirmation tracking for appointment=${record_id} wa_msg=${waKeyId}`);
              }
            } catch (ctErr) {
              console.error("[auto-notify] Failed to create confirmation tracking:", ctErr);
            }
          }
        } else {
          const errBody = await apiRes.text().catch(() => "Unknown error");
          await service
            .from("whatsapp_message_log")
            .update({ status: "failed", error_message: errBody })
            .eq("id", logId);
          results.push({ template: tmpl.name, type: msgType, status: "failed", error: errBody });
          console.error(`[auto-notify] Failed "${tmpl.name}" (${msgType}): ${errBody}`);
        }
      } catch (sendErr) {
        await service
          .from("whatsapp_message_log")
          .update({ status: "failed", error_message: String(sendErr) })
          .eq("id", logId);
        results.push({ template: tmpl.name, type: msgType, status: "failed", error: String(sendErr) });
        console.error(`[auto-notify] Error "${tmpl.name}":`, sendErr);
      }
    }

    // Update flags on source record
    if (mod === "agendamento" && results.some((r) => r.status === "sent")) {
      if (event === "on_reminder") {
        await service.from("visit_appointments").update({ reminder_sent: true }).eq("id", record_id);
      } else if (event === "on_create" || (event === "on_status_change" && new_status === "confirmed")) {
        await service.from("visit_appointments").update({ confirmation_sent: true }).eq("id", record_id);
      }
    }

    // Create internal notification for admins on new records
    if (event === "on_create") {
      const typeMap: Record<string, string> = {
        agendamento: "new_appointment",
        matricula: "new_enrollment",
        contato: "new_contact",
      };
      const titleMap: Record<string, string> = {
        agendamento: `Novo agendamento: ${recipientName}`,
        matricula: `Nova pré-matrícula: ${vars.student_name || recipientName}`,
        contato: `Novo contato: ${recipientName}`,
      };
      const linkMap: Record<string, string> = {
        agendamento: "/admin/agendamentos",
        matricula: "/admin/matriculas",
        contato: "/admin/contatos",
      };

      const { data: admins } = await service
        .from("profiles")
        .select("id")
        .in("role", ["super_admin", "admin", "coordinator"])
        .eq("is_active", true);

      if (admins && admins.length > 0) {
        const notifications = admins.map((a: { id: string }) => ({
          recipient_id: a.id,
          type: typeMap[mod] || "status_change",
          title: titleMap[mod] || `Novo registro: ${recipientName}`,
          body: `Confirmação automática enviada via WhatsApp para ${recipientName}.`,
          link: linkMap[mod] || "/admin",
          related_module: mod,
          related_record_id: record_id,
        }));
        await service.from("notifications").insert(notifications);
      }
    }

    return json({ success: true, sent: results.length, results });
  } catch (err) {
    console.error("[auto-notify] error:", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
