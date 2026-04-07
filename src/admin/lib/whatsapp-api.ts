/**
 * WhatsApp API integration utilities.
 * All calls go through the `whatsapp-proxy` Edge Function so the
 * API token is never exposed on the client.
 */
import { supabase } from '../../lib/supabase';

export const SUPABASE_URL = 'https://dinbwugbwnkrzljuocbs.supabase.co';
export const WEBHOOK_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/uazapi-webhook`;

// ── Provider types ────────────────────────────────────────────────────────────

export interface WhatsAppProvider {
  id: string;
  name: string;
  instance_url: string;
  api_token: string;
  is_default: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Provider CRUD ─────────────────────────────────────────────────────────────

export async function getProviders(): Promise<{ data: WhatsAppProvider[]; error?: string }> {
  const { data, error } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: data as WhatsAppProvider[] };
}

export async function saveProvider(
  fields: { name: string; instance_url: string; api_token: string; notes?: string },
  id?: string,
): Promise<{ data: WhatsAppProvider | null; error?: string }> {
  const payload = {
    name:         fields.name,
    instance_url: fields.instance_url,
    api_token:    fields.api_token,
    notes:        fields.notes ?? null,
    updated_at:   new Date().toISOString(),
  };

  const query = id
    ? supabase.from('whatsapp_providers').update(payload).eq('id', id).select().single()
    : supabase.from('whatsapp_providers').insert({ ...payload, is_default: false }).select().single();

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };

  const saved = data as WhatsAppProvider;

  // Keep system_settings in sync for the edge function
  if (saved.is_default) await _syncToSystemSettings(saved);

  return { data: saved };
}

export async function setDefaultProvider(id: string): Promise<{ success: boolean; error?: string }> {
  // Clear existing default, then mark the new one
  await supabase.from('whatsapp_providers').update({ is_default: false }).neq('id', id);
  const { data, error } = await supabase
    .from('whatsapp_providers')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return { success: false, error: error.message };

  await _syncToSystemSettings(data as WhatsAppProvider);
  return { success: true };
}

export async function deleteProvider(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('whatsapp_providers').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Internal: mirror the default provider's credentials into system_settings so
 *  the existing edge function keeps working without changes. */
async function _syncToSystemSettings(p: WhatsAppProvider): Promise<void> {
  await Promise.all([
    supabase.from('system_settings')
      .update({ value: p.instance_url })
      .eq('category', 'whatsapp').eq('key', 'instance_url'),
    supabase.from('system_settings')
      .update({ value: p.api_token })
      .eq('category', 'whatsapp').eq('key', 'api_token'),
  ]);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WhatsAppApiStatus {
  state: 'connected' | 'connecting' | 'disconnected';
  phone?: string;
  name?: string;
  battery?: number;
  plugged?: boolean;
  qrcode?: string;
  pairingCode?: string;
  loggedIn?: boolean;
  profilePicUrl?: string;
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

export async function checkWhatsAppStatus(): Promise<{
  connected: boolean;
  status?: WhatsAppApiStatus;
  error?: string;
}> {
  const { data, error } = await callProxy('/instance/status', 'GET');
  if (error) return { connected: false, error };

  // API v2 returns { instance: {...}, status: { connected: bool, ... } }
  const d = data as {
    instance?: Record<string, unknown>;
    status?:   Record<string, unknown>;
  } | null;

  const connected =
    d?.status?.['connected'] === true ||
    d?.instance?.['status'] === 'connected';

  // Normalise to our WhatsAppApiStatus shape
  const raw = d?.instance || {};
  const phone = String(raw['owner'] || '').replace(/:.*$/, ''); // strip WA resource
  const status: WhatsAppApiStatus = {
    state:      connected ? 'connected' : 'disconnected',
    name:       String(raw['profileName'] || raw['name'] || ''),
    phone:      phone || undefined,
    loggedIn:      d?.status?.['loggedIn'] as boolean | undefined,
    profilePicUrl: String(raw['profilePicUrl'] || '') || undefined,
    qrcode:        String(raw['qrcode'] || '') || undefined,
    pairingCode:   String(raw['paircode'] || '') || undefined,
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
    .eq('category', 'whatsapp')
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

// ── Profile management ────────────────────────────────────────────────────────

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
}

/** Update the WhatsApp display name. */
export async function updateProfileName(name: string): Promise<ProfileUpdateResult> {
  const { error } = await callProxy('/profile/name', 'POST', { name });
  if (error) return { success: false, error };
  return { success: true };
}

/** Update the profile photo.
 *  `image` = base64 data-URL, http(s) URL, or "remove" / "delete".
 *  Image must be JPEG 640×640. */
export async function updateProfileImage(image: string): Promise<ProfileUpdateResult> {
  const { error } = await callProxy('/profile/image', 'POST', { image });
  if (error) return { success: false, error };
  return { success: true };
}

// ── Privacy settings ──────────────────────────────────────────────────────────

export interface PrivacySettings {
  groupadd?:    'all' | 'contacts' | 'contact_blacklist' | 'none';
  last?:        'all' | 'contacts' | 'contact_blacklist' | 'none';
  status?:      'all' | 'contacts' | 'contact_blacklist' | 'none';
  profile?:     'all' | 'contacts' | 'contact_blacklist' | 'none';
  readreceipts?:'all' | 'none';
  online?:      'all' | 'match_last_seen';
  calladd?:     'all' | 'known';
}

export async function getPrivacy(): Promise<{ data: PrivacySettings | null; error?: string }> {
  const { data, error } = await callProxy('/instance/privacy', 'GET');
  if (error) return { data: null, error };
  return { data: data as PrivacySettings };
}

export async function updatePrivacy(settings: PrivacySettings): Promise<ProfileUpdateResult> {
  const { error } = await callProxy('/instance/privacy', 'POST', settings);
  if (error) return { success: false, error };
  return { success: true };
}

// ── Presence ──────────────────────────────────────────────────────────────────

export async function updatePresence(
  presence: 'available' | 'unavailable',
): Promise<ProfileUpdateResult> {
  const { error } = await callProxy('/instance/presence', 'POST', { presence });
  if (error) return { success: false, error };
  return { success: true };
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
