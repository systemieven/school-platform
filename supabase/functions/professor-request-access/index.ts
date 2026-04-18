/**
 * professor-request-access — fluxo público "esqueci minha senha" do
 * Portal do Professor (`/professor/login`).
 *
 * Por que existir: hoje o professor depende do admin acionar
 * `reset-user-password` na pagina de Usuarios — nao ha auto-servico. Esta
 * edge function fecha a lacuna: o professor informa o e-mail cadastrado,
 * validamos contra `profiles` (role='teacher', is_active=true) e — se o
 * cadastro tem telefone com WhatsApp — geramos uma senha provisoria,
 * setamos `must_change_password=true` e enviamos via template
 * `senha_temporaria` direto pela UazAPI.
 *
 * Espelha 1:1 a logica do `guardian-request-access` (mesma rotina de
 * temp password, mesmo template, mesmas mensagens), trocando:
 *   - lookup de CPF → lookup de email/role
 *   - tabela de auditoria → `teacher_access_attempts` (migration 191)
 *
 * Anti-abuso:
 *   - rate-limit por email (3 envios bem-sucedidos / 1h)
 *   - rate-limit por IP    (10 tentativas / 10min)
 *
 * Anti-enumeracao: o response NAO revela se o e-mail existe quando o
 * profile nao tem telefone — devolvemos a mesma mensagem generica para
 * "email_not_found" e "no_phone". Ja "no_whatsapp" devolve mensagem
 * especifica orientando contato com a coordenacao.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── CORS / helpers ──────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Senha provisoria (mesma rotina dos demais fluxos) ──────────────────────
function generateTempPassword(): string {
  const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const special = "@#$!%?";
  const all     = upper + lower + digits + special;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const extra = Array.from({ length: 8 }, () => rand(all));
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ── Normalizacao ────────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function phoneDigits(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}
function normalizePhoneBR(phone: string): string {
  const d = phoneDigits(phone);
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
  return `55${d}`;
}

// ── Tipos ───────────────────────────────────────────────────────────────────

type RequestBody = {
  email?: string;
  /** URL do portal usada no template (ex.: https://app.escola.com.br/professor/login). */
  system_url?: string;
};

type AttemptResult =
  | "sent"
  | "email_not_found"
  | "no_phone"
  | "no_whatsapp"
  | "rate_limited"
  | "whatsapp_send_failed"
  | "invalid_input"
  | "wa_not_configured";

