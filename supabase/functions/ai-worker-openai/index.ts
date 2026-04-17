/**
 * ai-worker-openai
 *
 * POST /ai-worker-openai
 * Auth: service_role (chamado pelo ai-orchestrator).
 *
 * Body: { model: string, system: string, user: string, temperature: number, max_tokens: number }
 * Response: { text, input_tokens, output_tokens } | { error }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return json({ error: "OPENAI_API_KEY ausente" }, 500);

  let body: { model?: string; system?: string; user?: string; temperature?: number; max_tokens?: number };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { model, system, user, temperature, max_tokens } = body;
  if (!model || !user) return json({ error: "model e user sao obrigatorios" }, 400);

  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.2,
      max_tokens: max_tokens ?? 1024,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({
      error: data?.error?.message ?? `OpenAI HTTP ${res.status}`,
      detail: data,
    }, 502);
  }

  const text = data?.choices?.[0]?.message?.content ?? "";

  return json({
    text,
    input_tokens: data?.usage?.prompt_tokens ?? null,
    output_tokens: data?.usage?.completion_tokens ?? null,
  });
});
