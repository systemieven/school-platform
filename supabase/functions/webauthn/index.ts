/**
 * webauthn
 *
 * Gerencia o ciclo de vida de credenciais WebAuthn para o portal do responsável.
 *
 * Auth: Authorization: Bearer <guardian_jwt>  (Supabase auth session do responsável)
 *
 * Actions:
 *   generate-challenge  → gera e armazena um challenge de 32 bytes (TTL 5min)
 *   register            → valida challenge + armazena credentialId
 *   authenticate        → valida challenge + verifica credentialId pertence ao guardião
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function randomBase64url(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Verificar JWT do guardião
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const guardianId = user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = body.action as string;

  // ── generate-challenge ──────────────────────────────────────────────────────
  if (action === "generate-challenge") {
    const purpose = (body.purpose as string) === "register" ? "register" : "auth";
    const challenge = randomBase64url(32);

    const { data, error } = await serviceClient
      .from("webauthn_challenges")
      .insert({ guardian_id: guardianId, challenge, purpose })
      .select("id")
      .single();

    if (error || !data) return json({ error: "Failed to create challenge" }, 500);

    console.log(`[webauthn] challenge generated guardian=${guardianId} purpose=${purpose}`);
    return json({ challengeId: data.id, challenge });
  }

  // ── register ────────────────────────────────────────────────────────────────
  if (action === "register") {
    const { challengeId, credentialId, deviceName, publicKey } = body;
    if (!challengeId || !credentialId) return json({ error: "Missing fields" }, 400);

    // Validar challenge
    const { data: ch } = await serviceClient
      .from("webauthn_challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("guardian_id", guardianId)
      .eq("purpose", "register")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!ch) return json({ error: "Invalid or expired challenge" }, 400);

    // Marcar como usado
    await serviceClient.from("webauthn_challenges").update({ used: true }).eq("id", challengeId);

    // Inserir credencial
    const { error: insErr } = await serviceClient.from("webauthn_credentials").insert({
      guardian_id:   guardianId,
      credential_id: credentialId as string,
      public_key:    (publicKey as string) ?? null,
      device_name:   (deviceName as string) || "Dispositivo",
    });

    if (insErr) {
      if (insErr.message.includes("unique")) return json({ error: "Credential already registered" }, 409);
      return json({ error: insErr.message }, 500);
    }

    console.log(`[webauthn] registered guardian=${guardianId} device=${deviceName}`);
    return json({ registered: true });
  }

  // ── authenticate ────────────────────────────────────────────────────────────
  if (action === "authenticate") {
    const { challengeId, credentialId } = body;
    if (!challengeId || !credentialId) return json({ error: "Missing fields" }, 400);

    // Validar challenge
    const { data: ch } = await serviceClient
      .from("webauthn_challenges")
      .select("*")
      .eq("id", challengeId)
      .eq("guardian_id", guardianId)
      .eq("purpose", "auth")
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!ch) return json({ error: "Invalid or expired challenge" }, 400);

    // Verificar que credentialId pertence a este guardião
    const { data: cred } = await serviceClient
      .from("webauthn_credentials")
      .select("id")
      .eq("guardian_id", guardianId)
      .eq("credential_id", credentialId as string)
      .single();

    if (!cred) return json({ error: "Credential not found for this guardian" }, 403);

    // Marcar challenge como usado + atualizar last_used_at
    await Promise.all([
      serviceClient.from("webauthn_challenges").update({ used: true }).eq("id", challengeId),
      serviceClient.from("webauthn_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", cred.id),
    ]);

    console.log(`[webauthn] authenticated guardian=${guardianId}`);
    return json({ verified: true });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
