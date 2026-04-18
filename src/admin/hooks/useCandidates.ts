import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  cnh: string | null;
  birth_date: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  extracted_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type CandidateInput = Omit<Candidate, 'id' | 'created_at' | 'updated_at'>;

export function useCandidates() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) setError(error.message);
    setRows((data ?? []) as Candidate[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load, setRows };
}

export async function createCandidate(input: Partial<CandidateInput>): Promise<Candidate> {
  const { data, error } = await supabase.from('candidates').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as Candidate;
}

export async function updateCandidate(id: string, patch: Partial<CandidateInput>): Promise<Candidate> {
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Candidate;
}

export async function deleteCandidate(id: string): Promise<void> {
  const { error } = await supabase.from('candidates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Upsert by email — usado pela tela de cadastro manual e pelo fluxo público
 * (PR4). Se já existe candidato com o email, atualiza; senão cria.
 */
export async function upsertCandidateByEmail(input: Partial<CandidateInput>): Promise<Candidate> {
  if (!input.email) throw new Error('Email é obrigatório');
  const { data: existing } = await supabase
    .from('candidates')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();
  if (existing?.id) {
    return updateCandidate(existing.id, input);
  }
  return createCandidate(input);
}
