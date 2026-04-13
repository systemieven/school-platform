import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import type {
  Announcement, AnnouncementTarget, SchoolClass, SchoolSegment,
  MessageType, TemplateButton, TemplateButtonType,
} from '../../types/admin.types';
import { ANNOUNCEMENT_TARGET_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  createMassCampaign, listCampaigns, controlCampaign,
  listCampaignMessages, cleanDoneMessages, clearAllQueue,
  listWhatsAppGroups, renderTemplate,
  CAMPAIGN_VARIABLES, CAMPAIGN_VARIABLE_LABELS, resolveCampaignVars,
  type CampaignFolder, type CampaignMessage, type WhatsAppGroup,
  type CampaignContent,
} from '../../lib/whatsapp-api';
import {
  Loader2, Pencil, Trash2, Megaphone, X, Save,
  Users, Globe, BookOpen, Send, Eye, CheckCircle2, Calendar,
  Pause, Play, ChevronDown, ChevronUp, RefreshCw, Trash,
  MessageSquare, Clock, AlertTriangle, Inbox,
  Image, Video, File, Music, Plus, Reply, ExternalLink,
  Copy, Phone as PhoneIcon, Upload,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';

const WA_MEDIA_BUCKET = 'whatsapp-media';

// ── Rich message constants ──────────────────────────────────────────────────
const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: 'text',    label: 'Texto' },
  { value: 'media',   label: 'Mídia' },
  { value: 'buttons', label: 'Botões' },
  { value: 'list',    label: 'Lista' },
];

const MEDIA_TYPES = [
  { value: 'image'    as const, label: 'Imagem',    icon: Image },
  { value: 'video'    as const, label: 'Vídeo',     icon: Video },
  { value: 'document' as const, label: 'Documento', icon: File },
  { value: 'audio'    as const, label: 'Áudio',     icon: Music },
];

const BUTTON_TYPES: { value: TemplateButtonType; label: string; icon: typeof Reply; placeholder: string }[] = [
  { value: 'reply', label: 'Resposta',  icon: Reply,         placeholder: 'ID do payload (ex: confirmar)' },
  { value: 'url',   label: 'Link',      icon: ExternalLink,  placeholder: 'https://exemplo.com' },
  { value: 'copy',  label: 'Copiar',    icon: Copy,          placeholder: 'Texto a copiar (ex: CUPOM20)' },
  { value: 'call',  label: 'Ligar',     icon: PhoneIcon,     placeholder: '+5511999999999' },
];

const emptyCampaignContent = (): CampaignContent => ({
  messageType: 'text',
  body: '',
});

const emptyButton = (): TemplateButton => ({ id: crypto.randomUUID(), text: '', type: 'reply', value: '' });

const TARGETS: AnnouncementTarget[] = ['all', 'segment', 'class', 'role'];

const TARGET_ICON: Record<AnnouncementTarget, React.ComponentType<{ className?: string }>> = {
  all:     Globe,
  segment: BookOpen,
  class:   Users,
  role:    Users,
};

const ROLES_LIST = [
  { value: 'student',     label: 'Alunos' },
  { value: 'teacher',     label: 'Professores' },
  { value: 'coordinator', label: 'Coordenadores' },
  { value: 'admin',       label: 'Administradores' },
];

// ── Campaign status helpers ───────────────────────────────────────────────────

const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada',  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  sending:   { label: 'Enviando',  color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  paused:    { label: 'Pausada',   color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  done:      { label: 'Concluída', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  deleting:  { label: 'Excluindo', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
};

