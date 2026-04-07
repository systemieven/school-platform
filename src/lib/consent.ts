/**
 * consent.ts — Registra aceite de Termos de Uso e Política de Privacidade.
 *
 * Salva no banco: form_type, IP, user-agent, data/hora, nome e e-mail do titular.
 * O IP é obtido via API pública (ipify). Em caso de falha na obtenção do IP,
 * o registro é salvo mesmo assim (campo fica null).
 */

import { supabase } from './supabase';

export type ConsentFormType = 'contact' | 'enrollment' | 'visit' | 'testimonial';

interface SaveConsentParams {
  formType: ConsentFormType;
  holderName?: string;
  holderEmail?: string;
  /** ID do registro relacionado (ex.: enrollment.id, appointment.id) */
  relatedRecordId?: string;
}

async function getClientIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return data.ip ?? null;
  } catch {
    return null;
  }
}

export async function saveConsent({
  formType,
  holderName,
  holderEmail,
  relatedRecordId,
}: SaveConsentParams): Promise<void> {
  const ip = await getClientIp();

  await supabase.from('consent_records').insert({
    form_type:         formType,
    ip_address:        ip,
    user_agent:        navigator.userAgent,
    holder_name:       holderName ?? null,
    holder_email:      holderEmail ?? null,
    related_record_id: relatedRecordId ?? null,
  });
}
