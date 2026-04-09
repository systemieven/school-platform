/**
 * attendance-feedback
 *
 * Recebe a avaliacao do cliente apos o atendimento ser finalizado.
 * Valida que o ticket exista, esteja em status 'finished' e que o envio
 * esteja dentro de uma janela de 24h apos finished_at.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const ticket_id: string = body.ticket_id;
    const rating: number | null =
      typeof body.rating === "number" ? body.rating : null;
    const answers: Record<string, unknown> = body.answers || {};
    const comments: string | null = body.comments || null;

    if (!ticket_id) {
      return json({ error: "invalid_ticket" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: ticket, error: tErr } = await supabase
      .from("attendance_tickets")
      .select("id, status, finished_at, feedback_id")
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) {
      return json({ error: "ticket_not_found" }, 404);
    }
    if (ticket.feedback_id) {
      return json({ error: "already_submitted" }, 409);
    }
    if (ticket.status !== "finished" || !ticket.finished_at) {
      return json({ error: "ticket_not_finished" }, 400);
    }
    const elapsed = Date.now() - new Date(ticket.finished_at).getTime();
    if (elapsed > WINDOW_MS) {
      return json({ error: "feedback_window_expired" }, 400);
    }

    const { data: fb, error: fbErr } = await supabase
      .from("attendance_feedback")
      .insert({ ticket_id, rating, answers, comments })
      .select("id")
      .single();
    if (fbErr || !fb) {
      return json({ error: "insert_failed", message: fbErr?.message }, 500);
    }

    await supabase
      .from("attendance_tickets")
      .update({ feedback_id: fb.id })
      .eq("id", ticket_id);

    await supabase.from("attendance_history").insert({
      ticket_id,
      event_type: "feedback_submitted",
      description: `Feedback recebido${rating ? ` com nota ${rating}` : ""}.`,
      new_value: rating !== null ? String(rating) : null,
    });

    return json({ ok: true, feedback_id: fb.id });
  } catch (err) {
    return json({ error: "unexpected", message: (err as Error).message }, 500);
  }
});
