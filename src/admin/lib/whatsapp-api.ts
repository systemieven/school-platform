/**
 * WhatsApp API integration utilities.
 * All calls go through the `whatsapp-proxy` Edge Function so the
 * API token is never exposed on the client.
 */
import { supabase } from '../../lib/supabase';

export const SUPABASE_URL = 'https://dinbwugbwnkrzljuocbs.supabase.co';
export const WEBHOOK_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/uazapi-webhook`;

// ── API Profiles ──────────────────────────────────────────────────────────────

export interface WhatsAppApiProfile {
  id: string;
  label: string;
  description: string;
  edgeFunctionSlug: string;
}

export const WHATSAPP_API_PROFILES: WhatsAppApiProfile[] = [
  {
    id: 'uazapi',
    label: 'UazAPI',
    description: 'Integração via UazAPI v2 (instância própria)',
    edgeFunctionSlug: 'uazapi-proxy',
  },
];

// ── Webhook events ────────────────────────────────────────────────────────────

export interface WebhookEventDef {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
  warning?: string;
}

export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  {
    id: 'messages_update',
    label: 'Atualização de mensagens',
    description: 'Status de entrega (enviado, entregue, lido) de cada mensagem enviada.',
    recommended: true,
  },
  {
    id: 'messages_upsert',
    label: 'Novas mensagens recebidas',
    description: 'Dispara quando uma nova mensagem chega na instância.',
    recommended: false,
  },
  {
    id: 'messages_reaction',
    label: 'Reações a mensagens',
    description: 'Dispara quando alguém reage a uma mensagem.',
    recommended: false,
  },
  {
    id: 'messages_delete',
    label: 'Mensagens apagadas',
    description: 'Dispara quando uma mensagem é apagada.',
    recommended: false,
  },
  {
    id: 'presence_update',
    label: 'Presença (digitando / online)',
    description: 'Notifica quando um contato está digitando ou online.',
    recommended: false,
  },
  {
    id: 'chats_upsert',
    label: 'Sincronização de conversas',
    description: 'Envia todo o histórico de conversas ao conectar.',
    recommended: false,
    warning: 'Volume muito alto ao conectar — pode sobrecarregar o servidor.',
  },
  {
    id: 'contacts_upsert',
    label: 'Sincronização de contatos',
    description: 'Envia toda a lista de contatos ao conectar.',
    recommended: false,
    warning: 'Volume muito alto ao conectar — pode sobrecarregar o servidor.',
  },
  {
    id: 'groups_upsert',
    label: 'Sincronização de grupos',
    description: 'Envia dados de grupos ao conectar.',
    recommended: false,
    warning: 'Alto volume se houver muitos grupos.',
  },
  {
    id: 'connection_update',
    label: 'Atualização de conexão',
    description: 'Notifica mudanças no estado da conexão da instância (conectado/desconectado). Usado para alertas internos de queda de conexão.',
    recommended: true,
  },
];

// ── Provider types ────────────────────────────────────────────────────────────

export interface WhatsAppProvider {
  id: string;
  name: string;
  instance_url: string;
  api_token: string;
  is_default: boolean;
  profile_id: string;
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
  fields: { name: string; instance_url: string; api_token: string; profile_id?: string; notes?: string },
  id?: string,
): Promise<{ data: WhatsAppProvider | null; error?: string }> {
  const payload = {
    name:         fields.name,
    instance_url: fields.instance_url,
    api_token:    fields.api_token,
    profile_id:   fields.profile_id ?? 'uazapi',
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

  // UazAPI v2 can return several shapes; normalise all of them:
  //   { instance: { state: "open", ... } }           ← Baileys state (most common)
  //   { instance: { status: "connected", ... } }
  //   { status: { connected: true, ... } }
  //   { state: "open", ... }                         ← flat response
  const d = data as Record<string, unknown> | null;
  const inst = (d?.['instance'] as Record<string, unknown>) ?? {};
  const stat = (d?.['status']   as Record<string, unknown>) ?? {};

  const connected =
    stat['connected'] === true           ||   // { status: { connected: true } }
    inst['status']    === 'connected'    ||   // { instance: { status: "connected" } }
    inst['state']     === 'open'         ||   // { instance: { state: "open" } }  ← Baileys
    d?.['state']      === 'open'         ||   // flat { state: "open" }
    d?.['connected']  === true           ||   // flat { connected: true }
    d?.['status']     === 'connected';        // flat { status: "connected" }

  // Normalise to our WhatsAppApiStatus shape
  const raw = inst;
  const phone = String(raw['owner'] || '').replace(/:.*$/, ''); // strip WA resource
  const status: WhatsAppApiStatus = {
    state:      connected ? 'connected' : 'disconnected',
    name:       String(raw['profileName'] || raw['name'] || ''),
    phone:      phone || undefined,
    loggedIn:      stat['loggedIn'] as boolean | undefined,
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

export async function registerWebhook(webhookUrl: string, events: string[]): Promise<SendResult> {
  const { data, error } = await callProxy('/webhook', 'POST', {
    url: webhookUrl,
    enabled: true,
    events,
    // wasSentByApi: evita loop de upsert das mensagens enviadas pela API
    // isGroupYes:  sistema envia apenas para contatos individuais; grupos só geram ruído
    excludeMessages: ['wasSentByApi', 'isGroupYes'],
  });
  if (error) return { success: false, error };
  // Persist webhook_url and selected events in system_settings
  await Promise.all([
    supabase
      .from('system_settings')
      .update({ value: JSON.stringify(webhookUrl) })
      .eq('category', 'whatsapp')
      .eq('key', 'webhook_url'),
    supabase
      .from('system_settings')
      .update({ value: JSON.stringify(events) })
      .eq('category', 'whatsapp')
      .eq('key', 'webhook_events'),
  ]);
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
      number:       normalizePhone(opts.phone),
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
  // Persist so the UI can restore the correct state on next load
  await supabase
    .from('system_settings')
    .upsert(
      { category: 'whatsapp', key: 'presence', value: presence },
      { onConflict: 'category,key' },
    );
  return { success: true };
}

// ── Phone normalization ───────────────────────────────────────────────────────

/** Strips formatting and prepends Brazilian DDI (55) if not already present.
 *  "81999999999" → "5581999999999"
 *  "(81) 99999-9999" → "5581999999999"
 *  "5581999999999" → "5581999999999" (already normalized, unchanged)
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Accept as-is only if already carries DDI 55 and has a valid length
  // (12 = fixed line: 55 + 2 DDD + 8 digits; 13 = mobile: 55 + 2 DDD + 9 digits)
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits;
  return `55${digits}`;
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
