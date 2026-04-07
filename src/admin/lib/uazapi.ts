/**
 * UazAPI integration utilities.
 * All calls go through the `uazapi-proxy` Edge Function so the
 * API token is never exposed on the client.
 */
import { supabase } from '../../lib/supabase';

export const SUPABASE_URL = 'https://dinbwugbwnkrzljuocbs.supabase.co';
export const WEBHOOK_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/uazapi-webhook`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UazApiStatus {
  state: 'connected' | 'connecting' | 'disconnected';
  phone?: string;
  name?: string;
  battery?: number;
  plugged?: boolean;
  qrcode?: string;
  pairingCode?: string;
  [key: string]: unknown;
}

export interface SendTextOptions {
  phone: string;
  text: string;
  templateId?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  recipientName?: string;
  delay?: number;
}

export interface SendResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

// ── Core proxy call ───────────────────────────────────────────────────────────

export async function callProxy(
  path: string,
  method = 'GET',
  payload?: unknown,
): Promise<{ data: unknown; error?: string }> {
  const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
    body: { path, method, payload },
  });
  if (error) return { data: null, error: error.message };
  return { data };
}

// ── Health check ──────────────────────────────────────────────────────────────

export async function checkUazApiStatus(): Promise<{
  connected: boolean;
  status?: UazApiStatus;
  error?: string;
}> {
  const { data, error } = await callProxy('/instance/status', 'GET');
  if (error) return { connected: false, error };
  const status = data as UazApiStatus;
  return { connected: status?.state === 'connected', status };
}

// ── Register webhook ──────────────────────────────────────────────────────────

export async function registerWebhook(webhookUrl: string): Promise<SendResult> {
  const { data, error } = await callProxy('/webhook', 'POST', {
    url: webhookUrl,
    events: ['messages_update'],
    excludeMessages: ['wasSentByApi'],
  });
  if (error) return { success: false, error };
  // Persist webhook_url in system_settings
  await supabase
    .from('system_settings')
    .update({ value: JSON.stringify(webhookUrl) })
    .eq('category', 'uazapi')
    .eq('key', 'webhook_url');
  return { success: true, data };
}

// ── Send text message ─────────────────────────────────────────────────────────

export async function sendWhatsAppText(opts: SendTextOptions): Promise<SendResult> {
  // 1. Create log entry first — its UUID becomes the track_id
  const { data: logEntry, error: logErr } = await supabase
    .from('whatsapp_message_log')
    .insert({
      template_id:      opts.templateId  ?? null,
      recipient_phone:  opts.phone,
      recipient_name:   opts.recipientName ?? null,
      rendered_content: { body: opts.text, type: 'text' },
      status:           'queued',
      related_module:   opts.relatedModule  ?? null,
      related_record_id: opts.relatedRecordId ?? null,
    })
    .select('id')
    .single();

  if (logErr || !logEntry) {
    return { success: false, error: logErr?.message || 'Falha ao criar log de envio' };
  }

  const logId = (logEntry as { id: string }).id;

  try {
    // 2. Call proxy with track_id = log UUID
    const { data, error } = await callProxy('/send/text', 'POST', {
      number:       opts.phone,
      text:         opts.text,
      track_id:     logId,
      track_source: 'colegio-batista',
      ...(opts.delay ? { delay: opts.delay } : {}),
    });

    if (error) throw new Error(error);

    // 3. Update log: queued → sent
    await supabase
      .from('whatsapp_message_log')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', logId);

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    await supabase
      .from('whatsapp_message_log')
      .update({ status: 'failed', error_message: message })
      .eq('id', logId);
    return { success: false, error: message };
  }
}

// ── Template rendering ────────────────────────────────────────────────────────

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Available variables per module ────────────────────────────────────────────

export const MODULE_VARIABLES: Record<string, string[]> = {
  agendamento: [
    'visitor_name', 'visitor_phone', 'appointment_date',
    'appointment_time', 'visit_reason', 'companions_count',
  ],
  matricula: [
    'guardian_name', 'student_name', 'enrollment_status',
    'enrollment_number', 'pending_docs',
  ],
  contato: [
    'contact_name', 'contact_phone', 'contact_reason', 'contact_status',
  ],
  geral: [
    'school_name', 'school_phone', 'school_address', 'current_date',
  ],
};

export const ALL_VARIABLES = [...new Set(Object.values(MODULE_VARIABLES).flat())];
