import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special: boolean;
  password_lifetime_days: number;
  password_history_count: number;
}

const DEFAULT_POLICY: PasswordPolicy = {
  min_length: 8,
  require_uppercase: false,
  require_lowercase: false,
  require_numbers: false,
  require_special: false,
  password_lifetime_days: 0,
  password_history_count: 0,
};

/** SHA-256 hex digest — used for password history comparison (salted with userId). */
async function hashPassword(password: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(password + '::' + userId);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validateComplexity(password: string, policy: PasswordPolicy): string | null {
  if (password.length < policy.min_length)
    return `A senha deve ter pelo menos ${policy.min_length} caracteres.`;
  if (policy.require_uppercase && !/[A-Z]/.test(password))
    return 'A senha deve conter ao menos uma letra maiúscula.';
  if (policy.require_lowercase && !/[a-z]/.test(password))
    return 'A senha deve conter ao menos uma letra minúscula.';
  if (policy.require_numbers && !/[0-9]/.test(password))
    return 'A senha deve conter ao menos um número.';
  if (policy.require_special && !/[^A-Za-z0-9]/.test(password))
    return 'A senha deve conter ao menos um caractere especial.';
  return null;
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

  // Identify caller
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { new_password } = await req.json();
  if (!new_password || typeof new_password !== 'string') {
    return new Response(JSON.stringify({ error: 'new_password is required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Load password policy
  const { data: policySetting } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'password_policy')
    .single();

  const policy: PasswordPolicy = policySetting?.value
    ? { ...DEFAULT_POLICY, ...(policySetting.value as Partial<PasswordPolicy>) }
    : DEFAULT_POLICY;

  // Validate complexity
  const complexityError = validateComplexity(new_password, policy);
  if (complexityError) {
    return new Response(JSON.stringify({ error: complexityError }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check password history
  if (policy.password_history_count > 0) {
    const { data: history } = await supabaseAdmin
      .from('password_history')
      .select('password_hash')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(policy.password_history_count);

    if (history && history.length > 0) {
      const newHash = await hashPassword(new_password, user.id);
      const reused = history.some((h: { password_hash: string }) => h.password_hash === newHash);
      if (reused) {
        return new Response(
          JSON.stringify({ error: `A senha não pode ser igual às últimas ${policy.password_history_count} senhas utilizadas.` }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  // Update password via admin API
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: new_password,
  });

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mark must_change_password = false and record timestamp
  await supabaseAdmin
    .from('profiles')
    .update({ must_change_password: false, password_changed_at: new Date().toISOString() })
    .eq('id', user.id);

  // Store new password hash in history
  const newHash = await hashPassword(new_password, user.id);
  await supabaseAdmin.from('password_history').insert({ user_id: user.id, password_hash: newHash });

  // Trim history to policy limit (keep most recent N)
  if (policy.password_history_count > 0) {
    const { data: allHistory } = await supabaseAdmin
      .from('password_history')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (allHistory && allHistory.length > policy.password_history_count) {
      const toDelete = allHistory.slice(policy.password_history_count).map((h: { id: string }) => h.id);
      await supabaseAdmin.from('password_history').delete().in('id', toDelete);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
