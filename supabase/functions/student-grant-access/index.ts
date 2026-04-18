/**
 * student-grant-access — primeiro acesso / reenvio de senha do aluno,
 * acionado pelo responsavel autenticado no portal `/responsavel`.
 *
 * Por que existir: hoje o aluno faz self-signup em `/portal/login` aba
 * "Primeiro acesso" com matricula + CPF do responsavel + senha escolhida,
 * sem canal validado (PRD §10.20). Esta edge function fecha a lacuna:
 * o responsavel ja autenticado escolhe um filho e libera o acesso. A
 * senha provisoria vai para o WhatsApp do PROPRIO responsavel (aluno
 * geralmente e menor; `students` nao tem `phone` proprio).
 *
 * Espelha 1:1 a logica de `guardian-request-access` / `professor-request-access`,
 * trocando:
 *   - lookup CPF/email -> JWT do responsavel + autorizacao via student_guardians
 *   - tabela auditoria -> student_access_attempts (migration 193, channel=guardian_grant)
 *
 * Branch interno:
 *   - students.auth_user_id IS NULL  -> auth.admin.createUser  + link em students
 *   - students.auth_user_id IS NOT  NULL -> auth.admin.updateUserById (reset)
 *
 * Em ambos os branches: students.must_change_password=true,
 * password_changed_at=NULL (gate do PRD §10.18 Step 1 redireciona para
 * /portal/trocar-senha no proximo login).
 *
 * Rate-limit:
 *   - 3 envios bem-sucedidos por student_id / 1h
 *   - 5 envios bem-sucedidos por granted_by_guardian_user_id / 1h
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
function normalizeCpf(cpf: string | null | undefined): string {
  return (cpf || "").replace(/\D/g, "");
}
function phoneDigits(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}
function normalizePhoneBR(phone: string): string {
  const d = phoneDigits(phone);
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
  return `55${d}`;
}
function syntheticStudentEmail(enrollment: string): string {
  // Mesmo padrao usado em StudentAuthContext.toEmail()
  return `${enrollment.trim()}@aluno.local`;
}

// ── Tipos ───────────────────────────────────────────────────────────────────
type RequestBody = {
  student_id?: string;
  system_url?: string;
};
type AttemptResult =
  | "sent"
  | "student_not_found"
  | "no_guardian_phone"
  | "no_whatsapp"
  | "rate_limited"
  | "whatsapp_send_failed"
  | "invalid_input"
  | "wa_not_configured"
  | "unauthorized";

// ── Limites ─────────────────────────────────────────────────────────────────
const MAX_SENT_PER_STUDENT_HOUR = 3;
const MAX_SENT_PER_GUARDIAN_HOUR = 5;

// ── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") || "";
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 255);

  async function logAttempt(
    studentId: string | null,
    guardianUserId: string | null,
    result: AttemptResult,
  ) {
    await supabaseAdmin.from("student_access_attempts").insert({
      student_id: studentId,
      granted_by_guardian_user_id: guardianUserId,
      ip_address: ip || null,
      user_agent: ua || null,
      channel: "guardian_grant",
      result,
    });
  }

  // ── 1. Resolve o caller (responsavel autenticado) ────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await userClient.auth.getUser();
  if (!caller) {
    await logAttempt(null, null, "unauthorized");
    return json({ error: "Não autenticado." }, 401);
  }
  const callerId = caller.id;

  // ── 2. Parse + validacao ─────────────────────────────────────────────────
  let body: RequestBody;
  try { body = await req.json() as RequestBody; }
  catch { return json({ error: "JSON inválido" }, 400); }

  const studentId = (body.student_id || "").trim();
  if (!studentId || !/^[0-9a-f-]{36}$/i.test(studentId)) {
    await logAttempt(null, callerId, "invalid_input");
    return json({ error: "student_id é obrigatório." }, 400);
  }

  // ── 3. Carrega guardian_profile do caller (cpf para fallback de match) ───
  const { data: callerProfile } = await supabaseAdmin
    .from("guardian_profiles")
    .select("id, name, cpf, phone, is_active")
    .eq("id", callerId)
    .maybeSingle();

  if (!callerProfile || !(callerProfile as { is_active: boolean }).is_active) {
    await logAttempt(studentId, callerId, "unauthorized");
    return json({ error: "Conta não autorizada." }, 403);
  }

  const callerCpf   = normalizeCpf((callerProfile as { cpf: string | null }).cpf);
  const callerPhone = (callerProfile as { phone: string | null }).phone || "";
  const callerName  = (callerProfile as { name: string | null }).name || "Responsável";

  // ── 4. Autorizacao: caller precisa ser guardian deste aluno ──────────────
  // Match via student_guardians.guardian_user_id (preenchido pos-Fase 10)
  // OU via student_guardians.guardian_cpf == callerCpf (fallback histórico).
  const { data: link } = await supabaseAdmin
    .from("student_guardians")
    .select("id, guardian_user_id, guardian_cpf")
    .eq("student_id", studentId)
    .or(
      callerCpf
        ? `guardian_user_id.eq.${callerId},guardian_cpf.eq.${callerCpf}`
        : `guardian_user_id.eq.${callerId}`,
    )
    .limit(1)
    .maybeSingle();

  if (!link) {
    await logAttempt(studentId, callerId, "unauthorized");
    return json({ error: "Você não é responsável vinculado a este aluno." }, 403);
  }

  // ── 5. Carrega aluno ─────────────────────────────────────────────────────
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("id, full_name, enrollment_number, auth_user_id, status")
    .eq("id", studentId)
    .maybeSingle();

  if (!student || (student as { status: string }).status !== "active") {
    await logAttempt(studentId, callerId, "student_not_found");
    return json({ error: "Aluno não encontrado ou inativo." }, 404);
  }
  const studentName = (student as { full_name: string }).full_name;
  const enrollment  = (student as { enrollment_number: string | null }).enrollment_number;
  if (!enrollment) {
    await logAttempt(studentId, callerId, "invalid_input");
    return json({ error: "Aluno sem matrícula registrada. Procure a secretaria." }, 422);
  }
  const existingAuthUserId = (student as { auth_user_id: string | null }).auth_user_id;

  // ── 6. Rate-limit ────────────────────────────────────────────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: studentSentCount }, { count: guardianSentCount }] = await Promise.all([
    supabaseAdmin
      .from("student_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("result", "sent")
      .gte("created_at", oneHourAgo),
    supabaseAdmin
      .from("student_access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("granted_by_guardian_user_id", callerId)
      .eq("result", "sent")
      .gte("created_at", oneHourAgo),
  ]);
  if ((studentSentCount ?? 0) >= MAX_SENT_PER_STUDENT_HOUR ||
      (guardianSentCount ?? 0) >= MAX_SENT_PER_GUARDIAN_HOUR) {
    await logAttempt(studentId, callerId, "rate_limited");
    return json({
      status: "rate_limited",
      message: "Muitos envios recentes. Aguarde alguns minutos antes de tentar novamente.",
    }, 429);
  }

  // ── 7. Telefone do responsavel ───────────────────────────────────────────
  if (!callerPhone) {
    await logAttempt(studentId, callerId, "no_guardian_phone");
    return json({
      status: "no_guardian_phone",
      message: "Seu cadastro está sem telefone. Procure a coordenação da escola para atualizar.",
    }, 422);
  }

  // ── 8. Carrega credenciais WhatsApp + template ───────────────────────────
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
    await logAttempt(studentId, callerId, "wa_not_configured");
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

  // ── 9. Verifica numero no WhatsApp ───────────────────────────────────────
  const numberBR = normalizePhoneBR(callerPhone);
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
    await logAttempt(studentId, callerId, "no_whatsapp");
    return json({
      status: "no_whatsapp",
      message: "Seu telefone não está ativo no WhatsApp. Procure a coordenação da escola para atualizar.",
    }, 422);
  }

  // ── 10. Cria/reseta auth do aluno ────────────────────────────────────────
  const tempPassword = generateTempPassword();
  const studentEmail = syntheticStudentEmail(enrollment);

  let studentAuthId = existingAuthUserId;
  if (!studentAuthId) {
    // Criar
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email:          studentEmail,
      password:       tempPassword,
      email_confirm:  true,
      user_metadata:  { role: "student", enrollment_number: enrollment },
    });
    if (createErr || !created.user) {
      await logAttempt(studentId, callerId, "whatsapp_send_failed");
      return json({ error: createErr?.message ?? "Falha ao criar acesso do aluno." }, 500);
    }
    studentAuthId = created.user.id;
    await supabaseAdmin
      .from("students")
      .update({ auth_user_id: studentAuthId })
      .eq("id", studentId);
  } else {
    // Resetar
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(studentAuthId, {
      password: tempPassword,
    });
    if (updErr) {
      await logAttempt(studentId, callerId, "whatsapp_send_failed");
      return json({ error: updErr.message }, 500);
    }
  }

  await supabaseAdmin
    .from("students")
    .update({
      must_change_password: true,
      password_changed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentId);

  // ── 11. Envia template `senha_temporaria` ────────────────────────────────
  const systemUrl = body.system_url ?? Deno.env.get("STUDENT_PORTAL_URL") ?? "";
  const variables: Record<string, string> = {
    user_name:     studentName,        // nome do aluno (a senha e DELE)
    temp_password: tempPassword,
    system_url:    systemUrl || "(acesse pelo site da escola)",
  };
  const renderedText = tplBody.replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] ?? `{{${k}}}`);

  const { data: logRow } = await supabaseAdmin
    .from("whatsapp_message_log")
    .insert({
      template_id:       tplId,
      recipient_phone:   callerPhone,   // WhatsApp vai pro responsavel
      recipient_name:    callerName,
      rendered_content:  { body: renderedText, type: "text" },
      variables_used:    variables,
      status:            "queued",
      related_module:    "auth_student",
      related_record_id: studentId,
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
        ...(logId ? { track_id: logId, track_source: "student-grant-access" } : {}),
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
    await logAttempt(studentId, callerId, "whatsapp_send_failed");
    return json({
      status: "error",
      message: "Não foi possível enviar a mensagem. Procure a coordenação da escola.",
    }, 502);
  }

  await logAttempt(studentId, callerId, "sent");
  return json({
    status: "sent",
    message:
      "Senha provisória enviada para o seu WhatsApp. O aluno usa a matrícula + essa senha para entrar e definir uma nova.",
    is_first_access: !existingAuthUserId,
  }, 200);
});
