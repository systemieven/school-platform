/**
 * staff-revoke-access — remove o acesso ao sistema de um colaborador.
 *
 * Fluxo:
 *  1. Valida JWT e permissões (mesma regra do grant: super_admin/admin bypass,
 *     outros precisam de `users.can_create` + `rh-colaboradores.can_edit`).
 *  2. Carrega `staff` pelo `staff_id`.
 *  3. Soft-delete do profile: `is_active=false` (NÃO deleta `auth.users`
 *     pra preservar `audit_logs`).
 *  4. Zera `staff.profile_id` (volta a ser colaborador sem acesso).
 *
 * Retorna { revoked_profile_id }.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface Body {
  staff_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single();
    if (!callerProfile) return json({ error: 'Profile not found' }, 403);

    const isAdmin = callerProfile.role === 'super_admin' || callerProfile.role === 'admin';
    if (!isAdmin) {
      const { data: perms } = await supabaseAdmin
        .rpc('get_effective_permissions', { p_user_id: user.id });
      const byModule = Object.fromEntries(
        (perms ?? []).map((p: { module_key: string; can_create: boolean; can_edit: boolean }) =>
          [p.module_key, p]
        ),
      );
      const canCreateUsers = byModule['users']?.can_create === true;
      const canEditRh      = byModule['rh-colaboradores']?.can_edit === true;
      if (!canCreateUsers || !canEditRh) {
        return json({
          error: 'Forbidden: requer users.can_create + rh-colaboradores.can_edit',
        }, 403);
      }
    }

    const body = (await req.json()) as Body;
    if (!body?.staff_id) return json({ error: '`staff_id` obrigatório' }, 400);

    const { data: staff, error: staffErr } = await supabaseAdmin
      .from('staff')
      .select('id, profile_id')
      .eq('id', body.staff_id)
      .single();
    if (staffErr || !staff) return json({ error: 'Colaborador não encontrado' }, 404);
    if (!staff.profile_id) return json({ error: 'Colaborador não possui acesso ativo' }, 409);

    const revokedProfileId = staff.profile_id;

    // Proteção contra auto-revocação e contra revogar super_admin/admin
    if (revokedProfileId === user.id) {
      return json({ error: 'Não é possível revogar o próprio acesso' }, 400);
    }
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', revokedProfileId).single();
    if (targetProfile && ['super_admin', 'admin'].includes(targetProfile.role)) {
      return json({ error: 'Não é possível revogar acesso de admin/super_admin por esta rota' }, 403);
    }

    // Soft-delete do profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', revokedProfileId);
    if (profileErr) return json({ error: `Profile deactivate: ${profileErr.message}` }, 500);

    // Zera profile_id do staff (ON DELETE SET NULL já cobre delete de profile,
    // mas aqui fazemos soft-delete, então precisamos zerar manualmente).
    const { error: unlinkErr } = await supabaseAdmin
      .from('staff')
      .update({ profile_id: null })
      .eq('id', staff.id);
    if (unlinkErr) return json({ error: `Unlink staff: ${unlinkErr.message}` }, 500);

    return json({ revoked_profile_id: revokedProfileId });
  } catch (err) {
    console.error('staff-revoke-access unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
