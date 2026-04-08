import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Generates a cryptographically random temporary password that satisfies
 *  basic complexity: at least one uppercase, one digit, one special char. */
function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!%?';
  const all     = upper + lower + digits + special;

  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];

  // Guarantee at least one of each required class
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];

  // Fill up to 12 chars total
  const extra = Array.from({ length: 8 }, () => rand(all));

  // Shuffle
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single();

  if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden: insufficient role' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { email, full_name, role, phone } = await req.json();
  if (!email || !full_name || !role) {
    return new Response(JSON.stringify({ error: 'Missing required fields: email, full_name, role' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (callerProfile.role === 'admin' && role === 'super_admin') {
    return new Response(JSON.stringify({ error: 'Admin cannot create super_admin users' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate temporary password — returned to caller so they can send via WhatsApp
  const temp_password = generateTempPassword();

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !newUser.user) {
    return new Response(JSON.stringify({ error: createError?.message ?? 'Failed to create user' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      email,
      full_name,
      role,
      phone: phone ?? null,
      is_active: true,
      must_change_password: true,
    })
    .select().single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ profile, temp_password }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
