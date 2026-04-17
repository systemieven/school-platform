/**
 * ai-worker-anthropic
 *
 * POST /ai-worker-anthropic
 * Auth: service_role (chamado pelo ai-orchestrator).
 *
 * Body: { model: string, system: string, user: string, temperature: number, max_tokens: number, api_key: string }
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

  let body: { model?: string; system?: string; user?: string; temperature?: number; max_tokens?: number; api_key?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const { model, system, user, temperature, max_tokens, api_key } = body;
  if (!model || !user) return json({ error: "model e user sao obrigatorios" }, 400);
  const apiKey = api_key ?? Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "api_key ausente (configure em /admin/configuracoes?tab=ia)" }, 400);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: max_tokens ?? 1024,
      temperature: temperature ?? 0.2,
      system: system ?? "",
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({
      error: data?.error?.message ?? `Anthropic HTTP ${res.status}`,
      detail: data,
    }, 502);
  }

  const text = Array.isArray(data?.content)
    ? data.content.filter((c: { type?: string }) => c?.type === "text").map((c: { text?: string }) => c.text ?? "").join("")
    : "";

  return json({
    text,
    input_tokens: data?.usage?.input_tokens ?? null,
    output_tokens: data?.usage?.output_tokens ?? null,
  });
});
