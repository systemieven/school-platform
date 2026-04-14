/**
 * financial-notify
 *
 * Called daily by pg_cron (08:00 BRT).
 * Reads billing_stages config, finds matching installments for each stage,
 * renders WhatsApp templates, and sends notifications.
 *
 * Auth: X-Trigger-Secret header (same as auto-notify).
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

function fmtCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── Stage config ──────────────────────────────────────────────────────────────
interface BillingStage {
  stage: string;        // "D-5", "D-1", "D+0", "D+3", "D+10", "D+30"
  enabled: boolean;
  template_id: string;  // UUID of whatsapp_template
}

/**
 * Computes the target due_date for a given stage relative to today.
 * D-5 → parcelas que vencem daqui a 5 dias
 * D+3 → parcelas que venceram há 3 dias
 */
function stageTargetDate(stage: string, today: Date): string {
  const match = stage.match(/^D([+-])(\d+)$/);
  if (!match) return "";
  const sign = match[1] === "+" ? -1 : 1; // D-5 = future, D+3 = past
  const days = parseInt(match[2], 10);
  const target = new Date(today);
  target.setDate(target.getDate() + sign * days);
  return target.toISOString().split("T")[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
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
      console.warn("[financial-notify] Invalid or missing trigger secret");
      return json({ error: "Unauthorized" }, 401);
    }

    // ── Load config ─────────────────────────────────────────────────────────
    const { data: configRows } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "financial")
      .in("key", ["billing_stages", "pix_key_type", "pix_key_value"]);

    const configMap: Record<string, unknown> = {};
    (configRows || []).forEach((r: { key: string; value: unknown }) => {
      configMap[r.key] = r.value;
    });

    // Parse billing_stages
    let stages: BillingStage[] = [];
    const rawStages = configMap.billing_stages;
    if (Array.isArray(rawStages)) {
      stages = rawStages as BillingStage[];
    } else if (typeof rawStages === "string") {
      try { stages = JSON.parse(rawStages); } catch { /* empty */ }
    }

    const enabledStages = stages.filter(s => s.enabled && s.template_id);
    if (enabledStages.length === 0) {
      console.log("[financial-notify] No enabled billing stages");
      return json({ skipped: true, reason: "no_enabled_stages" });
    }

    // PIX key
    const pixType = configMap.pix_key_type as string || "";
    const pixValue = configMap.pix_key_value as string || "";
    const pixKey = pixType && pixValue ? `${pixType}: ${pixValue}` : "";

    // ── WhatsApp credentials ────────────────────────────────────────────────
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
      console.log("[financial-notify] WhatsApp not configured, skipping");
      return json({ skipped: true, reason: "whatsapp_not_configured" });
    }

    const instanceUrl = waMap.instance_url.replace(/\/$/, "");
    const apiToken = waMap.api_token;

    // ── General settings for variables ──────────────────────────────────────
    const { data: generalSettings } = await service
      .from("system_settings")
      .select("key, value")
      .eq("category", "general");

    const general: Record<string, string> = {};
    (generalSettings || []).forEach((s: { key: string; value: unknown }) => {
      general[s.key] = typeof s.value === "string" ? s.value : String(s.value);
    });

    const portalUrl = Deno.env.get("PORTAL_URL") || general.portal_url || "";

    // ── Load templates ──────────────────────────────────────────────────────
    const templateIds = enabledStages.map(s => s.template_id);
    const { data: templates } = await service
      .from("whatsapp_templates")
      .select("*")
      .in("id", templateIds);

    const templateMap: Record<string, Record<string, unknown>> = {};
    (templates || []).forEach((t: Record<string, unknown>) => {
      templateMap[t.id as string] = t;
    });

    // ── Process each stage ──────────────────────────────────────────────────
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: Array<{ stage: string; sent: number; skipped: number; errors: number }> = [];

    for (const stage of enabledStages) {
      const targetDate = stageTargetDate(stage.stage, today);
      if (!targetDate) {
        console.warn(`[financial-notify] Invalid stage format: ${stage.stage}`);
        continue;
      }

      const template = templateMap[stage.template_id];
      if (!template) {
        console.warn(`[financial-notify] Template ${stage.template_id} not found for stage ${stage.stage}`);
        continue;
      }

      // Determine which statuses to query
      const isPreDue = stage.stage.startsWith("D-") || stage.stage === "D+0";
      const statusFilter = isPreDue ? ["pending"] : ["pending", "overdue"];

      // Find matching installments
      const { data: installments } = await service
        .from("financial_installments")
        .select(`
          id, installment_number, due_date, amount, amount_with_discount, status,
          student_id,
          students!inner(id, full_name, guardian_name, guardian_phone, phone)
        `)
        .eq("due_date", targetDate)
        .in("status", statusFilter);

      if (!installments || installments.length === 0) {
        results.push({ stage: stage.stage, sent: 0, skipped: 0, errors: 0 });
        continue;
      }

      let stageSent = 0;
      let stageSkipped = 0;
      let stageErrors = 0;

      for (const inst of installments) {
        const student = inst.students as unknown as {
          id: string; full_name: string; guardian_name: string | null;
          guardian_phone: string | null; phone: string | null;
        };

        // Dedup: check if already notified for this stage
        const { data: existing } = await service
          .from("financial_notification_log")
          .select("id")
          .eq("installment_id", inst.id)
          .eq("trigger_type", stage.stage)
          .limit(1);

        if (existing && existing.length > 0) {
          stageSkipped++;
          continue;
        }

        // Determine recipient phone (guardian first, then student)
        const recipientPhone = student.guardian_phone || student.phone;
        if (!recipientPhone) {
          stageSkipped++;
          continue;
        }

        // Calculate days overdue
        const dueDate = new Date(inst.due_date + "T12:00:00");
        const diffMs = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        // Build variables
        const vars: Record<string, string> = {
          nome_aluno: student.full_name || "Aluno",
          responsavel: student.guardian_name || student.full_name || "Responsável",
          valor: fmtCurrency(Number(inst.amount)),
          data_vencimento: fmtDate(inst.due_date),
          valor_atualizado: fmtCurrency(Number(inst.amount_with_discount ?? inst.amount)),
          dias_atraso: String(daysOverdue),
          chave_pix: pixKey,
          link_portal: portalUrl ? `${portalUrl}/portal/financeiro` : "",
          parcela_numero: String(inst.installment_number),
          school_name: general.school_name || "Colégio Batista em Caruaru",
          school_phone: general.phone || "",
          current_date: new Date().toLocaleDateString("pt-BR"),
        };

        const content = (template.content || {}) as Record<string, unknown>;
        const body = (content.body as string) || "";
        if (!body) { stageSkipped++; continue; }

        const rendered = render(body, vars);
        const phone = normalizePhone(recipientPhone);

        // Create whatsapp_message_log
        const { data: log } = await service
          .from("whatsapp_message_log")
          .insert({
            template_id: template.id,
            recipient_phone: recipientPhone,
            recipient_name: student.guardian_name || student.full_name,
            rendered_content: { body: rendered, type: "text" },
            status: "queued",
            related_module: "financeiro",
            related_record_id: inst.id,
            sent_by: null,
          })
          .select("id")
          .single();

        const logId = log?.id || "";

        try {
          const apiRes = await fetch(`${instanceUrl}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: apiToken },
            body: JSON.stringify({
              number: phone,
              text: rendered,
              track_id: logId,
              track_source: "colegio-batista",
            }),
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

            // Log in financial_notification_log
            await service.from("financial_notification_log").insert({
              installment_id: inst.id,
              trigger_type: stage.stage,
              whatsapp_message_id: logId,
            });

            stageSent++;
            console.log(`[financial-notify] Sent ${stage.stage} for installment ${inst.id} to ${phone}`);
          } else {
            const errBody = await apiRes.text().catch(() => "Unknown error");
            await service
              .from("whatsapp_message_log")
              .update({ status: "failed", error_message: errBody })
              .eq("id", logId);

            await service.from("financial_notification_log").insert({
              installment_id: inst.id,
              trigger_type: stage.stage,
              error_message: errBody,
            });

            stageErrors++;
            console.error(`[financial-notify] Failed ${stage.stage} for ${inst.id}: ${errBody}`);
          }
        } catch (sendErr) {
          await service
            .from("whatsapp_message_log")
            .update({ status: "failed", error_message: String(sendErr) })
            .eq("id", logId);

          await service.from("financial_notification_log").insert({
            installment_id: inst.id,
            trigger_type: stage.stage,
            error_message: String(sendErr),
          });

          stageErrors++;
          console.error(`[financial-notify] Error ${stage.stage} for ${inst.id}:`, sendErr);
        }
      }

      results.push({ stage: stage.stage, sent: stageSent, skipped: stageSkipped, errors: stageErrors });
      totalSent += stageSent;
      totalSkipped += stageSkipped;
      totalErrors += stageErrors;
    }

    console.log(`[financial-notify] Done: sent=${totalSent} skipped=${totalSkipped} errors=${totalErrors}`);
    return json({ success: true, sent: totalSent, skipped: totalSkipped, errors: totalErrors, results });
  } catch (err) {
    console.error("[financial-notify] error:", err);
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