const MSG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Scheduled: { label: 'Aguardando', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' },
  Sent:      { label: 'Enviada',    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  Failed:    { label: 'Falhou',     color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
};

// ── Campaign messages sub-panel ───────────────────────────────────────────────

function CampaignMessagesPanel({ folderId }: { folderId: string }) {
  const [messages,  setMessages]  = useState<CampaignMessage[]>([]);
  const [total,     setTotal]     = useState(0);
  const [offset,    setOffset]    = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState<'Scheduled' | 'Sent' | 'Failed' | ''>('');
  const limit = 20;

  const load = useCallback(async (off = 0, sf = statusFilter) => {
    setLoading(true);
    const res = await listCampaignMessages(folderId, {
      ...(sf ? { messageStatus: sf as 'Scheduled' | 'Sent' | 'Failed' } : {}),
      limit,
      offset: off,
    });
    setMessages(res.data);
    setTotal(res.total);
    setOffset(off);
    setLoading(false);
  }, [folderId, statusFilter]);

  useEffect(() => { load(0, statusFilter); }, [folderId]); // eslint-disable-line

  function changeFilter(sf: typeof statusFilter) {
    setStatusFilter(sf);
    load(0, sf);
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['', 'Scheduled', 'Sent', 'Failed'] as const).map((s) => (
          <button key={s} onClick={() => changeFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-primary text-white dark:bg-brand-secondary dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            {s === '' ? 'Todas' : MSG_STATUS_CONFIG[s]?.label ?? s}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{total} mensagem{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-brand-primary dark:text-brand-secondary" />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-xs text-center text-gray-400 py-3">Nenhuma mensagem encontrada.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {messages.map((m, i) => {
              const sc = MSG_STATUS_CONFIG[m.status] ?? MSG_STATUS_CONFIG.Scheduled;
              return (
                <div key={i}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${sc.color}`}>
                    {sc.label}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 font-medium flex-shrink-0">{m.number}</span>
                  <span className="text-gray-500 dark:text-gray-400 flex-1 truncate">{m.text}</span>
                  {m.sentAt && (
                    <span className="text-gray-400 flex-shrink-0">
                      {new Date(m.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{offset + 1}–{Math.min(offset + limit, total)} de {total}</span>
              <div className="flex gap-1">
                <button disabled={offset === 0} onClick={() => load(offset - limit)}
                  className="px-2 py-1 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">‹</button>
                <button disabled={offset + limit >= total} onClick={() => load(offset + limit)}
                  className="px-2 py-1 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700">›</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Campaigns tab ─────────────────────────────────────────────────────────────

function CampaignsTab() {
  const [campaigns,   setCampaigns]   = useState<CampaignFolder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [acting,      setActing]      = useState<string | null>(null); // folder_id being acted on
  const [cleanHours,  setCleanHours]  = useState(168);
  const [cleaning,    setCleaning]    = useState(false);
  const [clearMsg,    setClearMsg]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await listCampaigns();
    setCampaigns(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(folderId: string, action: 'stop' | 'continue' | 'delete') {
    if (action === 'delete' && !confirm('Excluir campanha? As mensagens já enviadas serão preservadas no histórico.')) return;
    setActing(folderId);
    const res = await controlCampaign(folderId, action);
    if (res.error) alert(res.error);
    else await load();
    setActing(null);
  }

  async function doClean() {
    setCleaning(true);
    const res = await cleanDoneMessages(cleanHours);
    setClearMsg(res.success ? `Limpeza iniciada (mensagens > ${cleanHours}h).` : (res.error ?? 'Erro'));
    setCleaning(false);
    setTimeout(() => setClearMsg(''), 4000);
  }

  async function doClearAll() {
    if (!confirm('⚠️ ATENÇÃO: Isso vai excluir TODAS as mensagens da fila (pendentes e enviadas). Essa ação é irreversível. Continuar?')) return;
    setCleaning(true);
    const res = await clearAllQueue();
    setClearMsg(res.success ? 'Fila limpa com sucesso.' : (res.error ?? 'Erro'));
    setCleaning(false);
    setTimeout(() => setClearMsg(''), 4000);
    await load();
  }

  return (
    <div className="space-y-5">
      {/* Reload */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''}
        </p>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Campaign list */}
      {loading && campaigns.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-brand-primary dark:text-brand-secondary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma campanha encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const sc    = CAMPAIGN_STATUS_CONFIG[c.status] ?? CAMPAIGN_STATUS_CONFIG.scheduled;
            const isExp = expanded === c.folder_id;
            const busy  = acting === c.folder_id;
            return (
              <div key={c.folder_id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{c.folder}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                        {c.status === 'sending' && <span className="ml-1 animate-pulse">•</span>}
                      </span>
                    </div>
                    {c.info && c.info !== c.folder && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{c.info}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Pause / Resume */}
                    {(c.status === 'sending' || c.status === 'scheduled') && (
                      <button onClick={() => act(c.folder_id, 'stop')} disabled={busy}
                        title="Pausar campanha"
                        className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors disabled:opacity-50">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {c.status === 'paused' && (
                      <button onClick={() => act(c.folder_id, 'continue')} disabled={busy}
                        title="Retomar campanha"
                        className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {/* Delete */}
                    {c.status !== 'sending' && c.status !== 'deleting' && (
                      <button onClick={() => act(c.folder_id, 'delete')} disabled={busy}
                        title="Excluir campanha"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Expand messages */}
                    <button onClick={() => setExpanded((p) => p === c.folder_id ? null : c.folder_id)}
                      title="Ver mensagens"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isExp && <CampaignMessagesPanel folderId={c.folder_id} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Queue management */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-5 space-y-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gestão da fila</p>

        {clearMsg && (
          <p className={`text-xs px-3 py-2 rounded-lg ${
            clearMsg.includes('Erro') || clearMsg.includes('erro')
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
            {clearMsg}
          </p>
        )}

        {/* Clean done */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
            Limpar mensagens enviadas há mais de
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={cleanHours}
              onChange={(e) => setCleanHours(Math.max(1, +e.target.value))}
              className="w-20 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none" />
            <span className="text-xs text-gray-500">horas</span>
          </div>
          <button onClick={doClean} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-50">
            {cleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash className="w-3 h-3" />}
            Limpar antigas
          </button>
        </div>

        {/* Clear all */}
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">
            Limpar <strong>toda</strong> a fila (pendentes + enviadas). Irreversível.
          </span>
          <button onClick={doClearAll} disabled={cleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors disabled:opacity-50">
            {cleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Limpar tudo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export interface DrawerProps {
  announcement: Announcement | null;
  /** Pre-fill form when creating a new announcement (announcement === null) */
  initialValues?: Partial<{
    title: string;
    body: string;
    target_type: AnnouncementTarget;
    target_ids: string[];
    target_roles: string[];
    send_whatsapp: boolean;
  }>;
  segments: SchoolSegment[];
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: (a: Announcement) => void;
}

const emptyForm = () => ({
  title:        '',
  body:         '',
  target_type:  'all' as AnnouncementTarget,
  target_ids:   [] as string[],
  target_roles: [] as string[],
  send_whatsapp: false,
  send_to_groups: false,
  selected_groups: [] as Array<{ jid: string; name: string }>,
  publish_at:   new Date().toISOString().slice(0, 16),
  is_published: false,
  // Campaign settings
  delayMin:     5,
  delayMax:     15,
  scheduledFor: '',   // datetime-local string
  campaignContent: emptyCampaignContent(),
});

export function AnnouncementDrawer({ announcement, initialValues, segments, classes, onClose, onSaved }: DrawerProps) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState(announcement ? {
    title:         announcement.title,
    body:          announcement.body,
    target_type:   announcement.target_type,
    target_ids:    announcement.target_ids,
    target_roles:  announcement.target_roles,
    send_whatsapp: announcement.send_whatsapp,
    send_to_groups: false,
    selected_groups: [] as Array<{ jid: string; name: string }>,
    publish_at:    announcement.publish_at.slice(0, 16),
    is_published:  announcement.is_published,
    delayMin:      5,
    delayMax:      15,
    scheduledFor:  '',
    campaignContent: emptyCampaignContent(),
  } : { ...emptyForm(), ...initialValues });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [waStatus, setWaStatus] = useState('');
  const [waGroups, setWaGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  async function fetchGroups() {
    setLoadingGroups(true);
    const result = await listWhatsAppGroups();
    if (result.groups) setWaGroups(result.groups);
    setLoadingGroups(false);
  }

  function toggleGroup(jid: string, name: string) {
    setForm((p) => ({
      ...p,
      selected_groups: p.selected_groups.some((g) => g.jid === jid)
        ? p.selected_groups.filter((g) => g.jid !== jid)
        : [...p.selected_groups, { jid, name }],
    }));
  }

  function toggleTargetId(id: string) {
    setForm((p) => ({
      ...p,
      target_ids: p.target_ids.includes(id)
        ? p.target_ids.filter((x) => x !== id)
        : [...p.target_ids, id],
    }));
  }

  function toggleRole(r: string) {
    setForm((p) => ({
      ...p,
      target_roles: p.target_roles.includes(r)
        ? p.target_roles.filter((x) => x !== r)
        : [...p.target_roles, r],
    }));
  }

  function updateContent<K extends keyof CampaignContent>(key: K, val: CampaignContent[K]) {
    setForm((p) => ({ ...p, campaignContent: { ...p.campaignContent, [key]: val } }));
  }

  function insertVar(varName: string) {
    const el = bodyRef.current;
    const tag = `{{${varName}}}`;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const before = form.body.slice(0, start);
      const after = form.body.slice(end);
      setForm((p) => ({ ...p, body: before + tag + after }));
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = start + tag.length;
      });
    } else {
      setForm((p) => ({ ...p, body: p.body + tag }));
    }
  }

  async function handleMediaUpload(file: globalThis.File) {
    setUploadingMedia(true);
    try {
      let uploadFile: globalThis.File | Blob = file;
      if (file.type.startsWith('image/') && file.size > 500_000) {
        uploadFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true });
      }
      const ext = file.name.split('.').pop() || 'bin';
      const path = `campaigns/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(WA_MEDIA_BUCKET).upload(path, uploadFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(WA_MEDIA_BUCKET).getPublicUrl(path);
      updateContent('mediaUrl', urlData.publicUrl);
      if (!form.campaignContent.docName && file.type.startsWith('application/')) {
        updateContent('docName', file.name);
      }
    } catch (e: unknown) {
      alert(`Erro ao enviar arquivo: ${e instanceof Error ? e.message : e}`);
    } finally {
      setUploadingMedia(false);
    }
  }

  function addButton() {
    const current = form.campaignContent.buttons || [];
    if (current.length >= 3) return;
    updateContent('buttons', [...current, emptyButton()]);
  }

  function updateButton(idx: number, patch: Partial<TemplateButton>) {
    const btns = [...(form.campaignContent.buttons || [])];
    btns[idx] = { ...btns[idx], ...patch };
    updateContent('buttons', btns);
  }

  function removeButton(idx: number) {
    updateContent('buttons', (form.campaignContent.buttons || []).filter((_, i) => i !== idx));
  }

  function addListSection() {
    const secs = [...(form.campaignContent.listSections || [])];
    secs.push({ title: '', rows: [{ title: '', id: crypto.randomUUID(), description: '' }] });
    updateContent('listSections', secs);
  }

  function updateListSection(si: number, title: string) {
    const secs = [...(form.campaignContent.listSections || [])];
    secs[si] = { ...secs[si], title };
    updateContent('listSections', secs);
  }

  function addListRow(si: number) {
    const secs = [...(form.campaignContent.listSections || [])];
    secs[si] = { ...secs[si], rows: [...secs[si].rows, { title: '', id: crypto.randomUUID(), description: '' }] };
    updateContent('listSections', secs);
  }

  function updateListRow(si: number, ri: number, patch: Partial<{ title: string; id: string; description: string }>) {
    const secs = [...(form.campaignContent.listSections || [])];
    const rows = [...secs[si].rows];
    rows[ri] = { ...rows[ri], ...patch };
    secs[si] = { ...secs[si], rows };
    updateContent('listSections', secs);
  }

  function removeListRow(si: number, ri: number) {
    const secs = [...(form.campaignContent.listSections || [])];
    secs[si] = { ...secs[si], rows: secs[si].rows.filter((_, i) => i !== ri) };
    if (secs[si].rows.length === 0) secs.splice(si, 1);
    updateContent('listSections', secs);
  }

  async function _buildRecipients(ann: Announcement): Promise<Array<{ number: string; text: string }>> {
    let query = supabase.from('students').select('guardian_phone, full_name').eq('status', 'active');

    if (ann.target_type === 'class' && ann.target_ids.length) {
      query = query.in('class_id', ann.target_ids);
    } else if (ann.target_type === 'segment' && ann.target_ids.length) {
      const { data: cls } = await supabase
        .from('school_classes').select('id').in('segment_id', ann.target_ids);
      const classIds = (cls ?? []).map((c: { id: string }) => c.id);
      if (classIds.length) query = query.in('class_id', classIds);
    }

    const { data: students } = await query;
    if (!students?.length) return [];

    const template = `*${ann.title}*\n\n${ann.body}`;

    const seen  = new Set<string>();
    const msgs: Array<{ number: string; text: string }> = [];

    for (const s of students as { guardian_phone: string; full_name: string }[]) {
      if (!s.guardian_phone) continue;
      const phone = s.guardian_phone.replace(/\D/g, '');
      if (seen.has(phone)) continue;
      seen.add(phone);
      const vars = resolveCampaignVars({ name: s.full_name, phone: s.guardian_phone });
      const text = renderTemplate(template, vars);
      msgs.push({ number: s.guardian_phone, text });
    }
    return msgs;
  }

  async function save(publish = false) {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    if (!form.body.trim())  { setError('Conteúdo é obrigatório.'); return; }
    setSaving(true); setError(''); setWaStatus('');

    const isPublishing = publish || form.is_published;
    const payload = {
      created_by:    profile!.id,
      title:         form.title.trim(),
      body:          form.body.trim(),
      target_type:   form.target_type,
      target_ids:    form.target_ids,
      target_roles:  form.target_roles,
      send_whatsapp: form.send_whatsapp,
      publish_at:    new Date(form.publish_at).toISOString(),
      is_published:  isPublishing,
      updated_at:    new Date().toISOString(),
    };

    const { data, error: err } = announcement
      ? await supabase.from('announcements').update(payload).eq('id', announcement.id).select('*').single()
      : await supabase.from('announcements').insert(payload).select('*').single();

    if (err) { setError(err.message); setSaving(false); return; }
    const saved = data as Announcement;
    logAudit({ action: announcement ? 'update' : 'create', module: 'announcements', recordId: saved.id, description: `Comunicado "${saved.title}" ${announcement ? 'atualizado' : 'criado'}`, newData: payload as Record<string, unknown> });

    // Create mass campaign when publishing with WhatsApp
    if (isPublishing && form.send_whatsapp && !announcement?.is_published) {
      let messages: Array<{ number: string; text: string }>;

      // Sync campaign body from the unified form.body
      const cc: CampaignContent = { ...form.campaignContent, body: form.body };
      const text = `*${saved.title}*\n\n${saved.body}`;

      if (form.send_to_groups) {
        if (!form.selected_groups.length) {
          setWaStatus('Nenhum grupo selecionado.');
          setSaving(false);
          return;
        }
        messages = form.selected_groups.map((g) => ({ number: g.jid, text }));
        setWaStatus(`Criando campanha para ${messages.length} grupo(s)...`);
      } else {
        setWaStatus('Buscando destinatários...');
        messages = await _buildRecipients(saved);
      }

      if (messages.length > 0) {
        if (!form.send_to_groups) {
          setWaStatus(`Criando campanha para ${messages.length} destinatário${messages.length !== 1 ? 's' : ''}...`);
        }
        const folderName = `Comunicado: ${saved.title.slice(0, 60)}`;
        const scheduledTs = form.scheduledFor
          ? new Date(form.scheduledFor).getTime()
          : undefined;

        const richContent = cc.messageType !== 'text' ? cc : undefined;

        const result = await createMassCampaign({
          folder:          folderName,
          info:            saved.body.slice(0, 100),
          messages,
          content:         richContent,
          delayMin:        form.delayMin,
          delayMax:        form.delayMax,
          scheduledFor:    scheduledTs,
          announcementId:  saved.id,
          createdBy:       profile!.id,
        });

        if (result.success) {
          setWaStatus(`✓ Campanha criada: ${messages.length} mensagens ${scheduledTs ? 'agendadas' : 'na fila'}.`);
        } else {
          setWaStatus(`⚠ Comunicado salvo, mas erro ao criar campanha: ${result.error}`);
          setTimeout(() => onSaved(saved), 2000);
          return;
        }
      } else {
        setWaStatus('Nenhum destinatário encontrado para os filtros selecionados.');
      }
      setTimeout(() => onSaved(saved), 1500);
      return;
    }

    onSaved(saved);
  }

  const cls = `w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none`;

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" />{announcement ? 'Editar Comunicado' : 'Novo Comunicado'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          {/* ── Conteúdo ── */}
          <SettingsCard title="Conteúdo" icon={Megaphone}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título *</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Reunião de pais — 3º Bimestre" className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Conteúdo *</label>
              <textarea ref={bodyRef} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                rows={5} placeholder={form.send_whatsapp ? 'Ex: Olá {{primeiro_nome}}, ...' : 'Escreva o comunicado aqui...'}
                className={`${cls} resize-none`} />
              {/* Variable picker — visible when WhatsApp is on and not sending to groups */}
              {form.send_whatsapp && !form.send_to_groups && (
                <div className="mt-2 space-y-1.5">
                  {Object.entries(CAMPAIGN_VARIABLES).map(([group, vars]) => (
                    <div key={group} className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase w-20 flex-shrink-0">
                        {group === 'destinatario' ? 'Contato' : group === 'institucional' ? 'Escola' : 'Data'}
                      </span>
                      {vars.map((v) => (
                        <button key={v} type="button" onClick={() => insertVar(v)}
                          title={CAMPAIGN_VARIABLE_LABELS[v]}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-primary/10 hover:text-brand-primary dark:hover:text-brand-secondary transition-colors">
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Type selector — always visible: text/media; buttons/list only with WhatsApp */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipo de mensagem</label>
              <div className="flex gap-2 flex-wrap">
                {MESSAGE_TYPES
                  .filter((t) => form.send_whatsapp || t.value === 'text' || t.value === 'media')
                  .map((t) => (
                    <button key={t.value} type="button"
                      onClick={() => updateContent('messageType', t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.campaignContent.messageType === t.value
                          ? 'border-brand-primary bg-brand-primary text-white dark:border-brand-secondary dark:bg-brand-secondary dark:text-gray-900'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}>
                      {t.label}
                    </button>
                  ))}
              </div>
            </div>

            {/* Media fields — visible when type is media (both internal and WhatsApp) */}
            {form.campaignContent.messageType === 'media' && (
              <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Tipo de mídia</label>
                <div className="flex gap-2 flex-wrap">
                  {MEDIA_TYPES.map((mt) => {
                    const Icon = mt.icon;
                    return (
                      <button key={mt.value} type="button"
                        onClick={() => updateContent('mediaType', mt.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          form.campaignContent.mediaType === mt.value
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-secondary dark:bg-brand-secondary/10 dark:text-brand-secondary'
                            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                        <Icon className="w-3.5 h-3.5" /> {mt.label}
                      </button>
                    );
                  })}
                </div>

                {/* URL or upload */}
                <div className="space-y-2">
                  <input value={form.campaignContent.mediaUrl || ''} placeholder="URL do arquivo ou faça upload abaixo"
                    onChange={(e) => updateContent('mediaUrl', e.target.value)}
                    className={cls} />
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {uploadingMedia
                      ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      : <Upload className="w-4 h-4 text-gray-400" />}
                    <span className="text-xs text-gray-500">
                      {uploadingMedia ? 'Enviando...' : 'Fazer upload'}
                    </span>
                    <input type="file" className="hidden" disabled={uploadingMedia}
                      accept={
                        form.campaignContent.mediaType === 'image' ? 'image/*'
                        : form.campaignContent.mediaType === 'video' ? 'video/*'
                        : form.campaignContent.mediaType === 'audio' ? 'audio/*'
                        : '*/*'
                      }
                      onChange={(e) => { if (e.target.files?.[0]) handleMediaUpload(e.target.files[0]); }} />
                  </label>
                  {form.campaignContent.mediaUrl && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                      ✓ {form.campaignContent.mediaUrl}
                    </p>
                  )}
                </div>

                {form.campaignContent.mediaType === 'document' && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nome do documento</label>
                    <input value={form.campaignContent.docName || ''} placeholder="relatorio.pdf"
                      onChange={(e) => updateContent('docName', e.target.value)} className={cls} />
                  </div>
                )}
              </div>
            )}
          </SettingsCard>

          {/* ── Opções WhatsApp (botões/lista) ── */}
          {form.send_whatsapp && (form.campaignContent.messageType === 'buttons' || form.campaignContent.messageType === 'list') && (
            <SettingsCard title="Opções WhatsApp" icon={MessageSquare}>
              {/* Button editor */}
              {form.campaignContent.messageType === 'buttons' && (
                <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Botões (máx. 3)</label>
                    <button type="button" onClick={addButton}
                      disabled={(form.campaignContent.buttons || []).length >= 3}
                      className="flex items-center gap-1 text-xs text-brand-primary dark:text-brand-secondary hover:underline disabled:opacity-40">
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>

                  {(form.campaignContent.buttons || []).map((btn, i) => {
                    const btConfig = BUTTON_TYPES.find((b) => b.value === btn.type) || BUTTON_TYPES[0];
                    return (
                      <div key={btn.id} className="space-y-2 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {BUTTON_TYPES.map((bt) => {
                              const BtIcon = bt.icon;
                              return (
                                <button key={bt.value} type="button"
                                  onClick={() => updateButton(i, { type: bt.value, value: '' })}
                                  title={bt.label}
                                  className={`p-1.5 rounded transition-colors ${
                                    btn.type === bt.value
                                      ? 'bg-brand-primary/10 text-brand-primary dark:text-brand-secondary'
                                      : 'text-gray-400 hover:text-gray-600'}`}>
                                  <BtIcon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" onClick={() => removeButton(i)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={btn.text} placeholder="Texto do botão"
                            onChange={(e) => updateButton(i, { text: e.target.value })}
                            className={`${cls} text-xs`} />
                          <input value={btn.value} placeholder={btConfig.placeholder}
                            onChange={(e) => updateButton(i, { value: e.target.value })}
                            className={`${cls} text-xs`} />
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rodapé (opcional)</label>
                    <input value={form.campaignContent.footerText || ''} placeholder="Texto do rodapé"
                      onChange={(e) => updateContent('footerText', e.target.value)} className={cls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Imagem do cabeçalho (opcional)</label>
                    <input value={form.campaignContent.imageUrl || ''} placeholder="URL da imagem"
                      onChange={(e) => updateContent('imageUrl', e.target.value)} className={cls} />
                  </div>
                </div>
              )}

              {/* List editor */}
              {form.campaignContent.messageType === 'list' && (
                <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Seções da lista</label>
                    <button type="button" onClick={addListSection}
                      className="flex items-center gap-1 text-xs text-brand-primary dark:text-brand-secondary hover:underline">
                      <Plus className="w-3 h-3" /> Seção
                    </button>
                  </div>

                  {(form.campaignContent.listSections || []).map((sec, si) => (
                    <div key={si} className="space-y-2 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                      <input value={sec.title} placeholder={`Título da seção ${si + 1}`}
                        onChange={(e) => updateListSection(si, e.target.value)}
                        className={`${cls} text-xs font-medium`} />
                      {sec.rows.map((row, ri) => (
                        <div key={ri} className="flex items-center gap-1.5">
                          <input value={row.title} placeholder="Título da opção"
                            onChange={(e) => updateListRow(si, ri, { title: e.target.value })}
                            className={`${cls} text-xs flex-1`} />
                          <input value={row.description || ''} placeholder="Descrição (opcional)"
                            onChange={(e) => updateListRow(si, ri, { description: e.target.value })}
                            className={`${cls} text-xs flex-1`} />
                          <button type="button" onClick={() => removeListRow(si, ri)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addListRow(si)}
                        className="text-[10px] text-brand-primary dark:text-brand-secondary hover:underline">
                        + Adicionar opção
                      </button>
                    </div>
                  ))}

                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Texto do botão da lista</label>
                    <input value={form.campaignContent.listButtonText || ''} placeholder="Ver opções"
                      onChange={(e) => updateContent('listButtonText', e.target.value)} className={cls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rodapé (opcional)</label>
                    <input value={form.campaignContent.footerText || ''} placeholder="Texto do rodapé"
                      onChange={(e) => updateContent('footerText', e.target.value)} className={cls} />
                  </div>
                </div>
              )}
            </SettingsCard>
          )}

          {/* ── Público-alvo ── */}
          <SettingsCard title="Público-alvo" icon={Users}>
            <div className="flex gap-2 flex-wrap">
              {TARGETS.map((t) => {
                const Icon = TARGET_ICON[t];
                return (
                  <button key={t} type="button"
                    onClick={() => setForm((p) => ({ ...p, target_type: t, target_ids: [], target_roles: [] }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_type === t
                        ? 'border-brand-primary bg-brand-primary text-white dark:border-brand-secondary dark:bg-brand-secondary dark:text-gray-900'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}>
                    <Icon className="w-3.5 h-3.5" /> {ANNOUNCEMENT_TARGET_LABELS[t]}
                  </button>
                );
              })}
            </div>

            {form.target_type === 'segment' && segments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {segments.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleTargetId(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(s.id)
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-secondary dark:bg-brand-secondary/10 dark:text-brand-secondary'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {form.target_type === 'class' && classes.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {classes.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggleTargetId(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(c.id)
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-secondary dark:bg-brand-secondary/10 dark:text-brand-secondary'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {form.target_type === 'role' && (
              <div className="flex flex-wrap gap-2">
                {ROLES_LIST.map((r) => (
                  <button key={r.value} type="button" onClick={() => toggleRole(r.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_roles.includes(r.value)
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-secondary dark:bg-brand-secondary/10 dark:text-brand-secondary'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </SettingsCard>

          {/* ── Selecionar Grupos ── */}
          {form.send_whatsapp && form.send_to_groups && (
            <SettingsCard title="Selecionar Grupos" icon={MessageSquare}
              headerExtra={
                <button type="button" onClick={fetchGroups} disabled={loadingGroups}
                  className="flex items-center gap-1 text-xs text-brand-primary dark:text-brand-secondary hover:underline disabled:opacity-50">
                  <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} /> Atualizar
                </button>
              }>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {form.selected_groups.length} grupo(s) selecionado(s)
              </p>
              {loadingGroups ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : waGroups.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">Nenhum grupo encontrado.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {waGroups.map((g) => (
                    <button key={g.JID} type="button" onClick={() => toggleGroup(g.JID, g.Name || g.JID)}
                      title={g.Name || g.JID}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors max-w-[200px] truncate ${
                        form.selected_groups.some((s) => s.jid === g.JID)
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary dark:border-brand-secondary dark:bg-brand-secondary/10 dark:text-brand-secondary'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                      {g.Name || g.JID}
                    </button>
                  ))}
                </div>
              )}
            </SettingsCard>
          )}

          {/* ── Publicação ── */}
          <SettingsCard title="Publicação" icon={Calendar}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Data de publicação</label>
              <input type="datetime-local" value={form.publish_at}
                onChange={(e) => setForm((p) => ({ ...p, publish_at: e.target.value }))} className={cls} />
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 space-y-2">
              <Toggle
                checked={form.send_whatsapp}
                onChange={(v) => setForm((p) => ({
                  ...p,
                  send_whatsapp: v,
                  send_to_groups: v ? p.send_to_groups : false,
                  selected_groups: v ? p.selected_groups : [],
                  // Reset to text/media when WhatsApp is turned off (buttons/list are WA-only)
                  campaignContent: !v && (p.campaignContent.messageType === 'buttons' || p.campaignContent.messageType === 'list')
                    ? { ...p.campaignContent, messageType: 'text', buttons: undefined, listSections: undefined }
                    : p.campaignContent,
                }))}
                label="Enviar por WhatsApp"
                description="Cria campanha em massa para os responsáveis ao publicar"
                onColor="bg-emerald-600"
              />
              {form.send_whatsapp && (
                <Toggle
                  checked={form.send_to_groups}
                  onChange={(v) => {
                    setForm((p) => ({ ...p, send_to_groups: v, selected_groups: v ? p.selected_groups : [] }));
                    if (v && waGroups.length === 0) fetchGroups();
                  }}
                  label="Enviar para grupos"
                  description="Envia para grupos do WhatsApp em vez de contatos individuais"
                  onColor="bg-emerald-600"
                />
              )}
            </div>

            {form.send_whatsapp && (
              <div className="space-y-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Configurações da campanha
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Delay mínimo (seg)</label>
                    <input type="number" min={1} max={300} value={form.delayMin}
                      onChange={(e) => setForm((p) => ({ ...p, delayMin: Math.max(1, +e.target.value) }))}
                      className={cls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Delay máximo (seg)</label>
                    <input type="number" min={1} max={600} value={form.delayMax}
                      onChange={(e) => setForm((p) => ({ ...p, delayMax: Math.max(form.delayMin, +e.target.value) }))}
                      className={cls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Agendar envio <span className="text-gray-400">(opcional — vazio = imediato)</span>
                  </label>
                  <input type="datetime-local" value={form.scheduledFor}
                    onChange={(e) => setForm((p) => ({ ...p, scheduledFor: e.target.value }))}
                    className={cls} />
                </div>
              </div>
            )}

            {waStatus && (
              <p className={`text-xs px-3 py-2 rounded-lg ${
                waStatus.startsWith('⚠') ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                : waStatus.startsWith('✓') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                {saving && !waStatus.startsWith('✓') && !waStatus.startsWith('⚠') && (
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
                )}
                {waStatus}
              </p>
            )}
          </SettingsCard>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={() => save(false)} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl disabled:opacity-50 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
            {saving && !waStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar rascunho
          </button>
          <button onClick={() => save(true)} disabled={saving || form.is_published}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {saving && waStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.is_published ? 'Já publicado' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { profile, hasRole } = useAdminAuth();
  const [items,      setItems]      = useState<Announcement[]>([]);
  const [segments,   setSegments]   = useState<SchoolSegment[]>([]);
  const [classes,    setClasses]    = useState<SchoolClass[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<Announcement | null | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'published' | 'draft'>('all');
  const [mainTab,    setMainTab]    = useState<'announcements' | 'campaigns'>('announcements');

  const canManage = hasRole('super_admin', 'admin', 'coordinator');

  const load = useCallback(async () => {
    const [annRes, segRes, clsRes] = await Promise.all([
      supabase.from('announcements')
        .select('*, creator:profiles(full_name), reads:announcement_reads(user_id)')
        .order('publish_at', { ascending: false }),
      supabase.from('school_segments').select('id, name').eq('is_active', true).order('position'),
      supabase.from('school_classes').select('id, name, year, segment_id').eq('is_active', true).order('name'),
    ]);
    setItems((annRes.data ?? []) as Announcement[]);
    setSegments((segRes.data ?? []) as SchoolSegment[]);
    setClasses((clsRes.data ?? []) as SchoolClass[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm('Excluir este comunicado?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'announcements', recordId: id, description: 'Comunicado excluído' });
    setItems((p) => p.filter((a) => a.id !== id));
  }

  async function togglePublish(ann: Announcement) {
    const { data } = await supabase
      .from('announcements')
      .update({ is_published: !ann.is_published, updated_at: new Date().toISOString() })
      .eq('id', ann.id).select('*').single();
    if (data) {
      logAudit({ action: 'update', module: 'announcements', recordId: ann.id, description: `Comunicado "${ann.title}" ${ann.is_published ? 'despublicado' : 'publicado'}` });
      setItems((p) => p.map((x) => x.id === ann.id ? { ...x, is_published: !ann.is_published } : x));
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const filtered = items.filter((a) => {
    if (filter === 'published') return a.is_published;
    if (filter === 'draft')     return !a.is_published;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Comunicados
        </h1>
        {canManage && mainTab === 'announcements' && (
          <button onClick={() => { setEditing(null); setShowDrawer(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors">
            <Megaphone className="w-4 h-4" /> Novo Comunicado
          </button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {([
          { key: 'announcements', label: 'Comunicados', Icon: Megaphone },
          { key: 'campaigns',     label: 'Campanhas WhatsApp', Icon: MessageSquare },
        ] as const).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mainTab === key
                ? 'border-brand-primary dark:border-brand-secondary text-brand-primary dark:text-brand-secondary'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Campaigns tab */}
      {mainTab === 'campaigns' && <CampaignsTab />}

      {/* Announcements tab */}
      {mainTab === 'announcements' && (
        <>
          {/* Sub-filter tabs */}
          <div className="flex gap-1">
            {(['all', 'published', 'draft'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-brand-primary text-white dark:bg-brand-secondary dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Rascunhos'}
                <span className="ml-1 text-xs opacity-70">
                  ({f === 'all' ? items.length : f === 'published' ? items.filter((a) => a.is_published).length : items.filter((a) => !a.is_published).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{items.length ? 'Nenhum comunicado nesta categoria.' : 'Nenhum comunicado criado.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((a) => {
                const readCount  = (a.reads ?? []).length;
                const isMyOwn    = a.created_by === profile?.id;
                const canEdit    = isMyOwn || canManage;
                const TargetIcon = TARGET_ICON[a.target_type];
                return (
                  <div key={a.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{a.title}</p>
                          {a.is_published ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Publicado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full text-xs font-medium">Rascunho</span>
                          )}
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary rounded-full text-xs">
                            <TargetIcon className="w-3 h-3" /> {ANNOUNCEMENT_TARGET_LABELS[a.target_type]}
                          </span>
                          {a.send_whatsapp && (
                            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-xs">
                              WhatsApp
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{a.body}</p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {fmtDate(a.publish_at)}
                          </span>
                          {readCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {readCount} leitura{readCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {a.creator && (
                            <span>por {(a.creator as { full_name: string }).full_name}</span>
                          )}
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {canManage && (
                            <button onClick={() => togglePublish(a)} title={a.is_published ? 'Despublicar' : 'Publicar'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                a.is_published
                                  ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                  : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}`}>
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => { setEditing(a); setShowDrawer(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {canManage && (
                            <button onClick={() => remove(a.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showDrawer && (
        <AnnouncementDrawer
          announcement={editing ?? null}
          segments={segments}
          classes={classes}
          onClose={() => setShowDrawer(false)}
          onSaved={(a) => {
            setItems((p) => editing ? p.map((x) => x.id === a.id ? a : x) : [a, ...p]);
            setShowDrawer(false);
          }}
        />
      )}
    </div>
  );
}