// ── Limites ─────────────────────────────────────────────────────────────────
const MAX_SENT_PER_EMAIL_HOUR = 3;
const MAX_ATTEMPTS_PER_IP_10MIN = 10;

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") || "";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 255);

  async function logAttempt(email: string, result: AttemptResult): Promise<void> {
    await supabaseAdmin.from("teacher_access_attempts").insert({
      email, ip_address: ip || null, user_agent: ua || null, result,
    });
  }

  function genericSuccess() {
    return json({
      status: "queued",
      message:
        "Se este e-mail estiver cadastrado e tiver um WhatsApp ativo, você receberá uma senha provisória em alguns segundos.",
    }, 200);
  }

  // ── 1. Parse + validacao ─────────────────────────────────────────────────
  let body: RequestBody;
  try { body = await req.json() as RequestBody; }
  catch { return json({ error: "JSON inválido" }, 400); }

  const email = normalizeEmail(body.email || "");
  if (!email || !isEmail(email)) {
    await logAttempt(email || "(invalid)", "invalid_input");
    return json({ error: "E-mail é obrigatório." }, 400);
  }

  // ── 2. Rate-limit ────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tenMinAgo  = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [{ count: emailSentCount }, { count: ipAttemptCount }] = await Promise.all([
    supabaseAdmin
      .from("teacher_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("result", "sent")
      .gte("created_at", oneHourAgo),
    ip
      ? supabaseAdmin
          .from("teacher_access_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .gte("created_at", tenMinAgo)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  if ((emailSentCount ?? 0) >= MAX_SENT_PER_EMAIL_HOUR ||
      (ipAttemptCount ?? 0) >= MAX_ATTEMPTS_PER_IP_10MIN) {
    await logAttempt(email, "rate_limited");
    return json({
      status: "rate_limited",
      message: "Muitas tentativas recentes. Aguarde alguns minutos antes de tentar novamente.",
    }, 429);
  }

  // ── 3. Lookup do profile (role=teacher + ativo) ──────────────────────────
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active")
    .eq("email", email)
    .eq("role", "teacher")
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    await logAttempt(email, "email_not_found");
    return genericSuccess(); // anti-enumeracao
  }

  const teacherId   = (profile as { id: string }).id;
  const teacherName = (profile as { full_name: string | null }).full_name || "Professor(a)";
  const phoneRaw    = (profile as { phone: string | null }).phone || "";

  if (!phoneRaw) {
    await logAttempt(email, "no_phone");
    return genericSuccess(); // mesma mensagem generica (anti-enumeracao)
  }

  // ── 4. Carrega credenciais WhatsApp + template ──────────────────────────
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .eq("category", "whatsapp")
    .in("key", ["instance_url", "api_token"]);

  const waCfg: Record<string, string> = {};
  (settings ?? []).forEach((s: { key: string; value: unknown }) => {
    waCfg[s.key] = typeof s.value === "string" ? s.value : String(s.value);
  });
  const instanceUrl = waCfg["instance_url"]?.trim();
  const apiToken    = waCfg["api_token"]?.trim();

  if (!instanceUrl || !apiToken) {
    await logAttempt(email, "wa_not_configured");
    return json({
      status: "error",
      message: "Envio por WhatsApp temporariamente indisponível. Procure a coordenação da escola.",
    }, 503);
  }

  const { data: tplRow } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("id, content")
    .eq("name", "senha_temporaria")
    .eq("is_active", true)
    .maybeSingle();

  const tplBody = (tplRow as { content?: { body?: string } } | null)?.content?.body
    ?? "Olá, {{user_name}}!\n\nSua senha provisória é: {{temp_password}}\nAcesse: {{system_url}}";
  const tplId = (tplRow as { id?: string } | null)?.id ?? null;

  // ── 5. Verifica numero no WhatsApp ───────────────────────────────────────
  const numberBR = normalizePhoneBR(phoneRaw);
  let waExists = false;

  try {
    const checkResp = await fetch(`${instanceUrl.replace(/\/$/, "")}/chat/check`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "token": apiToken },
      body:    JSON.stringify({ numbers: [numberBR] }),
    });
    if (checkResp.ok) {
      const arr = await checkResp.json() as Array<{ isInWhatsapp?: boolean; jid?: string }>;
      waExists = Array.isArray(arr) && arr.length > 0
        && (arr[0].isInWhatsapp === true || !!arr[0].jid);
    }
  } catch (_e) {
    waExists = true; // se a checagem falhar, tenta o envio mesmo assim
  }

  if (!waExists) {
    await logAttempt(email, "no_whatsapp");
    return json({
      status: "no_whatsapp",
      message:
        "O telefone cadastrado não está ativo no WhatsApp. Procure a coordenação da escola para atualizar seu cadastro.",
    }, 422);
  }

  // ── 6. Reset senha + flag must_change_password ──────────────────────────
  const tempPassword = generateTempPassword();

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(teacherId, {
    password: tempPassword,
  });
  if (updErr) {
    await logAttempt(email, "whatsapp_send_failed");
    return json({ error: updErr.message }, 500);
  }

  await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", teacherId);

  // ── 7. Envia template `senha_temporaria` ────────────────────────────────
  const systemUrl = body.system_url ?? Deno.env.get("PROFESSOR_PORTAL_URL") ?? "";
  const variables: Record<string, string> = {
    user_name:     teacherName,
    temp_password: tempPassword,
    system_url:    systemUrl || "(acesse pelo site da escola)",
  };
  const renderedText = tplBody.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`);

  const { data: logRow } = await supabaseAdmin
    .from("whatsapp_message_log")
    .insert({
      template_id:       tplId,
      recipient_phone:   phoneRaw,
      recipient_name:    teacherName,
      rendered_content:  { body: renderedText, type: "text" },
      variables_used:    variables,
      status:            "queued",
      related_module:    "auth_teacher",
      related_record_id: teacherId,
    })
    .select("id")
    .single();
  const logId = (logRow as { id?: string } | null)?.id ?? null;

  try {
    const sendResp = await fetch(`${instanceUrl.replace(/\/$/, "")}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": apiToken },
      body: JSON.stringify({
        number: numberBR,
        text:   renderedText,
        ...(logId ? { track_id: logId, track_source: "professor-request-access" } : {}),
      }),
    });
    if (!sendResp.ok) {
      const errBody = await sendResp.text();
      throw new Error(`UazAPI ${sendResp.status}: ${errBody.slice(0, 200)}`);
    }
    const sendData = await sendResp.json() as Record<string, unknown>;
    const waMsgId =
      (sendData?.messageid as string | undefined) ||
      (typeof sendData?.id === "string" ? (sendData.id as string).split(":").pop() : undefined);

    if (logId) {
      await supabaseAdmin.from("whatsapp_message_log").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        ...(waMsgId ? { wa_message_id: waMsgId } : {}),
      }).eq("id", logId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    if (logId) {
      await supabaseAdmin.from("whatsapp_message_log")
        .update({ status: "failed", error_message: message })
        .eq("id", logId);
    }
    await logAttempt(email, "whatsapp_send_failed");
    return json({
      status: "error",
      message: "Não foi possível enviar a mensagem. Procure a coordenação da escola.",
    }, 502);
  }

  await logAttempt(email, "sent");
  return json({
    status: "sent",
    message:
      "Senha provisória enviada para o WhatsApp cadastrado. Use-a para fazer login — você definirá uma nova senha em seguida.",
  }, 200);
});
