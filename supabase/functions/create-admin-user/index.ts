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
    const { email, full_name, role, phone } = body;

    if (!email || !full_name || !role)
      return json({ error: 'Missing required fields: email, full_name, role' }, 400);

    if (callerProfile.role === 'admin' && role === 'super_admin')
      return json({ error: 'Admin cannot create super_admin users' }, 403);

    const temp_password = generateTempPassword();

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temp_password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser?.user)
      return json({ error: createError?.message ?? 'Failed to create auth user' }, 400);

    // The on_auth_user_created trigger already inserted a minimal profile row.
    // Update it with the full data including role and must_change_password.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        must_change_password: true,
      })
      .eq('id', newUser.user.id)
      .select()
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: `Profile update failed: ${profileError.message}` }, 500);
    }

    if (!profile) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ error: 'Profile not found after update' }, 500);
    }

    return json({ profile, temp_password }, 201);
  } catch (err) {
    console.error('create-admin-user unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
