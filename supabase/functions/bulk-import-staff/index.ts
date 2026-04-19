/**
 * bulk-import-staff — cria em lote colaboradores RH (tabela `staff`) a partir
 * da Central de Migracao.
 *
 * Diferente de `bulk-import-users`: aqui NAO cria auth.user nem profile. Apenas
 * insere linhas em `staff`, que e o cadastro RH autonomo. A promocao para
 * login (auth + profile) acontece item por item via `staff-grant-access`.
 *
 * Auth: super_admin/admin sempre passam; coordinator passa se tiver
 * `can_create=true` em `rh-colaboradores` (role_permissions).
 *
 * Body: { staff: StaffInput[] }
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

interface StaffInput {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  rg?: string | null;
  birth_date?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  position: string;
  department?: string | null;
  hire_date?: string | null;
  employment_type: string;
}

const VALID_EMPLOYMENT_TYPES = ['clt', 'pj', 'estagio', 'terceirizado'];

function onlyDigits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
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

    if (!callerProfile) return json({ error: 'Forbidden: profile not found' }, 403);

    let authorized = ['super_admin', 'admin'].includes(callerProfile.role);
    if (!authorized && callerProfile.role === 'coordinator') {
      const { data: perm } = await supabaseAdmin
        .from('role_permissions')
        .select('can_create')
        .eq('role', 'coordinator')
        .eq('module_key', 'rh-colaboradores')
        .maybeSingle();
      authorized = !!perm?.can_create;
    }
    if (!authorized) return json({ error: 'Forbidden: insufficient role' }, 403);

    const body = await req.json();
    const staffInput = body?.staff as StaffInput[] | undefined;
    if (!Array.isArray(staffInput) || staffInput.length === 0)
      return json({ error: 'Body deve conter `staff: StaffInput[]` nao vazio' }, 400);

    // Dedup contra CPFs ja existentes (normalizados para digitos)
    const { data: existing } = await supabaseAdmin
      .from('staff').select('cpf').not('cpf', 'is', null);
    const existingCpfs = new Set(
      (existing ?? [])
        .map((r: { cpf: string | null }) => onlyDigits(r.cpf))
        .filter(Boolean),
    );

    let inserted = 0;
    let errors = 0;
    const failures: { full_name: string; error: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const s of staffInput) {
      try {
        const fullName = (s.full_name ?? '').trim();
        if (!fullName) {
          errors++;
          failures.push({ full_name: '(sem nome)', error: 'full_name é obrigatório' });
          continue;
        }
        const position = (s.position ?? '').trim();
        if (!position) {
          errors++;
          failures.push({ full_name: fullName, error: 'position é obrigatório' });
          continue;
        }
        const employment_type = (s.employment_type ?? '').trim().toLowerCase();
        if (!VALID_EMPLOYMENT_TYPES.includes(employment_type)) {
          errors++;
          failures.push({ full_name: fullName, error: `employment_type inválido: ${employment_type}` });
          continue;
        }

        const cpf = onlyDigits(s.cpf);
        if (cpf) {
          if (cpf.length !== 11) {
            errors++;
            failures.push({ full_name: fullName, error: 'CPF deve ter 11 dígitos' });
            continue;
          }
          if (existingCpfs.has(cpf)) {
            errors++;
            failures.push({ full_name: fullName, error: `CPF ${cpf} já cadastrado` });
            continue;
          }
        }

        const record = {
          full_name: fullName,
          email: s.email?.trim().toLowerCase() || null,
          phone: onlyDigits(s.phone) || null,
          cpf: cpf || null,
          rg: s.rg?.trim() || null,
          birth_date: s.birth_date || null,
          address_street: s.address_street?.trim() || null,
          address_number: s.address_number?.trim() || null,
          address_complement: s.address_complement?.trim() || null,
          address_neighborhood: s.address_neighborhood?.trim() || null,
          address_city: s.address_city?.trim() || null,
          address_state: s.address_state?.trim() || null,
          address_zip: onlyDigits(s.address_zip) || null,
          position,
          department: s.department?.trim() || null,
          hire_date: s.hire_date || today,
          employment_type,
          is_active: true,
          created_by: user.id,
        };

        const { error: insertError } = await supabaseAdmin.from('staff').insert(record);

        if (insertError) {
          errors++;
          failures.push({ full_name: fullName, error: insertError.message });
          continue;
        }

        if (cpf) existingCpfs.add(cpf);
        inserted++;
      } catch (err) {
        errors++;
        failures.push({
          full_name: s.full_name ?? '(sem nome)',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return json({ inserted, errors, failures });
  } catch (err) {
    console.error('bulk-import-staff unhandled error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
