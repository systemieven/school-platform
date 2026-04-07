/**
 * WhatsAppProviderDrawer
 *
 * Right-side drawer for creating / editing a WhatsApp API provider.
 * For the default provider it also exposes connection, profile,
 * privacy, presence and webhook management.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  registerWebhook, WEBHOOK_FUNCTION_BASE,
  connectInstance, disconnectInstance,
  updateProfileName, updateProfileImage,
  getPrivacy, updatePrivacy, updatePresence,
  saveProvider,
  WHATSAPP_API_PROFILES, WEBHOOK_EVENTS,
} from '../lib/whatsapp-api';
import type { PrivacySettings, WhatsAppProvider } from '../lib/whatsapp-api';
import { useWhatsAppStatus } from '../contexts/WhatsAppStatusContext';
import ImageCropModal from './ImageCropModal';
import {
  X, Save, Loader2, Check, KeyRound, Globe, ShieldCheck,
  Eye, EyeOff, Smartphone, CheckCircle2, WifiOff, RefreshCw,
  QrCode, Hash, LogOut, TriangleAlert, Phone, UserCircle2,
  Camera, Lock, Radio, Pencil, Trash2, Link, ExternalLink,
  Copy, Wifi, Shuffle, AlertCircle,
} from 'lucide-react';

// ── Shared style helpers ──────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all';
const selectCls = `${inputCls} appearance-none`;
const cardCls = 'bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-2xl p-5';

function jsonVal(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  try { return JSON.parse(String(v)) || ''; } catch { return String(v); }
}

function generateSecret(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  provider: WhatsAppProvider | null; // null = new provider
  onClose: () => void;
  onSaved: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WhatsAppProviderDrawer({ provider, onClose, onSaved }: Props) {
  const isNew      = provider === null;
  const isDefault  = provider?.is_default ?? false;

  const { state: waState, instanceData, loading: waLoading, refresh: refreshWa } = useWhatsAppStatus();

  // ── Provider name
  const [providerName,  setProviderName]  = useState(provider?.name ?? '');
  const [editingName,   setEditingName]   = useState(provider === null); // new provider starts in edit mode
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Credentials
  const [instanceUrl, setInstanceUrl] = useState(provider?.instance_url ?? '');
  const [apiToken,    setApiToken]    = useState(provider?.api_token    ?? '');
  const [profileId,   setProfileId]   = useState(provider?.profile_id  ?? 'uazapi');
  const [showToken,   setShowToken]   = useState(false);
  const [savingCred,  setSavingCred]  = useState(false);
  const [savedCred,   setSavedCred]   = useState(false);
  const [credError,   setCredError]   = useState('');

  // ── Connection flow (only for default provider)
  type ConnFlow = 'idle' | 'qr' | 'paircode' | 'error';
  const [connFlow,           setConnFlow]           = useState<ConnFlow>('idle');
  const [connecting,         setConnecting]         = useState(false);
  const [qrImage,            setQrImage]            = useState('');
  const [pairCode,           setPairCode]           = useState('');
  const [phoneInput,         setPhoneInput]         = useState('');
  const [connError,          setConnError]          = useState('');
  const [qrExpiry,           setQrExpiry]           = useState(0);
  const [qrSecsLeft,         setQrSecsLeft]         = useState(0);
  const [showDisconnectWarn, setShowDisconnectWarn] = useState(false);
  const [disconnecting,      setDisconnecting]      = useState(false);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef= useRef<ReturnType<typeof setTimeout>  | null>(null);

  // ── Webhook
  const [webhookSecret,    setWebhookSecret]    = useState('');
  const [showSecret,       setShowSecret]       = useState(false);
  const [savingSecret,     setSavingSecret]     = useState(false);
  const [savedSecret,      setSavedSecret]      = useState(false);
  const [secretId,         setSecretId]         = useState('');
  const [registering,      setRegistering]      = useState(false);
  const [regResult,        setRegResult]        = useState<{ success: boolean; error?: string } | null>(null);
  const [webhookUrlInDb,   setWebhookUrlInDb]   = useState('');
  const [copied,           setCopied]           = useState(false);
  const [selectedEvents,   setSelectedEvents]   = useState<string[]>(['messages_update']);

  // ── Load webhook settings (always from system_settings)
  useEffect(() => {
    if (!isDefault) return;
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('id, key, value')
        .eq('category', 'whatsapp')
        .in('key', ['webhook_secret', 'webhook_url', 'webhook_events']);
      if (!data) return;
      data.forEach((r: { id: string; key: string; value: unknown }) => {
        const v = jsonVal(r.value);
        if (r.key === 'webhook_secret') { setWebhookSecret(v); setSecretId(r.id); }
        if (r.key === 'webhook_url')    setWebhookUrlInDb(v);
        if (r.key === 'webhook_events') {
          try { setSelectedEvents(JSON.parse(v)); } catch { /* keep default */ }
        }
      });
    })();
  }, [isDefault]);

  // ── Polling helpers
  const stopPolling = useCallback(() => {
    if (pollRef.current)      { clearInterval(pollRef.current);   pollRef.current = null; }
    if (qrRefreshRef.current) { clearTimeout(qrRefreshRef.current); qrRefreshRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Clear connection flow once connected
  useEffect(() => {
    if (waState === 'connected' && connFlow !== 'idle') {
      stopPolling();
      setConnFlow('idle');
      setConnecting(false);
    }
  }, [waState, connFlow, stopPolling]);

  // QR countdown
  useEffect(() => {
    if (connFlow !== 'qr') return;
    const t = setInterval(() => {
      setQrSecsLeft(Math.max(0, Math.ceil((qrExpiry - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [connFlow, qrExpiry]);

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Derived
  const webhookUrl = webhookSecret
    ? `${WEBHOOK_FUNCTION_BASE}?secret=${encodeURIComponent(webhookSecret)}`
    : WEBHOOK_FUNCTION_BASE;
  const isRegistered = webhookUrlInDb === webhookUrl && webhookSecret !== '';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveCred = async () => {
    if (!providerName.trim()) { setCredError('Informe um nome para o provedor.'); return; }
    setCredError('');
    setSavingCred(true);
    const { error } = await saveProvider(
      { name: providerName.trim(), instance_url: instanceUrl, api_token: apiToken, profile_id: profileId },
      provider?.id,
    );
    setSavingCred(false);
    if (error) { setCredError(error); return; }
    setSavedCred(true);
    setTimeout(() => setSavedCred(false), 2500);
    onSaved();
    // If this is the default provider, credentials in system_settings changed —
    // immediately re-check connection so the header badge and status dot update.
    if (isDefault) refreshWa();
    if (isNew) onClose(); // after creation, close so user sees updated list
  };

  const handleConnectQr = async () => {
    setConnecting(true); setConnError(''); setConnFlow('qr');
    const res = await connectInstance();
    if (!res.success || !res.qrcode) {
      setConnError(res.error || 'Não foi possível gerar o QR code.');
      setConnFlow('error'); setConnecting(false); return;
    }
    setQrImage(res.qrcode);
    setQrExpiry(Date.now() + 110_000);
    setConnecting(false);
    pollRef.current = setInterval(() => refreshWa(), 3000);
    qrRefreshRef.current = setTimeout(async () => {
      const r = await connectInstance();
      if (r.success && r.qrcode) { setQrImage(r.qrcode); setQrExpiry(Date.now() + 110_000); }
    }, 90_000);
  };

  const handleConnectPhone = async () => {
    if (!phoneInput.trim()) return;
    setConnecting(true); setConnError('');
    const res = await connectInstance(phoneInput.replace(/\D/g, ''));
    if (!res.success) {
      setConnError(res.error || 'Não foi possível gerar o código de pareamento.');
      setConnFlow('error'); setConnecting(false); return;
    }
    setPairCode(res.paircode || '');
    setConnFlow('paircode'); setConnecting(false);
    pollRef.current = setInterval(() => refreshWa(), 3000);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const res = await disconnectInstance();
    if (res.success) { setShowDisconnectWarn(false); refreshWa(); }
    else setConnError(res.error || 'Erro ao desconectar.');
    setDisconnecting(false);
  };

  const handleCancelConnect = () => {
    stopPolling(); setConnFlow('idle'); setConnecting(false);
    setQrImage(''); setPairCode(''); setConnError('');
  };

  const handleGenerateSecret = async () => {
    const s = generateSecret();
    setWebhookSecret(s); setSavingSecret(true);
    if (secretId) await supabase.from('system_settings').update({ value: s }).eq('id', secretId);
    setSavingSecret(false); setSavedSecret(true); setRegResult(null);
    setTimeout(() => setSavedSecret(false), 2500);
  };

  const handleSaveSecret = async () => {
    setSavingSecret(true);
    if (secretId) await supabase.from('system_settings').update({ value: webhookSecret }).eq('id', secretId);
    setSavingSecret(false); setSavedSecret(true); setRegResult(null);
    setTimeout(() => setSavedSecret(false), 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const handleRegister = async () => {
    setRegistering(true); setRegResult(null);
    const res = await registerWebhook(webhookUrl, selectedEvents);
    setRegResult(res);
    if (res.success) setWebhookUrlInDb(webhookUrl);
    setRegistering(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-[60] transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-800 z-[70] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={providerName}
                onChange={e => setProviderName(e.target.value)}
                onBlur={async () => {
                  if (!providerName.trim()) return;
                  setEditingName(false);
                  if (!isNew && providerName.trim() !== provider?.name) {
                    await saveProvider(
                      { name: providerName.trim(), instance_url: instanceUrl, api_token: apiToken, profile_id: profileId },
                      provider?.id,
                    );
                    onSaved();
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter' && providerName.trim()) { e.currentTarget.blur(); } }}
                placeholder="Nome do provedor (ex.: Número Principal)"
                className="w-full text-base font-semibold bg-transparent text-gray-800 dark:text-white placeholder:text-gray-400 outline-none border-b-2 border-[#003876] dark:border-[#ffd700] transition-colors pb-0.5"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                className="group flex items-center gap-1.5 max-w-full text-left"
              >
                <span className="text-base font-semibold text-gray-800 dark:text-white truncate">
                  {providerName || 'Sem nome'}
                </span>
                <Pencil className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-[#003876] dark:group-hover:text-[#ffd700] flex-shrink-0 transition-colors" />
              </button>
            )}
            {isDefault && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold tracking-wide uppercase text-[#003876] dark:text-[#ffd700] bg-[#003876]/10 dark:bg-[#ffd700]/10 px-2 py-0.5 rounded-full">
                Provedor padrão
              </span>
            )}
            {isNew && (
              <p className="text-xs text-gray-400 mt-0.5">Novo provedor</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Credentials ────────────────────────────────────────────────── */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Credenciais da API</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <Globe className="w-3.5 h-3.5" /> URL da Instância
                </label>
                <input
                  type="text" value={instanceUrl}
                  onChange={e => setInstanceUrl(e.target.value)}
                  placeholder="https://sua-instancia.exemplo.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Token da API
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'} value={apiToken}
                    onChange={e => setApiToken(e.target.value)}
                    placeholder="Cole o token da instância WhatsApp API"
                    className={`${inputCls} pr-10`}
                  />
                  <button type="button" onClick={() => setShowToken(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <Shuffle className="w-3.5 h-3.5" /> Perfil da API
                </label>
                <select value={profileId} onChange={e => setProfileId(e.target.value)} className={selectCls}>
                  {WHATSAPP_API_PROFILES.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                {WHATSAPP_API_PROFILES.find(p => p.id === profileId) && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    {WHATSAPP_API_PROFILES.find(p => p.id === profileId)!.description}
                  </p>
                )}
              </div>
              {credError && (
                <p className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{credError}
                </p>
              )}
              <button onClick={handleSaveCred} disabled={savingCred}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  savedCred ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
                {savingCred ? <Loader2 className="w-4 h-4 animate-spin" />
                  : savedCred ? <Check className="w-4 h-4" />
                  : <Save className="w-4 h-4" />}
                {savingCred ? 'Salvando…' : savedCred ? 'Salvo!' : isNew ? 'Criar provedor' : 'Salvar credenciais'}
              </button>
            </div>
          </div>

          {/* ── Sections below only apply to the default (active) provider ── */}
          {isDefault && !isNew && (
            <>
              {/* ── Connection ──────────────────────────────────────────────── */}
              <div className={cardCls}>
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conexão WhatsApp</h3>
                  <span className={`ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    waState === 'connected'    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                    : waState === 'connecting' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                    : waState === 'unknown'    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                  }`}>
                    {waLoading ? <Loader2 className="w-3 h-3 animate-spin" />
                      : waState === 'connected'  ? <CheckCircle2 className="w-3 h-3" />
                      : waState === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <WifiOff className="w-3 h-3" />}
                    {waState === 'connected' ? 'Conectado'
                      : waState === 'connecting' ? 'Conectando…'
                      : waState === 'unknown'    ? 'Verificando…'
                      : 'Desconectado'}
                  </span>
                  <button onClick={refreshWa} disabled={waLoading} title="Atualizar status"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
                    <RefreshCw className={`w-3.5 h-3.5 ${waLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* CONNECTED */}
                {waState === 'connected' && instanceData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Instância conectada</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
                          {instanceData.name  && <span className="text-xs text-gray-500"><span className="text-gray-400">Perfil: </span>{instanceData.name}</span>}
                          {instanceData.phone && <span className="text-xs text-gray-500"><span className="text-gray-400">Número: </span>+{instanceData.phone}</span>}
                        </div>
                      </div>
                    </div>
                    {!showDisconnectWarn ? (
                      <button onClick={() => setShowDisconnectWarn(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <LogOut className="w-4 h-4" /> Desconectar WhatsApp
                      </button>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                          <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold">Confirmar desconexão?</p>
                            <p className="text-xs mt-1 text-red-500 dark:text-red-300">
                              A sessão será encerrada. Todas as notificações automáticas serão pausadas até uma nova conexão via QR code.
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleDisconnect} disabled={disconnecting}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors">
                            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                            {disconnecting ? 'Desconectando…' : 'Sim, desconectar'}
                          </button>
                          <button onClick={() => setShowDisconnectWarn(false)}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DISCONNECTED / UNKNOWN — connect options */}
                {(waState === 'disconnected' || waState === 'unknown') && connFlow === 'idle' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">Conecte a instância ao WhatsApp para habilitar notificações automáticas.</p>
                    {connError && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl">{connError}</div>}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleConnectQr} disabled={connecting}
                        className="inline-flex items-center gap-2 bg-[#003876] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#002855] disabled:opacity-60 transition-colors">
                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        {connecting ? 'Gerando QR…' : 'Conectar com QR Code'}
                      </button>
                      <button onClick={() => { setConnFlow('paircode'); setConnError(''); }}
                        className="inline-flex items-center gap-2 border border-[#003876] text-[#003876] dark:border-[#ffd700] dark:text-[#ffd700] px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#003876]/5 transition-colors">
                        <Phone className="w-4 h-4" /> Conectar com número
                      </button>
                    </div>
                  </div>
                )}

                {/* QR CODE flow */}
                {connFlow === 'qr' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Abra o WhatsApp → <strong>Configurações → Dispositivos vinculados → Vincular dispositivo</strong>
                    </p>
                    {qrImage ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-white p-3 rounded-2xl border border-gray-200 dark:border-gray-600 inline-block">
                          <img src={qrImage} alt="QR Code WhatsApp" className="w-52 h-52 block" />
                        </div>
                        {qrSecsLeft > 0 && (
                          <p className="text-xs text-gray-400">
                            Expira em <span className={`font-mono font-semibold ${qrSecsLeft < 30 ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                              {String(Math.floor(qrSecsLeft / 60)).padStart(2,'0')}:{String(qrSecsLeft % 60).padStart(2,'0')}
                            </span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Aguardando leitura…
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Gerando QR code…
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setConnFlow('paircode'); stopPolling(); }}
                        className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline">
                        <Hash className="w-3.5 h-3.5" /> Usar código de pareamento
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Cancelar</button>
                    </div>
                  </div>
                )}

                {/* PAIRING CODE — phone input */}
                {connFlow === 'paircode' && !pairCode && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Digite o número com DDI. Um código de 8 dígitos será exibido para inserir no app.</p>
                    {connError && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-3 py-2 rounded-xl">{connError}</div>}
                    <div className="flex gap-2">
                      <input type="tel" value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                        placeholder="5581999999999"
                        className={`${inputCls} flex-1`} />
                      <button onClick={handleConnectPhone} disabled={connecting || !phoneInput.trim()}
                        className="inline-flex items-center gap-2 bg-[#003876] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#002855] disabled:opacity-60 transition-colors">
                        {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                        {connecting ? 'Gerando…' : 'Gerar código'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleConnectQr}
                        className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline">
                        <QrCode className="w-3.5 h-3.5" /> Usar QR code
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Cancelar</button>
                    </div>
                  </div>
                )}

                {/* PAIRING CODE — code display */}
                {connFlow === 'paircode' && pairCode && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      No WhatsApp → <strong>Configurações → Dispositivos vinculados → Vincular dispositivo → Vincular com número de telefone</strong>
                    </p>
                    <div className="bg-[#003876]/5 dark:bg-[#003876]/20 border border-[#003876]/20 dark:border-[#003876]/40 rounded-2xl p-4 flex items-center justify-center">
                      <span className="font-mono text-3xl font-bold tracking-[0.3em] text-[#003876] dark:text-[#ffd700]">{pairCode}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Aguardando pareamento…
                    </div>
                    <button onClick={handleCancelConnect} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">Cancelar</button>
                  </div>
                )}

                {/* ERROR */}
                {connFlow === 'error' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm">
                      <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Falha ao conectar</p>
                        {connError && <p className="text-xs mt-1 font-mono bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">{connError}</p>}
                      </div>
                    </div>
                    <button onClick={() => { setConnFlow('idle'); setConnError(''); }}
                      className="text-xs text-[#003876] dark:text-[#ffd700] hover:underline">Tentar novamente</button>
                  </div>
                )}
              </div>

              {/* ── Profile (only when connected) ────────────────────────────── */}
              {waState === 'connected' && <WaProfileSection />}

              {/* ── Privacy (only when connected) ────────────────────────────── */}
              {waState === 'connected' && <WaPrivacySection />}

              {/* ── Presence (only when connected) ───────────────────────────── */}
              {waState === 'connected' && <WaPresenceSection />}

              {/* ── Webhook ──────────────────────────────────────────────────── */}
              <div className={cardCls}>
                <div className="flex items-center gap-2 mb-1">
                  <Link className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Webhook de Status de Entrega</h3>
                  {isRegistered && (
                    <span className="ml-auto text-[10px] font-semibold tracking-wide uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Registrado
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Permite que a API WhatsApp informe o status de entrega (enviado, entregue, lido) de cada mensagem enviada.
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Chave Secreta <span className="text-gray-400 font-normal">— valida requisições recebidas da API WhatsApp</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type={showSecret ? 'text' : 'password'} value={webhookSecret}
                        onChange={e => setWebhookSecret(e.target.value)}
                        placeholder="Clique em Gerar para criar uma chave"
                        className={`${inputCls} pr-10 font-mono`} />
                      <button type="button" onClick={() => setShowSecret(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={handleGenerateSecret} disabled={savingSecret}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#003876] hover:text-[#003876] dark:hover:border-[#ffd700] dark:hover:text-[#ffd700] disabled:opacity-50 transition-colors whitespace-nowrap">
                      {savingSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />} Gerar
                    </button>
                    {webhookSecret && (
                      <button onClick={handleSaveSecret} disabled={savingSecret}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                          savedSecret ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
                        {savingSecret ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedSecret ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {savedSecret ? 'Salva!' : 'Salvar'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    URL do Webhook{!webhookSecret && <span className="text-amber-500 ml-1">— gere a chave secreta primeiro</span>}
                  </label>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <code className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate select-all">{webhookUrl}</code>
                    <button onClick={handleCopy} title="Copiar URL"
                      className={`flex-shrink-0 p-1 rounded transition-colors ${copied ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {/* ── Eventos do Webhook ─────────────────────────────── */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Eventos a receber
                  </label>
                  <div className="space-y-2">
                    {WEBHOOK_EVENTS.map(ev => (
                      <label key={ev.id} className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(ev.id)}
                          onChange={e => {
                            setSelectedEvents(prev =>
                              e.target.checked ? [...prev, ev.id] : prev.filter(x => x !== ev.id)
                            );
                            setRegResult(null);
                          }}
                          className="mt-0.5 w-4 h-4 rounded accent-[#003876] dark:accent-[#ffd700] flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#003876] dark:group-hover:text-[#ffd700] transition-colors">
                              {ev.label}
                            </span>
                            {ev.recommended && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                                recomendado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{ev.description}</p>
                          {ev.warning && (
                            <p className="text-[11px] text-amber-500 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                              <TriangleAlert className="w-3 h-3 flex-shrink-0" />{ev.warning}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={handleRegister} disabled={registering || !webhookSecret || selectedEvents.length === 0}
                  className="inline-flex items-center gap-2 border border-[#003876] text-[#003876] dark:border-[#ffd700] dark:text-[#ffd700] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#003876]/5 dark:hover:bg-[#ffd700]/5 disabled:opacity-50 transition-colors">
                  {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                  {registering ? 'Registrando…' : 'Registrar na API'}
                </button>
                {regResult && (
                  <div className={`mt-3 text-xs px-3 py-2 rounded-xl ${regResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                    {regResult.success
                      ? '✓ Webhook registrado. A API WhatsApp agora enviará atualizações de entrega para esta URL.'
                      : `Erro ao registrar: ${regResult.error}`}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notice for non-default providers */}
          {!isDefault && !isNew && (
            <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Conexão, perfil, privacidade e webhook são gerenciados apenas no <strong>provedor padrão</strong>. Defina este como padrão para acessar essas configurações.</p>
            </div>
          )}

        </div>{/* end scrollable body */}
      </div>
    </>
  );
}

// ── Sub-sections (same logic as before, now scoped inside the drawer file) ────

function WaProfileSection() {
  const { instanceData, refresh } = useWhatsAppStatus();
  const [profileName,   setProfileName]   = useState(instanceData?.name || '');
  const [savingName,    setSavingName]    = useState(false);
  const [nameResult,    setNameResult]    = useState<{ ok: boolean; msg: string } | null>(null);
  const [cropSrc,       setCropSrc]       = useState<string | null>(null);
  const [savingPhoto,   setSavingPhoto]   = useState(false);
  const [photoResult,   setPhotoResult]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setProfileName(instanceData?.name || ''); }, [instanceData]);

  const handleSaveName = async () => {
    if (!profileName.trim()) return;
    setSavingName(true); setNameResult(null);
    const res = await updateProfileName(profileName.trim());
    setNameResult({ ok: res.success, msg: res.success ? 'Nome atualizado!' : (res.error || 'Erro') });
    if (res.success) refresh();
    setSavingName(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { if (ev.target?.result) setCropSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropSave = async (base64: string) => {
    setCropSrc(null); setSavingPhoto(true); setPhotoResult(null);
    const res = await updateProfileImage(base64);
    setPhotoResult({ ok: res.success, msg: res.success ? 'Foto atualizada!' : (res.error || 'Erro') });
    if (res.success) setTimeout(refresh, 1500);
    setSavingPhoto(false);
  };

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true); setPhotoResult(null);
    const res = await updateProfileImage('remove');
    setPhotoResult({ ok: res.success, msg: res.success ? 'Foto removida.' : (res.error || 'Erro') });
    if (res.success) refresh();
    setRemovingPhoto(false);
  };

  return (
    <>
      {cropSrc && <ImageCropModal src={cropSrc} onSave={handleCropSave} onClose={() => setCropSrc(null)} />}
      <div className={`${cardCls} space-y-5`}>
        <div className="flex items-center gap-2">
          <UserCircle2 className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Perfil WhatsApp</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden border-2 border-white dark:border-gray-700 shadow">
              {instanceData?.profilePicUrl
                ? <img src={instanceData.profilePicUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-gray-400"><UserCircle2 className="w-8 h-8" /></div>}
            </div>
            {savingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} className="hidden" />
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => fileRef.current?.click()} disabled={savingPhoto}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50 transition-colors">
                <Camera className="w-3.5 h-3.5" />{savingPhoto ? 'Enviando…' : 'Trocar foto'}
              </button>
              {instanceData?.profilePicUrl && (
                <button onClick={handleRemovePhoto} disabled={removingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
                  {removingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remover
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">JPEG recomendado · a imagem será recortada em 640×640</p>
          </div>
        </div>
        {photoResult && (
          <p className={`text-xs px-3 py-2 rounded-xl ${photoResult.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
            {photoResult.msg}
          </p>
        )}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            <Pencil className="w-3.5 h-3.5" /> Nome de exibição
          </label>
          <div className="flex gap-2">
            <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              placeholder="Nome visível no WhatsApp" maxLength={25}
              className={`${inputCls} flex-1`} />
            <button onClick={handleSaveName} disabled={savingName || !profileName.trim()}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                nameResult?.ok ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
              {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameResult?.ok ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {savingName ? 'Salvando…' : nameResult?.ok ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
          {nameResult && !nameResult.ok && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{nameResult.msg}</p>}
        </div>
      </div>
    </>
  );
}

const PRIVACY_FIELDS: Array<{ key: keyof PrivacySettings; label: string; options: { value: string; label: string }[] }> = [
  { key: 'profile',      label: 'Foto de perfil',             options: [{ value:'all',label:'Todos' },{ value:'contacts',label:'Meus contatos' },{ value:'contact_blacklist',label:'Contatos exceto bloqueados' },{ value:'none',label:'Ninguém' }] },
  { key: 'last',         label: 'Visto por último',           options: [{ value:'all',label:'Todos' },{ value:'contacts',label:'Meus contatos' },{ value:'contact_blacklist',label:'Contatos exceto bloqueados' },{ value:'none',label:'Ninguém' }] },
  { key: 'online',       label: 'Status online',              options: [{ value:'all',label:'Todos' },{ value:'match_last_seen',label:'Igual ao visto por último' }] },
  { key: 'status',       label: 'Recado (mensagem de status)',options: [{ value:'all',label:'Todos' },{ value:'contacts',label:'Meus contatos' },{ value:'contact_blacklist',label:'Contatos exceto bloqueados' },{ value:'none',label:'Ninguém' }] },
  { key: 'readreceipts', label: 'Confirmações de leitura',    options: [{ value:'all',label:'Ativadas (tic azul visível)' },{ value:'none',label:'Desativadas' }] },
  { key: 'groupadd',     label: 'Adicionar a grupos',         options: [{ value:'all',label:'Todos' },{ value:'contacts',label:'Meus contatos' },{ value:'contact_blacklist',label:'Contatos exceto bloqueados' },{ value:'none',label:'Ninguém' }] },
  { key: 'calladd',      label: 'Chamadas recebidas',         options: [{ value:'all',label:'Todos' },{ value:'known',label:'Números conhecidos' }] },
];

function WaPrivacySection() {
  const [privacy, setPrivacy] = useState<PrivacySettings>({});
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  const [loaded,  setLoaded]  = useState(false);

  const fetchPrivacy = async () => {
    setLoading(true);
    const { data, error } = await getPrivacy();
    if (data) setPrivacy(data);
    if (error) setResult({ ok: false, msg: error });
    setLoaded(true); setLoading(false);
  };

  useEffect(() => { fetchPrivacy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: keyof PrivacySettings, value: string) => {
    setPrivacy(prev => ({ ...prev, [key]: value as never })); setResult(null);
  };

  const handleSave = async () => {
    setSaving(true); setResult(null);
    const res = await updatePrivacy(privacy);
    setResult({ ok: res.success, msg: res.success ? 'Privacidade atualizada.' : (res.error || 'Erro ao salvar.') });
    setSaving(false);
  };

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Privacidade</h3>
        {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
        <button onClick={fetchPrivacy} disabled={loading} title="Recarregar"
          className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loaded && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {PRIVACY_FIELDS.map(({ key, label, options }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
                <select value={(privacy[key] as string) || ''} onChange={e => handleChange(key, e.target.value)} className={selectCls}>
                  {!privacy[key] && <option value="" disabled>— Carregando —</option>}
                  {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {result && (
            <p className={`text-xs px-3 py-2 rounded-xl ${result.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
              {result.msg}
            </p>
          )}
          <button onClick={handleSave} disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              result?.ok ? 'bg-emerald-500 text-white' : 'bg-[#003876] text-white hover:bg-[#002855] disabled:opacity-50'}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : result?.ok ? <Check className="w-4 h-4" /> : null}
            {saving ? 'Salvando…' : result?.ok ? 'Salvo!' : 'Salvar privacidade'}
          </button>
        </>
      )}
    </div>
  );
}

function WaPresenceSection() {
  const { instanceData, refresh } = useWhatsAppStatus();
  const initial = (instanceData?.['current_presence'] as string) === 'available' ? 'available' : 'unavailable';
  const [presence, setPresence] = useState<'available' | 'unavailable'>(initial as 'available' | 'unavailable');
  const [saving,   setSaving]   = useState(false);
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const p = instanceData?.['current_presence'] as string;
    if (p === 'available' || p === 'unavailable') setPresence(p);
  }, [instanceData]);

  const handleSave = async (value: 'available' | 'unavailable') => {
    setPresence(value); setSaving(true); setResult(null);
    const res = await updatePresence(value);
    setResult({ ok: res.success, msg: res.success ? 'Presença atualizada!' : (res.error || 'Erro') });
    if (res.success) refresh();
    setSaving(false);
  };

  return (
    <div className={`${cardCls} space-y-4`}>
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status de presença</h3>
        {saving && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
      </div>
      <div className="flex gap-2">
        {(['available', 'unavailable'] as const).map((val) => (
          <button key={val} onClick={() => handleSave(val)} disabled={saving}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all disabled:opacity-60 ${
              presence === val
                ? val === 'available'
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-gray-400 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-white dark:hover:bg-gray-800'
            }`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${val === 'available' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
            {val === 'available' ? 'Disponível (online)' : 'Indisponível (offline)'}
          </button>
        ))}
      </div>
      {result && (
        <p className={`text-xs px-3 py-2 rounded-xl ${result.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'}`}>
          {result.msg}
        </p>
      )}
      {presence === 'unavailable' && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5">
          <TriangleAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Com status <strong>indisponível</strong>, confirmações de entrega (ticks azuis) podem não ser recebidas se nenhum dispositivo móvel estiver ativo.
          </p>
        </div>
      )}
    </div>
  );
}
