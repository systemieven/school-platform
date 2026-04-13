import { supabase } from './supabase';

interface AuditParams {
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'status_change' | 'role_change' | 'move' | 'import';
  module: string;
  recordId?: string;
  description: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export async function logAudit({ action, module, recordId, description, oldData, newData }: AuditParams) {
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_module: module,
      p_record_id: recordId ?? null,
      p_description: description,
      p_old_data: oldData ?? null,
      p_new_data: newData ?? null,
    });
  } catch (e) {
    console.error('[audit] failed to log:', e);
  }
}
