import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Candidate } from './useCandidates';
import type { JobOpening } from './useJobOpenings';

export type ApplicationStage =
  | 'novo'
  | 'triagem'
  | 'entrevista'
  | 'proposta'
  | 'contratado'
  | 'descartado';

export const STAGE_ORDER: ApplicationStage[] = [
  'novo',
  'triagem',
  'entrevista',
  'proposta',
  'contratado',
  'descartado',
];

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  novo: 'Novos',
  triagem: 'Triagem',
  entrevista: 'Entrevista',
  proposta: 'Proposta',
  contratado: 'Contratados',
  descartado: 'Descartados',
};

export const STAGE_COLOR: Record<ApplicationStage, string> = {
  novo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  triagem: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  entrevista: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  proposta: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  contratado: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  descartado: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export interface JobApplication {
  id: string;
  job_opening_id: string;
  candidate_id: string;
  stage: ApplicationStage;
  stage_position: number;
  source: string | null;
  resume_path: string | null;
  screener_score: number | null;
  screener_summary: string | null;
  screener_payload: Record<string, unknown> | null;
  screened_at: string | null;
  interview_report: string | null;
  interview_payload: Record<string, unknown> | null;
  rejected_reason: string | null;
  hired_staff_id: string | null;
  hired_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationWithRelations extends JobApplication {
  candidate: Candidate | null;
  job_opening: Pick<JobOpening, 'id' | 'title' | 'department' | 'employment_type'> | null;
}

export type JobApplicationInput = Omit<
  JobApplication,
  'id' | 'created_by' | 'created_at' | 'updated_at' | 'hired_staff_id' | 'hired_at'
>;

export function useJobApplications(jobOpeningId?: string) {
  const [rows, setRows] = useState<JobApplicationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from('job_applications')
      .select(
        '*, candidate:candidates(*), job_opening:job_openings(id, title, department, employment_type)',
      )
      .order('stage_position', { ascending: true });
    if (jobOpeningId) q = q.eq('job_opening_id', jobOpeningId);
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data ?? []) as JobApplicationWithRelations[]);
    setLoading(false);
  }, [jobOpeningId]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load, setRows };
}

export async function createJobApplication(
  input: Partial<JobApplicationInput>,
): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as JobApplication;
}

export async function updateJobApplication(
  id: string,
  patch: Partial<JobApplicationInput>,
): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as JobApplication;
}

export async function deleteJobApplication(id: string): Promise<void> {
  const { error } = await supabase.from('job_applications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function moveApplicationStage(
  id: string,
  stage: ApplicationStage,
  stage_position = 0,
  rejected_reason?: string | null,
): Promise<JobApplication> {
  const patch: Partial<JobApplicationInput> = { stage, stage_position };
  if (stage === 'descartado' && rejected_reason !== undefined) {
    patch.rejected_reason = rejected_reason;
  }
  return updateJobApplication(id, patch);
}

/**
 * Upload de CV para `hr-documents/_recruitment/{application_id}/resume.pdf`.
 * Atualiza resume_path na candidatura e retorna o path.
 */
export async function uploadApplicationResume(
  application_id: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const path = `_recruitment/${application_id}/resume.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from('hr-documents')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' });
  if (uploadErr) throw new Error(uploadErr.message);
  await updateJobApplication(application_id, { resume_path: path });
  return path;
}

export async function getApplicationResumeSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('hr-documents')
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Chama o RPC que cria o staff a partir da candidatura (idempotente). */
export async function promoteCandidateToStaff(application_id: string): Promise<string> {
  const { data, error } = await supabase.rpc('promote_candidate_to_staff', {
    p_application_id: application_id,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
