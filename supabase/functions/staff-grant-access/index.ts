/**
 * staff-grant-access — promove um registro em `staff` para usuário do sistema.
 *
 * Fluxo:
 *  1. Valida JWT do caller (deve estar autenticado).
 *  2. Caller precisa de `users.can_create=true` E `rh-colaboradores.can_edit=true`
 *     via `get_effective_permissions` (OU ser super_admin/admin).
 *  3. Valida `role ∈ {coordinator,teacher,user}` — super_admin/admin NUNCA
 *     criados por esta rota (continuam exclusivos do super_admin via UsersPage).
 *  4. Valida `staff.profile_id IS NULL` (409 se já promovido).
 *  5. `auth.admin.createUser` com temp password + `must_change_password=true`.
 *  6. UPDATE `profiles` (email, full_name, phone, role, is_active=true).
 *  7. UPDATE `staff.profile_id = <novo profile>`.
 *  8. Retorna { profile_id, temp_password }.
 *
 * Em caso de falha parcial, faz best-effort rollback do auth user.
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

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!%?';
  const all     = upper + lower + digits + special;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const extra = Array.from({ length: 8 }, () => rand(all));
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const ALLOWED_ROLES = ['coordinator', 'teacher', 'user'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

interface Body {
  staff_id?: string;
  role?: string;
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

    // Permission check: super_admin/admin bypass; outros precisam da dupla permissão.
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
    if (!body?.role || !ALLOWED_ROLES.includes(body.role as AllowedRole)) {
      return json({
        error: `Role inválida. Permitidas: ${ALLOWED_ROLES.join(', ')} (super_admin/admin não são criados por esta rota)`,
      }, 400);
    }
    const role = body.role as AllowedRole;

    // Carrega staff
    const { data: staff, error: staffErr } = await supabaseAdmin
      .from('staff')
      .select('id, profile_id, full_name, email, phone')
      .eq('id', body.staff_id)
      .single();
    if (staffErr || !staff) return json({ error: 'Colaborador não encontrado' }, 404);
    if (!staff.email) return json({ error: 'Colaborador sem email — preencha antes de criar acesso' }, 400);
    if (staff.profile_id) return json({ error: 'Colaborador já possui acesso ao sistema' }, 409);

    // Cria auth user
    const temp_password = generateTempPassword();
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: staff.email,
      password: temp_password,
      email_confirm: true,
      user_metadata: { full_name: staff.full_name },
    });
    if (createError || !newUser?.user) {
      return json({ error: createError?.message ?? 'Falha ao criar auth user' }, 500);
    }
    const newProfileId = newUser.user.id;

    // Preenche profile (o trigger handle_new_user já criou a linha com email/full_name defaults)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: staff.email,
        full_name: staff.full_name,
        phone: staff.phone ?? null,
        role,
        is_active: true,
        must_change_password: true,
      })
      .eq('id', newProfileId);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newProfileId).catch(() => {});
      return json({ error: `Profile update: ${profileError.message}` }, 500);
    }

    // Linka staff → profile
    const { error: linkError } = await supabaseAdmin
      .from('staff')
      .update({ profile_id: newProfileId })
      .eq('id', staff.id);
    if (linkError) {
      // Rollback: remove auth user (cascade em profiles)
      await supabaseAdmin.auth.admin.deleteUser(newProfileId).catch(() => {});
      return json({ error: `Link staff→profile: ${linkError.message}` }, 500);
    }

    return json({
      profile_id: newProfileId,
      temp_password,
      email: staff.email,
      role,
    });
  } catch (err) {
    console.error('staff-grant-access unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
