/**
 * careers-intake
 *
 * Endpoint público do wizard /trabalhe-conosco. Fluxo completo em 1 chamada:
 *   1. Valida payload (nome, email, telefone, área, LGPD, arquivo).
 *   2. Rate-limit por IP (configurável via content.careers.rate_limit_per_hour).
 *   3. Upsert em `candidates` por email (ou e-mail normalizado).
 *   4. Cria `job_applications` (stage='pre_qualification',
 *      pre_screening_status='pending', source='site') com `area` e
 *      `job_opening_id` opcional.
 *   5. Upload do currículo para `hr-documents/_recruitment/{application_id}/resume.{ext}`
 *      (bucket privado) e persiste `resume_path`.
 *   6. Chama `ai-orchestrator` com `resume_extractor` passando o texto
 *      extraído (cliente faz PDF→text via pdfjs antes do upload). Persiste
 *      `extracted_payload`.
 *   7. Dispara `resume_screener` (apenas se houver job_opening_id) para
 *      gerar `screener_score`/`screener_summary`/`screener_payload`.
 *   8. Cria `pre_screening_sessions` com token opaco (32 bytes base64url).
 *   9. Retorna `{ application_id, session_token, area, job_title }` para o
 *      cliente iniciar o chat via `careers-interview-turn`.
 *
 * Chamada sem JWT (público). Usa SERVICE_ROLE_KEY internamente.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { rateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function normalizeEmail(raw: string): string {
  return (raw || "").trim().toLowerCase();
}

function b64urlRandom(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseBase64(dataUrlOrB64: string): { bytes: Uint8Array; mime: string | null } {
  let b64 = dataUrlOrB64;
  let mime: string | null = null;
  const m = dataUrlOrB64.match(/^data:([^;]+);base64,(.*)$/);
  if (m) {
    mime = m[1];
    b64 = m[2];
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return { bytes: out, mime };
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const ALLOWED_AREAS = new Set(["pedagogica", "administrativa", "servicos_gerais"]);

interface IntakeBody {
  area?: string;
  job_opening_id?: string | null;
  candidate?: {
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string | null;
  };
  resume?: {
    filename?: string;
    mime_type?: string;
    size_bytes?: number;
    content_base64?: string;
    extracted_text?: string;
  };
  lgpd_consent?: boolean;
}

async function callOrchestrator(
  supabaseUrl: string,
  serviceKey: string,
  agent_slug: string,
  context: Record<string, unknown>,
): Promise<{ text: string; ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-orchestrator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ agent_slug, context }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
      return { text: "", ok: false, error: body?.error ?? `HTTP ${res.status}` };
    }
    return { text: String(body.text ?? ""), ok: true };
  } catch (e) {
    return { text: "", ok: false, error: (e as Error).message };
  }
}

function safeJsonParse(text: string): unknown {
  // Try direct
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  // Strip ```json fences or leading prose
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fallthrough */ }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  // Load careers settings for upload size + rate limit
  const { data: cfgRow } = await service
    .from("system_settings")
    .select("value")
    .eq("category", "content")
    .eq("key", "careers")
    .maybeSingle();
  const cfg = (cfgRow?.value ?? {}) as {
    rate_limit_per_hour?: number;
    rate_limit?: number;
    max_upload_mb?: number;
    lgpd_text?: string;
  };
  const maxUploadBytes = (cfg.max_upload_mb ?? 5) * 1024 * 1024;
  const rlMax = cfg.rate_limit_per_hour ?? cfg.rate_limit ?? 10;

  // LGPD version = primeiros 12 chars do sha256 do texto vigente (ou "default").
  async function sha256Hex(input: string): Promise<string> {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const lgpdVersion = cfg.lgpd_text
    ? (await sha256Hex(cfg.lgpd_text)).slice(0, 12)
    : "default";

  const rl = rateLimit(req, { maxRequests: rlMax, windowMs: 60 * 60_000 });
  if (!rl.ok) return rateLimitResponse(rl, CORS);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  let body: IntakeBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // ---- Validate --------------------------------------------------------------
  const area = (body.area ?? "").trim();
  if (!ALLOWED_AREAS.has(area)) return json({ error: "area_invalida" }, 400);

  const name = (body.candidate?.name ?? "").trim();
  const email = normalizeEmail(body.candidate?.email ?? "");
  const phone = normalizePhone(body.candidate?.phone ?? "");
  if (!name || name.length < 3) return json({ error: "nome_invalido" }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_invalido" }, 400);
  if (phone.length < 10) return json({ error: "telefone_invalido" }, 400);
  if (!body.lgpd_consent) return json({ error: "lgpd_requerido" }, 422);

  const resume = body.resume;
  if (!resume?.content_base64 || !resume.filename || !resume.mime_type) {
    return json({ error: "curriculo_obrigatorio" }, 400);
  }
  if (!ALLOWED_MIME.has(resume.mime_type)) {
    return json({ error: "formato_nao_suportado", allowed: [...ALLOWED_MIME] }, 400);
  }
  if ((resume.size_bytes ?? 0) > maxUploadBytes) {
    return json({ error: "arquivo_muito_grande", max_mb: cfg.max_upload_mb ?? 5 }, 400);
  }

  // ---- Validate job opening if provided -------------------------------------
  let jobTitle: string | null = null;
  let jobRequirements: string | null = null;
  if (body.job_opening_id) {
    const { data: jo, error: joErr } = await service
      .from("job_openings")
      .select("id, title, area, requirements, status")
      .eq("id", body.job_opening_id)
      .maybeSingle();
    if (joErr || !jo) return json({ error: "vaga_nao_encontrada" }, 404);
    if (jo.area !== area) return json({ error: "vaga_area_inconsistente" }, 422);
    if (jo.status !== "published") return json({ error: "vaga_fechada" }, 422);
    jobTitle = jo.title;
    jobRequirements = jo.requirements ?? null;
  }

  // ---- Upsert candidate ------------------------------------------------------
  const { data: existingCand } = await service
    .from("candidates")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let candidateId: string;
  if (existingCand) {
    candidateId = existingCand.id;
    await service
      .from("candidates")
      .update({
        full_name: name,
        phone,
        cpf: body.candidate?.cpf ?? null,
      })
      .eq("id", candidateId);
  } else {
    const { data: newCand, error: candErr } = await service
      .from("candidates")
      .insert({
        full_name: name,
        email,
        phone,
        cpf: body.candidate?.cpf ?? null,
      })
      .select("id")
      .single();
    if (candErr || !newCand) {
      return json({ error: "erro_candidato", detail: candErr?.message }, 500);
    }
    candidateId = newCand.id;
  }

  // ---- Create job_application -----------------------------------------------
  const insertAppPayload = {
    job_opening_id: body.job_opening_id ?? null,
    candidate_id: candidateId,
    area,
    stage: "novo",
    stage_position: 0,
    source: "site",
    pre_screening_status: "pending",
    lgpd_consent_at: new Date().toISOString(),
    lgpd_consent_version: lgpdVersion,
    lgpd_consent_ip: clientIp,
  };

  const insertApplication = () => service
    .from("job_applications")
    .insert(insertAppPayload)
    .select("id")
    .single();

  let appResult = await insertApplication();

  // Recuperação condicional em caso de candidatura duplicada (unique violation).
  // Regras:
  //   pre_screening_status != 'completed'     → RETOMAR entrevista existente
  //   pre_screening_status == 'completed':
  //     stage == 'descartado'                → SUBSTITUIR (apaga e recria)
  //     stage outro (pipeline ativo)         → BLOQUEAR (aguardar contato)
  if (appResult.error && (appResult.error as { code?: string }).code === "23505") {
    // Busca a candidatura conflitante (mesmo candidato + mesma vaga, ou
    // mesmo candidato + mesma área para reserva).
    let existingQ = service
      .from("job_applications")
      .select("id, stage, pre_screening_status, area")
      .eq("candidate_id", candidateId);
    existingQ = body.job_opening_id
      ? existingQ.eq("job_opening_id", body.job_opening_id)
      : existingQ.is("job_opening_id", null).eq("area", area);
    const { data: existing } = await existingQ.maybeSingle();

    if (!existing) {
      // Conflito sem registro localizável — estado inconsistente.
      return json({ error: "erro_candidatura", detail: appResult.error.message }, 500);
    }

    if (existing.pre_screening_status === "completed") {
      if (existing.stage === "descartado") {
        // Substitui: cascade remove session + registros atrelados.
        await service.from("job_applications").delete().eq("id", existing.id);
        appResult = await insertApplication();
      } else {
        return json({
          error: "candidatura_ativa",
          detail: "Você já possui uma candidatura ativa em nosso processo. Aguarde o contato da instituição.",
        });
      }
    } else {
      // Retomar: devolve token da sessão existente (ou regenera se expirada).
      const { data: existingSess } = await service
        .from("pre_screening_sessions")
        .select("id, token, status, expires_at")
        .eq("application_id", existing.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const expired = existingSess ? new Date(existingSess.expires_at) < new Date() : true;
      const inactive = existingSess?.status !== "active";
      let resumeToken = existingSess?.token ?? null;

      if (!existingSess || expired || inactive) {
        const newToken = b64urlRandom(32);
        const newExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        if (existingSess) {
          await service
            .from("pre_screening_sessions")
            .update({ token: newToken, status: "active", expires_at: newExpires })
            .eq("id", existingSess.id);
        } else {
          const { data: freshSess } = await service
            .from("pre_screening_sessions")
            .insert({
              application_id: existing.id,
              token: newToken,
              area: existing.area,
              status: "active",
              client_ip: clientIp,
              user_agent: userAgent,
            })
            .select("id")
            .single();
          if (freshSess) {
            await service
              .from("job_applications")
              .update({
                pre_screening_session_id: freshSess.id,
                pre_screening_status: "running",
              })
              .eq("id", existing.id);
          }
        }
        resumeToken = newToken;
      }

      return json({
        application_id: existing.id,
        session_token: resumeToken!,
        area: existing.area,
        job_title: jobTitle,
        resumed: true,
      });
    }
  }

  if (appResult.error || !appResult.data) {
    return json({ error: "erro_candidatura", detail: appResult.error?.message }, 500);
  }
  const applicationId = appResult.data.id;

  // ---- Upload resume ---------------------------------------------------------
  const { bytes } = parseBase64(resume.content_base64);
  const extFromMime: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
  };
  const ext = extFromMime[resume.mime_type] ?? "bin";
  const storagePath = `_recruitment/${applicationId}/resume.${ext}`;

  const { error: upErr } = await service.storage
    .from("hr-documents")
    .upload(storagePath, bytes, {
      contentType: resume.mime_type,
      upsert: true,
    });
  if (upErr) {
    return json({ error: "erro_upload", detail: upErr.message }, 500);
  }

  await service
    .from("job_applications")
    .update({ resume_path: storagePath })
    .eq("id", applicationId);

  // ---- Resume extractor ------------------------------------------------------
  // O cliente faz PDF→texto via pdfjs e envia em `extracted_text`. Para JPEG/PNG
  // o agente pode lidar com texto OCR opcional — neste MVP mandamos um marcador.
  const resumeText = (resume.extracted_text ?? "").trim()
    || "[Arquivo enviado como imagem/PDF sem texto extraível — orient-se pelos campos do formulário.]";

  const extractorCtx = {
    area,
    job_title: jobTitle ?? "",
    candidate_name: name,
    candidate_email: email,
    candidate_phone: phone,
    resume_text: resumeText,
  };
  const extractorRes = await callOrchestrator(
    supabaseUrl,
    serviceKey,
    "resume_extractor",
    extractorCtx,
  );
  let extractedPayload: Record<string, unknown> | null = null;
  if (extractorRes.ok) {
    const parsed = safeJsonParse(extractorRes.text);
    if (parsed && typeof parsed === "object") {
      extractedPayload = parsed as Record<string, unknown>;
      await service
        .from("job_applications")
        .update({ extracted_payload: extractedPayload })
        .eq("id", applicationId);
    }
  }

  // ---- Resume screener (apenas se houver vaga) ------------------------------
  if (body.job_opening_id && extractedPayload) {
    const screenerRes = await callOrchestrator(
      supabaseUrl,
      serviceKey,
      "resume_screener",
      {
        area,
        job_title: jobTitle ?? "",
        job_requirements: jobRequirements ?? "",
        extracted_payload: extractedPayload,
      },
    );
    if (screenerRes.ok) {
      const parsed = safeJsonParse(screenerRes.text);
      if (parsed && typeof parsed === "object") {
        const p = parsed as { score?: number; summary?: string };
        await service
          .from("job_applications")
          .update({
            screener_score: typeof p.score === "number" ? p.score : null,
            screener_summary: p.summary ?? null,
            screener_payload: parsed,
            screened_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
      }
    }
  }

  // ---- Create pre_screening_session -----------------------------------------
  const token = b64urlRandom(32);

  const { data: session, error: sessErr } = await service
    .from("pre_screening_sessions")
    .insert({
      application_id: applicationId,
      token,
      area,
      status: "active",
      client_ip: clientIp,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (sessErr || !session) {
    return json({ error: "erro_sessao", detail: sessErr?.message }, 500);
  }

  await service
    .from("job_applications")
    .update({
      pre_screening_session_id: session.id,
      pre_screening_status: "running",
    })
    .eq("id", applicationId);

  // ---- Audit log (best-effort) ----------------------------------------------
  await service.from("audit_logs").insert({
    action: "create",
    module: "rh-candidatos",
    record_id: applicationId,
    description: `Candidatura pública criada (área ${area}${jobTitle ? `, vaga "${jobTitle}"` : ', base reserva'})`,
    new_data: {
      candidate_id: candidateId,
      area,
      job_opening_id: body.job_opening_id ?? null,
      source: "site",
      lgpd_version: lgpdVersion,
    },
    ip_address: clientIp,
    user_agent: userAgent,
  }).then(() => {}, () => {}); // ignora erro de log — não bloqueia resposta

  return json({
    application_id: applicationId,
    session_token: token,
    area,
    job_title: jobTitle,
    extracted: !!extractedPayload,
  });
});
