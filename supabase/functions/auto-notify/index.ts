/**
 * auto-notify
 *
 * Called by DB triggers (pg_net) and pg_cron when events occur.
 * Finds matching WhatsApp templates, renders variables, and sends messages
 * via message-orchestrator (handles cross-module dedup + UazAPI dispatch).
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

// ── Button/List choice builders ───────────────────────────────────────────────

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

// ── Orchestrator helper ───────────────────────────────────────────────────────

interface OrchestratorResult {
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

interface PushBlock {
  user_ids: string[];
  notification: { title: string; body: string; url?: string; tag?: string };
}

async function sendViaOrchestrator(params: {
  module: string;
  template: string;
  priority: 1 | 2 | 3;
  phone: string;
  endpoint: string;
  payload: Record<string, unknown>;
  push?: PushBlock;
}): Promise<OrchestratorResult> {
  try {
    const orchUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/message-orchestrator`;
    const res = await fetch(orchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ mode: "send", ...params }),
    });
    return (await res.json().catch(() => ({ error: "parse_error" }))) as OrchestratorResult;
  } catch (e) {
    return { error: String(e) };
  }
}

// ── Trigger payload ───────────────────────────────────────────────────────────

interface TriggerPayload {
  event: "on_create" | "on_status_change" | "on_reminder";
  module: "agendamento" | "matricula" | "contato";
  record_id: string;
  old_status?: string;
  new_status?: string;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const incomingSecret = req.headers.get("x-trigger-secret") || "";

    const { data: secretRow } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "internal")
      .eq("key", "trigger_secret")
      .single();

    const storedSecret =
      typeof secretRow?.value === "string"
        ? secretRow.value
        : (secretRow?.value as string) || "";

    if (!storedSecret || incomingSecret !== storedSecret) {
      console.warn("[auto-notify] Invalid or missing trigger secret");
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Parse payload ─────────────────────────────────────────────────────────
    const payload: TriggerPayload = await req.json();
    const { event, module: mod, record_id, old_status, new_status } = payload;

    if (!event || !mod || !record_id) {
      return json({ error: "Missing required fields: event, module, record_id" }, 400);
    }

    console.log(
      `[auto-notify] event=${event} module=${mod} record=${record_id} status=${old_status}→${new_status}`,
    );

    // ── Check module-level on/off toggle ──────────────────────────────────────
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

    // ── Quick check: WhatsApp configured? (guard before loading record) ───────
    const { data: waCheck } = await service
      .from("system_settings")
      .select("value")
      .eq("category", "whatsapp")
      .eq("key", "instance_url")
      .maybeSingle();

    if (!waCheck?.value || !String(waCheck.value).trim()) {
      console.log("[auto-notify] WhatsApp not configured, skipping");
      return json({ skipped: true, reason: "whatsapp_not_configured" });
    }

    // ── Load general settings for template variables ───────────────────────────
    const { data: generalSettings } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "general");

    const general: Record<string, string> = {};
    (generalSettings || []).forEach((s: { key: string; value: unknown }) => {
      general[s.key] = typeof s.value === "string" ? s.value : String(s.value);
    });

    // ── Load record + build vars ───────────────────────────────────────────────
    let recipientPhone = "";
    let recipientName = "";
    let recordVisitReason = "";
    const vars: Record<string, string> = {
      school_name: general.school_name || "Colégio",
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
      recordVisitReason = rec.visit_reason || "";
      const companions = Array.isArray(rec.companions) ? rec.companions : [];

      let visitReasonLabel = "sua visita";
      if (rec.visit_reason) {
        const { data: reasonsRow } = await service
          .from("system_settings")
          .select("value")
          .eq("category", "visit")
          .eq("key", "reasons")
          .maybeSingle();
        const rawReasons = reasonsRow?.value;
        const reasonsList = Array.isArray(rawReasons)
          ? rawReasons
          : typeof rawReasons === "string"
            ? (() => { try { return JSON.parse(rawReasons); } catch { return []; } })()
            : [];
        const match = (reasonsList as Array<Record<string, unknown>>).find(
          (r) => r && r.key === rec.visit_reason,
        );
        if (match?.label) {
          visitReasonLabel = String(match.label);
        } else {
          const raw = String(rec.visit_reason).trim();
          const looksLikeSlug = /[_-]/.test(raw) || raw === raw.toLowerCase();
          if (raw && !looksLikeSlug) visitReasonLabel = raw;
        }
      }

      vars.visitor_name = rec.visitor_name || "Visitante";
      vars.visitor_phone = rec.visitor_phone || "";
      vars.appointment_date = fmtDate(rec.appointment_date) || "a confirmar";
      vars.appointment_time = fmtTime(rec.appointment_time) || "a confirmar";
      vars.visit_reason = visitReasonLabel;
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

    // ── Find matching templates ────────────────────────────────────────────────
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

    // ── Filter by trigger_conditions ──────────────────────────────────────────
    const moduleAliases: Record<string, string[]> = {
      agendamento: ["agendamento", "appointment"],
      matricula: ["matricula", "enrollment"],
      contato: ["contato", "contact"],
    };
    const validModuleNames = moduleAliases[mod] || [mod];

    const matchingTemplates = templates.filter((t: Record<string, unknown>) => {
      const cond = t.trigger_conditions as Record<string, unknown> | null;
      if (!cond || Object.keys(cond).length === 0) return true;
      if (cond.module && !validModuleNames.includes(cond.module as string)) return false;
      if (cond.status && cond.status !== new_status) return false;
      if (cond.old_status && cond.old_status !== old_status) return false;
      if (
        cond.visit_reason &&
        mod === "agendamento" &&
        cond.visit_reason !== recordVisitReason
      )
        return false;
      return true;
    });

    if (matchingTemplates.length === 0) {
      console.log(`[auto-notify] Templates found but conditions don't match`);
      return json({ skipped: true, reason: "conditions_not_met" });
    }

    // Prefer specific visit_reason templates over generic ones
    if (mod === "agendamento" && recordVisitReason) {
      const hasSpecific = matchingTemplates.some((t: Record<string, unknown>) => {
        const cond = t.trigger_conditions as Record<string, unknown> | null;
        return cond && cond.visit_reason === recordVisitReason;
      });
      if (hasSpecific) {
        const filtered = matchingTemplates.filter((t: Record<string, unknown>) => {
          const cond = t.trigger_conditions as Record<string, unknown> | null;
          return cond && cond.visit_reason === recordVisitReason;
        });
        matchingTemplates.length = 0;
        matchingTemplates.push(...filtered);
        console.log(
          `[auto-notify] Using ${matchingTemplates.length} visit_reason-specific template(s), generics skipped`,
        );
      }
    }

    // ── Priority by module ────────────────────────────────────────────────────
    const modulePriority: Record<string, 1 | 2 | 3> = {
      agendamento: 2,
      matricula: 2,
      contato: 3,
    };
    const msgPriority: 1 | 2 | 3 = modulePriority[mod] ?? 3;

    // ── Send each matching template via orchestrator ───────────────────────────
    const results = [];
    const phone = normalizePhone(recipientPhone);

    // Resolve destinatarios de push a partir do telefone (guardian_profiles).
    // Tentativa exata, depois so digitos (caso haja mascaras salvas no DB).
    const phoneDigits = recipientPhone.replace(/\D/g, "");
    const pushUserIds: string[] = [];
    try {
      const { data: gpRows } = await service
        .from("guardian_profiles")
        .select("id, phone")
        .or(`phone.eq.${recipientPhone},phone.eq.${phoneDigits}`);
      for (const row of gpRows ?? []) {
        const digits = String((row as { phone?: string }).phone ?? "").replace(/\D/g, "");
        if (digits && (digits === phoneDigits || digits.endsWith(phoneDigits) || phoneDigits.endsWith(digits))) {
          pushUserIds.push((row as { id: string }).id);
        }
      }
    } catch (e) {
      console.log(`[auto-notify] push user_id resolution failed: ${String(e)}`);
    }

    for (const tmpl of matchingTemplates) {
      const content = (tmpl.content || {}) as Record<string, unknown>;
      const body = (content.body as string) || "";
      if (!body) continue;

      const msgType = (tmpl.message_type as string) || "text";
      const rendered = render(body, vars);
      const delayMs = (tmpl.trigger_delay_minutes || 0) * 60 * 1000;

      // Create message log entry (for admin UI tracking)
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

      // Build UazAPI payload
      let endpoint = "/send/text";
      let sendPayload: Record<string, unknown> = {
        number: phone,
        text: rendered,
        track_id: logId,
        track_source: "school-platform",
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
      } else if (
        msgType === "buttons" &&
        Array.isArray(content.buttons) &&
        content.buttons.length > 0
      ) {
        endpoint = "/send/menu";
        sendPayload = {
          ...sendPayload,
          type: "button",
          choices: buttonsToChoices(content.buttons as TemplateButton[], vars),
          ...(content.footer_text ? { footerText: content.footer_text } : {}),
          ...(content.image_url ? { imageButton: content.image_url } : {}),
        };
      } else if (
        msgType === "list" &&
        Array.isArray(content.list_sections) &&
        content.list_sections.length > 0
      ) {
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

      // Push fan-out (opcional, quando o template tem send_push=true
      // e conseguimos resolver pelo menos um user_id a partir do telefone).
      const sendPush = (tmpl.send_push as boolean | null) !== false;
      const push: PushBlock | undefined =
        sendPush && pushUserIds.length > 0
          ? {
              user_ids: pushUserIds,
              notification: {
                title: (general.school_short_name || general.school_name || "Aviso"),
                body: rendered.slice(0, 200),
                url: "/",
                tag: `auto-notify-${mod}-${tmpl.id}`,
              },
            }
          : undefined;

      // ── Dispatch via MessageOrchestrator ──────────────────────────────────
      const orchResult = await sendViaOrchestrator({
        module: `auto-notify/${mod}`,
        template: tmpl.name as string,
        priority: msgPriority,
        phone,
        endpoint,
        payload: sendPayload,
        push,
      });

      if (orchResult.sent) {
        const waKeyId = orchResult.wa_message_id;
        await service
          .from("whatsapp_message_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            ...(waKeyId ? { wa_message_id: waKeyId } : {}),
          })
          .eq("id", logId);
        results.push({ template: tmpl.name, type: msgType, status: "sent", logId });
        console.log(
          `[auto-notify] Sent "${tmpl.name}" (${msgType}) to ${phone} via orchestrator`,
        );

        // ── Confirmation tracking for agendamento buttons ──────────────────
        if (mod === "agendamento" && msgType === "buttons" && waKeyId) {
          try {
            const { data: autoConfirmRows } = await service
              .from("system_settings")
              .select("key, value")
              .eq("category", "visit")
              .in("key", [
                "auto_confirm_enabled",
                "auto_confirm_positive_ids",
                "auto_confirm_negative_ids",
              ]);

            const acMap: Record<string, unknown> = {};
            (autoConfirmRows || []).forEach((r: { key: string; value: unknown }) => {
              acMap[r.key] = r.value;
            });

            const autoConfirmEnabled =
              acMap.auto_confirm_enabled === true ||
              acMap.auto_confirm_enabled === "true";

            const parseIdList = (raw: unknown, fallback: string[]): string[] => {
              if (Array.isArray(raw)) return raw.map((x) => String(x));
              if (typeof raw === "string") {
                try {
                  const parsed = JSON.parse(raw);
                  return Array.isArray(parsed) ? parsed.map((x) => String(x)) : fallback;
                } catch {
                  return fallback;
                }
              }
              return fallback;
            };
            const positiveIds = parseIdList(
              acMap.auto_confirm_positive_ids,
              ["sim", "confirmar", "yes"],
            ).map((s) => s.toLowerCase().trim());
            const negativeIds = parseIdList(
              acMap.auto_confirm_negative_ids,
              ["nao", "cancelar", "no"],
            ).map((s) => s.toLowerCase().trim());

            const tmplButtons = Array.isArray(content.buttons)
              ? (content.buttons as TemplateButton[])
              : [];
            const hasConfirmationButton = tmplButtons.some((b) => {
              if (!b || b.type !== "reply") return false;
              const v = String(b.value || b.id || "").toLowerCase().trim();
              return v !== "" && (positiveIds.includes(v) || negativeIds.includes(v));
            });

            if (autoConfirmEnabled && hasConfirmationButton) {
              await service.from("confirmation_tracking").insert({
                wa_message_id: waKeyId,
                appointment_id: record_id,
                template_id: tmpl.id,
                phone: recipientPhone,
                delay_minutes: tmpl.trigger_delay_minutes || 0,
              });
              await service
                .from("visit_appointments")
                .update({ confirmation_status: "awaiting" })
                .eq("id", record_id);
              console.log(
                `[auto-notify] Created confirmation tracking appointment=${record_id} wa_msg=${waKeyId}`,
              );
            } else if (autoConfirmEnabled) {
              console.log(
                `[auto-notify] Skip tracking for "${tmpl.name}": no reply button matches confirm IDs`,
              );
            }
          } catch (ctErr) {
            console.error("[auto-notify] Failed to create confirmation tracking:", ctErr);
          }
        }
      } else if (orchResult.skipped) {
        await service
          .from("whatsapp_message_log")
          .update({ status: "skipped", error_message: `dedup: ${orchResult.reason}` })
          .eq("id", logId);
        results.push({
          template: tmpl.name,
          type: msgType,
          status: "skipped",
          reason: orchResult.reason,
        });
        console.log(`[auto-notify] Skipped "${tmpl.name}" (dedup: ${orchResult.reason})`);
      } else {
        const errMsg = orchResult.error || "unknown_error";
        await service
          .from("whatsapp_message_log")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", logId);
        results.push({ template: tmpl.name, type: msgType, status: "failed", error: errMsg });
        console.error(`[auto-notify] Failed "${tmpl.name}" (${msgType}): ${errMsg}`);
      }
    }

    // ── Post-send flags ────────────────────────────────────────────────────────
    const anySent = results.some((r) => r.status === "sent");

    if (mod === "agendamento" && anySent) {
      if (event === "on_reminder") {
        await service
          .from("visit_appointments")
          .update({ reminder_sent: true })
          .eq("id", record_id);
      } else if (
        event === "on_create" ||
        (event === "on_status_change" && new_status === "confirmed")
      ) {
        await service
          .from("visit_appointments")
          .update({ confirmation_sent: true })
          .eq("id", record_id);
      }
    }

    // ── Internal admin notifications on new records ───────────────────────────
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
        agendamento: "/admin/gestao",
        matricula: "/admin/gestao?tab=matriculas",
        contato: "/admin/gestao?tab=contatos",
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

    return json({
      success: true,
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (err) {
    console.error("[auto-notify] error:", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
