import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { EmploymentType } from './useStaff';

export type JobStatus = 'draft' | 'published' | 'paused' | 'closed';

export interface JobOpening {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  description: string | null;
  requirements: string | null;
  employment_type: EmploymentType;
  salary_range_min: number | null;
  salary_range_max: number | null;
  status: JobStatus;
  opened_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type JobOpeningInput = Omit<
  JobOpening,
  'id' | 'opened_at' | 'closed_at' | 'created_by' | 'created_at' | 'updated_at'
>;

export function useJobOpenings(statusFilter?: JobStatus | 'all') {
  const [rows, setRows] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase.from('job_openings').select('*').order('created_at', { ascending: false });
    if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data ?? []) as JobOpening[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load, setRows };
}

export async function createJobOpening(input: Partial<JobOpeningInput>): Promise<JobOpening> {
  const { data, error } = await supabase.from('job_openings').insert(input).select('*').single();
  if (error) throw new Error(error.message);
  return data as JobOpening;
}

export async function updateJobOpening(id: string, patch: Partial<JobOpeningInput>): Promise<JobOpening> {
  const { data, error } = await supabase
    .from('job_openings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as JobOpening;
}

export async function deleteJobOpening(id: string): Promise<void> {
  const { error } = await supabase.from('job_openings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
