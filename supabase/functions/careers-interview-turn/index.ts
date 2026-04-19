/**
 * careers-interview-turn
 *
 * Endpoint público chamado pelo chat do /trabalhe-conosco. Cada turno:
 *   1. Valida `session_token` (tabela `pre_screening_sessions`, status='active'
 *      e não expirado).
 *   2. Anexa `user_message` ao array `messages`.
 *   3. Monta contexto (área, vaga, resumo do CV, histórico) e chama
 *      `ai-orchestrator` com `pre_screening_interviewer`.
 *   4. Faz parse do JSON de resposta
 *      `{ assistant_message, should_finalize, final_report? }`.
 *   5. Anexa a mensagem do assistente ao histórico e, se `should_finalize`,
 *      finaliza a sessão + popula
 *      `job_applications.interview_report`/`interview_payload`.
 *   6. Retorna `{ assistant_message, should_finalize }`.
 *
 * Sem JWT. Autenticação por token opaco no body.
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

function safeJsonParse(text: string): unknown {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fallthrough */ } }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch { /* ignore */ }
  }
  return null;
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

interface TurnBody {
  session_token?: string;
  user_message?: string;
  /** Marca a primeira chamada (candidato abriu o chat) — mensagem inicial vem do agente. */
  start?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  at: string;
}

interface FinalReport {
  markdown?: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Limite generoso por IP — o usuário fala alguns turnos por minuto.
  const rl = rateLimit(req, { maxRequests: 60, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl, CORS);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey);

  let body: TurnBody;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const token = (body.session_token ?? "").trim();
  if (!token) return json({ error: "token_obrigatorio" }, 400);

  const { data: session, error: sessErr } = await service
    .from("pre_screening_sessions")
    .select("id, application_id, status, area, messages, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (sessErr || !session) return json({ error: "sessao_invalida" }, 404);
  if (session.status !== "active") return json({ error: "sessao_encerrada", status: session.status }, 410);
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await service
      .from("pre_screening_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);
    return json({ error: "sessao_expirada" }, 410);
  }

  // Load application + opening + extracted payload for context
  const { data: app } = await service
    .from("job_applications")
    .select("id, area, job_opening_id, extracted_payload")
    .eq("id", session.application_id)
    .maybeSingle();
  if (!app) return json({ error: "candidatura_nao_encontrada" }, 404);

  let jobTitle: string | null = null;
  let jobRequirements: string | null = null;
  if (app.job_opening_id) {
    const { data: jo } = await service
      .from("job_openings")
      .select("title, requirements")
      .eq("id", app.job_opening_id)
      .maybeSingle();
    if (jo) {
      jobTitle = jo.title;
      jobRequirements = jo.requirements ?? null;
    }
  }

  const history: ChatMessage[] = Array.isArray(session.messages) ? session.messages as ChatMessage[] : [];
  const userMessage = (body.user_message ?? "").trim();

  // Se é o primeiro turno (start=true) e não há histórico, não exigimos user_message.
  const isFirst = history.length === 0 && body.start === true;
  if (!isFirst && !userMessage) return json({ error: "mensagem_vazia" }, 400);
  if (userMessage.length > 4000) return json({ error: "mensagem_muito_longa" }, 400);

  const nextHistory: ChatMessage[] = [...history];
  if (userMessage) {
    nextHistory.push({ role: "user", text: userMessage, at: new Date().toISOString() });
  }

  const extracted = (app.extracted_payload ?? {}) as Record<string, unknown>;
  const resumeSummary = (extracted.summary as string | undefined) ?? "";
  const experience = extracted.experience;
  let experienceHighlights = "";
  if (Array.isArray(experience)) {
    experienceHighlights = experience
      .map((e) => {
        if (typeof e === "string") return `- ${e}`;
        if (e && typeof e === "object") {
          const row = e as Record<string, unknown>;
          return `- ${row.role ?? row.title ?? ""} @ ${row.company ?? ""} (${row.period ?? ""})`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  const historyForPrompt = nextHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const orchestratorRes = await callOrchestrator(
    supabaseUrl,
    serviceKey,
    "pre_screening_interviewer",
    {
      area: app.area,
      job_title: jobTitle ?? "cadastro reserva",
      job_requirements: jobRequirements ?? "",
      resume_summary: resumeSummary,
      experience_highlights: experienceHighlights,
      history: historyForPrompt,
      last_user_message: userMessage,
    },
  );

  if (!orchestratorRes.ok) {
    return json({ error: "erro_agente", detail: orchestratorRes.error }, 502);
  }

  const parsed = safeJsonParse(orchestratorRes.text);
  if (!parsed || typeof parsed !== "object") {
    return json({ error: "resposta_invalida_agente" }, 502);
  }

  const payload = parsed as {
    assistant_message?: string;
    should_finalize?: boolean;
    final_report?: FinalReport | null;
  };
  const assistantMessage = (payload.assistant_message ?? "").trim();
  if (!assistantMessage) {
    return json({ error: "resposta_vazia_agente" }, 502);
  }

  nextHistory.push({ role: "assistant", text: assistantMessage, at: new Date().toISOString() });

  const shouldFinalize = payload.should_finalize === true;
  const finalReport = shouldFinalize ? (payload.final_report ?? null) : null;

  // Persist session state
  const sessionPatch: Record<string, unknown> = {
    messages: nextHistory,
  };
  if (shouldFinalize) {
    sessionPatch.status = "completed";
    sessionPatch.completed_at = new Date().toISOString();
    sessionPatch.final_payload = finalReport;
  }
  await service
    .from("pre_screening_sessions")
    .update(sessionPatch)
    .eq("id", session.id);

  // Persist application summary if finalized
  if (shouldFinalize && finalReport) {
    await service
      .from("job_applications")
      .update({
        pre_screening_status: "completed",
        interview_report: finalReport.markdown ?? null,
        interview_payload: finalReport.payload ?? null,
      })
      .eq("id", session.application_id);
  }

  return json({
    assistant_message: assistantMessage,
    should_finalize: shouldFinalize,
  });
});
