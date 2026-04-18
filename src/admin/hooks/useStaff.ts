import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export type EmploymentType = 'clt' | 'pj' | 'estagio' | 'terceirizado';

export interface Staff {
  id: string;
  profile_id: string | null;

  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;

  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;

  position: string;
  department: string | null;
  hire_date: string;
  termination_date: string | null;
  employment_type: EmploymentType;

  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;

  avatar_url: string | null;
  is_active: boolean;
  notes: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type StaffInput = Omit<Staff, 'id' | 'profile_id' | 'created_by' | 'created_at' | 'updated_at'>;

export function useStaff() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) setError(error.message);
    setRows((data ?? []) as Staff[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, error, reload: load, setRows };
}

export async function createStaff(input: Partial<StaffInput>): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Staff;
}

export async function updateStaff(id: string, patch: Partial<StaffInput>): Promise<Staff> {
  const { data, error } = await supabase
    .from('staff')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Staff;
}

export async function deleteStaff(id: string): Promise<void> {
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function grantStaffAccess(staff_id: string, role: 'coordinator' | 'teacher' | 'user') {
  const { data, error } = await supabase.functions.invoke('staff-grant-access', {
    body: { staff_id, role },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { profile_id: string; temp_password: string; email: string; role: string };
}

export async function revokeStaffAccess(staff_id: string) {
  const { data, error } = await supabase.functions.invoke('staff-revoke-access', {
    body: { staff_id },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as { revoked_profile_id: string };
}
