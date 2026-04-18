/**
 * guardian-request-access — fluxo público de primeiro acesso / esqueci a senha
 * do Portal do Responsável (`/responsavel/login`).
 *
 * Por que existir: responsável NÃO tem auto-cadastro. A escola registra o
 * responsável em `student_guardians` (via cadastro do aluno). Quando o
 * responsável quer acessar o portal pela primeira vez OU esqueceu a senha,
 * ele informa CPF + telefone aqui — validamos contra o cadastro, geramos
 * uma senha provisória e enviamos via WhatsApp (template `senha_temporaria`).
 *
 * O `must_change_password=true` no `guardian_profiles` (default da migration 75)
 * + o gate em GuardianProtectedRoute (passo 1) garantem que o responsável
 * é forçado a definir a própria senha antes de qualquer outra ação.
 *
 * Não confundir com create-admin-user: aquele é admin→colaborador, requer JWT
 * de admin, e o WhatsApp é disparado client-side com o temp_password retornado.
 * Aqui é público (verify_jwt=false), o responsável é o caller, e o envio
 * acontece server-side para nunca expor a senha provisória ao cliente.
 *
 * Anti-abuso:
 *   - rate-limit por CPF (3 envios bem-sucedidos / 1h)
 *   - rate-limit por IP   (10 tentativas / 10min)
 *   - cada chamada grava em `guardian_access_attempts` (auditoria)
 *
 * Anti-enumeração: o response NÃO revela se o CPF existe quando o telefone
 * diverge — devolvemos a mesma mensagem genérica para "cpf_not_found" e
 * "phone_mismatch". Já o caso "no_whatsapp" devolve mensagem específica
 * (decisão UX explícita: orientar para a secretaria com link).
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

// ── Senha provisória ────────────────────────────────────────────────────────
// Mesma rotina usada em create-admin-user / reset-user-password.
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

// ── Normalização ────────────────────────────────────────────────────────────

function normalizeCpf(cpf: string): string {
  return (cpf || "").replace(/\D/g, "");
}

/** Devolve só os dígitos. Preserva o DDI 55 quando presente. */
function phoneDigits(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/** Normaliza para formato BR com DDI 55 (12 ou 13 dígitos). */
function normalizePhoneBR(phone: string): string {
  const d = phoneDigits(phone);
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
  return `55${d}`;
}

/** Compara dois telefones tolerando ausência de DDI ou do 9º dígito.
 *  Cadastros antigos podem ter "81999999999" (sem DDI) — match liberal. */
function phonesMatch(a: string, b: string): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  // tolera DDI faltando em qualquer lado
  if (da.endsWith(db) || db.endsWith(da)) return true;
  return false;
}

// ── Email convention (espelha GuardianAuthContext) ──────────────────────────
const GUARDIAN_EMAIL_SUFFIX = "@responsavel.portal";
function toGuardianEmail(cpf: string): string {
  return `${normalizeCpf(cpf)}${GUARDIAN_EMAIL_SUFFIX}`;
}

// ── Tipos ───────────────────────────────────────────────────────────────────

type RequestBody = {
  cpf?: string;
  phone?: string;
  /** URL do portal usada no template (ex.: https://app.escola.com.br/responsavel/login).
   *  Quando ausente, usa fallback do env. */
  system_url?: string;
};

type AttemptResult =
  | "sent"
  | "cpf_not_found"
  | "phone_mismatch"
  | "no_whatsapp"
  | "rate_limited"
  | "whatsapp_send_failed"
  | "invalid_input"
  | "wa_not_configured";

// ── Limites ─────────────────────────────────────────────────────────────────
const MAX_SENT_PER_CPF_HOUR = 3;
const MAX_ATTEMPTS_PER_IP_10MIN = 10;

// ── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // IP / UA (best-effort)
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") || "";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 255);

  async function logAttempt(
    cpf: string, phone: string | null, result: AttemptResult,
  ): Promise<void> {
    await supabaseAdmin.from("guardian_access_attempts").insert({
      cpf, phone, ip_address: ip || null, user_agent: ua || null, result,
    });
  }

  // Resposta genérica "se o cadastro estiver correto, enviamos por WhatsApp" —
  // usada para esconder se o CPF existe ou se o telefone bateu (anti-enumeração).
  function genericSuccess() {
    return json({
      status: "queued",
      message:
        "Se o CPF e telefone estiverem corretos no cadastro, você receberá uma senha provisória por WhatsApp em alguns segundos.",
    }, 200);
  }

  // ── 1. Parse + validação básica ───────────────────────────────────────────
  let body: RequestBody;
  try { body = await req.json() as RequestBody; }
  catch { return json({ error: "JSON inválido" }, 400); }

  const cpf   = normalizeCpf(body.cpf || "");
  const phone = (body.phone || "").trim();

  if (cpf.length !== 11 || !phone) {
    await logAttempt(cpf || "(invalid)", phone || null, "invalid_input");
    return json({ error: "CPF e telefone são obrigatórios." }, 400);
  }

  // ── 2. Rate-limit ─────────────────────────────────────────────────────────
  const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tenMinAgo   = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const [{ count: cpfSentCount }, { count: ipAttemptCount }] = await Promise.all([
    supabaseAdmin
      .from("guardian_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("cpf", cpf)
      .eq("result", "sent")
      .gte("created_at", oneHourAgo),
    ip
      ? supabaseAdmin
          .from("guardian_access_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .gte("created_at", tenMinAgo)
      : Promise.resolve({ count: 0 } as { count: number | null }),
  ]);

  if ((cpfSentCount ?? 0) >= MAX_SENT_PER_CPF_HOUR ||
      (ipAttemptCount ?? 0) >= MAX_ATTEMPTS_PER_IP_10MIN) {
    await logAttempt(cpf, phone, "rate_limited");
    return json({
      status: "rate_limited",
      message: "Muitas tentativas recentes. Aguarde alguns minutos antes de tentar novamente.",
    }, 429);
  }

  // ── 3. Lookup do CPF em student_guardians ────────────────────────────────
  const { data: guardianRows } = await supabaseAdmin
    .from("student_guardians")
    .select("id, guardian_name, guardian_phone, guardian_user_id")
    .eq("guardian_cpf", cpf);

  const rows = (guardianRows ?? []) as Array<{
    id: string;
    guardian_name: string | null;
    guardian_phone: string | null;
    guardian_user_id: string | null;
  }>;

  if (rows.length === 0) {
    await logAttempt(cpf, phone, "cpf_not_found");
    return genericSuccess(); // anti-enumeração
  }

  // ── 4. Match de telefone ────────────────────────────────────────────────
  const anyPhoneMatch = rows.some((r) => r.guardian_phone && phonesMatch(r.guardian_phone, phone));
  if (!anyPhoneMatch) {
    await logAttempt(cpf, phone, "phone_mismatch");
    return genericSuccess(); // mesma mensagem genérica
  }

  const guardianName = rows.find((r) => !!r.guardian_name)?.guardian_name || "Responsável";
  const existingAuthId = rows.find((r) => !!r.guardian_user_id)?.guardian_user_id ?? null;

  // ── 5. Carrega credenciais WhatsApp + template ──────────────────────────
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
    await logAttempt(cpf, phone, "wa_not_configured");
    return json({
      status: "error",
      message: "Envio por WhatsApp temporariamente indisponível. Procure a secretaria da escola.",
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

  // ── 6. Verifica número no WhatsApp ──────────────────────────────────────
  const numberBR = normalizePhoneBR(phone);
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
    // Se a checagem falhar, não bloqueia: tenta o envio mesmo assim.
    waExists = true;
  }

  if (!waExists) {
    await logAttempt(cpf, phone, "no_whatsapp");
    return json({
      status: "no_whatsapp",
      message:
        "O número informado não está ativo no WhatsApp. Procure a secretaria da escola para atualizar seu cadastro ou agendar uma visita.",
    }, 422);
  }

  // ── 7. Gera temp password + cria/atualiza auth ──────────────────────────
  const tempPassword = generateTempPassword();
  let guardianUserId = existingAuthId;

  if (!guardianUserId) {
    // Primeiro acesso: cria auth.users + guardian_profiles + linka student_guardians.
    const email = toGuardianEmail(cpf);
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: "responsavel", cpf },
    });

    if (createErr || !created?.user) {
      await logAttempt(cpf, phone, "whatsapp_send_failed");
      return json({ error: createErr?.message ?? "Falha ao criar acesso." }, 500);
    }
    guardianUserId = created.user.id;

    // Upsert guardian_profiles (default já é must_change_password=true)
    await supabaseAdmin.from("guardian_profiles").upsert({
      id: guardianUserId,
      name:  guardianName,
      cpf,
      phone: numberBR,
      email,
      is_active: true,
      must_change_password: true,
    });

    // Linka todas as linhas com este CPF
    await supabaseAdmin
      .from("student_guardians")
      .update({ guardian_user_id: guardianUserId })
      .eq("guardian_cpf", cpf);
  } else {
    // Esqueci a senha: reset + flag must_change_password
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(guardianUserId, {
      password: tempPassword,
    });
    if (updErr) {
      await logAttempt(cpf, phone, "whatsapp_send_failed");
      return json({ error: updErr.message }, 500);
    }
    await supabaseAdmin
      .from("guardian_profiles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", guardianUserId);
  }

  // ── 8. Envia template `senha_temporaria` via WhatsApp ────────────────────
  const systemUrl = body.system_url ?? Deno.env.get("GUARDIAN_PORTAL_URL") ?? "";
  const variables: Record<string, string> = {
    user_name:     guardianName,
    temp_password: tempPassword,
    system_url:    systemUrl || "(acesse pelo site da escola)",
  };
  const renderedText = tplBody.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`);

  // Pré-log no whatsapp_message_log (status=queued) para aparecer no histórico admin
  const { data: logRow } = await supabaseAdmin
    .from("whatsapp_message_log")
    .insert({
      template_id:       tplId,
      recipient_phone:   phone,
      recipient_name:    guardianName,
      rendered_content:  { body: renderedText, type: "text" },
      variables_used:    variables,
      status:            "queued",
      related_module:    "auth_guardian",
      related_record_id: guardianUserId,
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
        ...(logId ? { track_id: logId, track_source: "guardian-first-access" } : {}),
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
    await logAttempt(cpf, phone, "whatsapp_send_failed");
    return json({
      status: "error",
      message: "Não foi possível enviar a mensagem. Procure a secretaria da escola.",
    }, 502);
  }

  await logAttempt(cpf, phone, "sent");
  return json({
    status: "sent",
    message:
      "Senha provisória enviada para o WhatsApp cadastrado. Verifique sua conversa e use-a para fazer login — você definirá uma nova senha em seguida.",
  }, 200);
});
