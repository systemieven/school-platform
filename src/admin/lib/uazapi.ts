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
  loggedIn?: boolean;
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
  if (error) {
    // Try to surface the actual error body from the Edge Function response
    let message = error.message;
    try {
      // FunctionsHttpError exposes the raw Response via .context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = await (error as any).context?.json?.();
      if (body?.error)   message = String(body.error);
      else if (body?.message) message = String(body.message);
    } catch { /* ignore json parse errors */ }
    return { data: null, error: message };
  }
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

  // UazAPI v2 returns { instance: {...}, status: { connected: bool, ... } }
  const d = data as {
    instance?: Record<string, unknown>;
    status?:   Record<string, unknown>;
  } | null;

  const connected =
    d?.status?.['connected'] === true ||
    d?.instance?.['status'] === 'connected';

  // Normalise to our UazApiStatus shape
  const raw = d?.instance || {};
  const phone = String(raw['owner'] || '').replace(/:.*$/, ''); // strip WA resource
  const status: UazApiStatus = {
    state:      connected ? 'connected' : 'disconnected',
    name:       String(raw['profileName'] || raw['name'] || ''),
    phone:      phone || undefined,
    loggedIn:   d?.status?.['loggedIn'] as boolean | undefined,
    qrcode:     String(raw['qrcode'] || '') || undefined,
    pairingCode: String(raw['paircode'] || '') || undefined,
  };

  return { connected, status };
}

// ── Connect / Disconnect instance ────────────────────────────────────────────

export interface ConnectResult {
  success: boolean;
  qrcode?: string;    // base64 QR (undefined when using phone pairing)
  paircode?: string;  // 8-char pairing code (only when phone is supplied)
  error?: string;
}

/** Start connection. Pass `phone` (e.g. "5581999999999") for pairing-code flow,
 *  omit for QR-code flow. */
export async function connectInstance(phone?: string): Promise<ConnectResult> {
  const { data, error } = await callProxy('/instance/connect', 'POST', phone ? { phone } : {});
  if (error) return { success: false, error };

  const d = data as { instance?: Record<string, unknown> } | null;
  const raw = d?.instance || (data as Record<string, unknown>) || {};

  // Normalise QR: may be raw base64 or already a data URL
  let qrcode = String(raw['qrcode'] || '');
  if (qrcode && !qrcode.startsWith('data:')) {
    qrcode = `data:image/png;base64,${qrcode}`;
  }
  const paircode = String(raw['paircode'] || '') || undefined;

  return { success: true, qrcode: qrcode || undefined, paircode };
}

/** Disconnect the current WhatsApp session. Requires new QR to reconnect. */
export async function disconnectInstance(): Promise<{ success: boolean; error?: string }> {
  const { error } = await callProxy('/instance/disconnect', 'POST', {});
  if (error) return { success: false, error };
  return { success: true };
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
