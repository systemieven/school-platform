/**
 * bulk-import-users — cria em lote admin users a partir da Central de Migracao.
 *
 * Reusa a logica de create-admin-user (auth.users + profiles update) para cada
 * item do array. Retorna contagem de {inserted, errors} compativel com o
 * contrato de `insertBatch` do ModuleImportWizard.
 *
 * Auth: caller precisa ser super_admin ou admin (mesma regra do single create).
 * Admin NAO pode criar super_admin.
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

interface UserInput {
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  sector_keys?: string[];
}

const VALID_ROLES = ['super_admin', 'admin', 'coordinator', 'teacher', 'student', 'user'];

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

    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role))
      return json({ error: 'Forbidden: insufficient role' }, 403);

    const body = await req.json();
    const users = body?.users as UserInput[] | undefined;
    if (!Array.isArray(users) || users.length === 0)
      return json({ error: 'Body deve conter `users: UserInput[]` nao vazio' }, 400);

    let inserted = 0;
    let errors = 0;
    const failures: { email: string; error: string }[] = [];

    for (const u of users) {
      try {
        if (!u.email || !u.full_name || !u.role) {
          errors++;
          failures.push({ email: u.email ?? '(sem email)', error: 'Campos obrigatorios faltando' });
          continue;
        }
        if (!VALID_ROLES.includes(u.role)) {
          errors++;
          failures.push({ email: u.email, error: `Role invalido: ${u.role}` });
          continue;
        }
        if (callerProfile.role === 'admin' && u.role === 'super_admin') {
          errors++;
          failures.push({ email: u.email, error: 'Admin nao pode criar super_admin' });
          continue;
        }

        const temp_password = generateTempPassword();
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: temp_password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });

        if (createError || !newUser?.user) {
          errors++;
          failures.push({ email: u.email, error: createError?.message ?? 'Falha ao criar auth user' });
          continue;
        }

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            phone: u.phone || null,
            sector_keys: Array.isArray(u.sector_keys) ? u.sector_keys : [],
            is_active: true,
            must_change_password: true,
          })
          .eq('id', newUser.user.id);

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
          errors++;
          failures.push({ email: u.email, error: `Profile update: ${profileError.message}` });
          continue;
        }

        inserted++;
      } catch (err) {
        errors++;
        failures.push({
          email: u.email ?? '(sem email)',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return json({ inserted, errors, failures });
  } catch (err) {
    console.error('bulk-import-users unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
