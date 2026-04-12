import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  X,
  Filter,
  RefreshCw,
  CheckCircle2,
  Ban,
  Trash2,
  User,
  Info,
  Star,
  ExternalLink,
  Quote,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import type { Tables } from '../../../integrations/supabase/types';
import { logAudit } from '../../../lib/audit';
import { usePermissions } from '../../contexts/PermissionsContext';
import SettingsCard from '../../components/SettingsCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type Testimonial = Tables<'testimonials'>;
type TestimonialStatus = 'pending' | 'approved' | 'rejected';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TestimonialStatus, { label: string; color: string; dot: string }> = {
  pending:  { label: 'Pendente',  color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',    dot: 'bg-amber-500' },
  approved: { label: 'Aprovado',  color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  rejected: { label: 'Recusado', color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',            dot: 'bg-red-500' },
};

const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  google:   { label: 'Google',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  facebook: { label: 'Facebook', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
};

function getProviderBadge(provider: string | null) {
  if (!provider) return { label: 'Formulário', color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400' };
  return PROVIDER_CONFIG[provider.toLowerCase()] ?? { label: provider, color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' };
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${cls} ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
      ))}
    </span>
  );
}

function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center flex-shrink-0`}>
      <span className="font-bold text-brand-primary dark:text-brand-secondary">{initials}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

interface DrawerProps {
  testimonial: Testimonial;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Testimonial>) => void;
  onRefresh: () => void;
}

function TestimonialDrawer({ testimonial: t, onClose, onUpdate, onRefresh }: DrawerProps) {
  const { can } = usePermissions();
  const canEdit   = can('testimonials', 'edit');
  const canDelete = can('testimonials', 'delete');

  const [saving, setSaving]             = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const status = (t.status as TestimonialStatus) ?? 'pending';
  const sc = STATUS_CONFIG[status];
  const provider = getProviderBadge(t.provider);

  async function changeStatus(newStatus: TestimonialStatus, reason?: string) {
    setSaving(true);
    const patch: Partial<Testimonial> = {
      status: newStatus,
      ...(newStatus === 'approved'
        ? { approved_at: new Date().toISOString(), rejection_reason: null }
        : {}),
      ...(newStatus === 'rejected'
        ? { rejection_reason: reason ?? null }
        : {}),
    };
    const { error } = await supabase.from('testimonials').update(patch).eq('id', t.id);
    if (!error) {
      logAudit({
        action: 'status_change',
        module: 'testimonials',
        recordId: t.id,
        description: `Depoimento de ${t.parent_name} ${newStatus === 'approved' ? 'aprovado' : 'recusado'}`,
        oldData: { status: t.status },
        newData: { status: newStatus },
      });
      onUpdate(t.id, patch);
      setShowRejectForm(false);
      setRejectionReason('');
    }
    setSaving(false);
  }

  async function deleteTestimonial() {
    if (!window.confirm(`Excluir permanentemente o depoimento de "${t.parent_name}"?`)) return;
    const { error } = await supabase.from('testimonials').delete().eq('id', t.id);
    if (!error) {
      logAudit({
        action: 'delete',
        module: 'testimonials',
        recordId: t.id,
        description: `Depoimento de ${t.parent_name} excluído`,
      });
      onClose();
      onRefresh();
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-brand-primary to-brand-primary-dark flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-white truncate">{t.parent_name}</h2>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sc.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                  {sc.label}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${provider.color}`}>
                  {provider.label}
                </span>
                <StarRating rating={t.rating} size="sm" />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/70 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Testimonial content */}
          <SettingsCard title="Depoimento" icon={Quote}>
            <div className="flex items-center gap-2 mb-3">
              <StarRating rating={t.rating} size="md" />
              <span className="text-sm text-gray-500 dark:text-gray-400">{t.rating}/5</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              "{t.content}"
            </p>
          </SettingsCard>

          {/* Author info */}
          <SettingsCard title="Autor" icon={User}>
            <div className="flex items-start gap-3">
              <Avatar name={t.parent_name} avatarUrl={t.avatar_url} size="lg" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{t.parent_name}</p>
                {t.email && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{t.email}</p>
                )}
                {t.student_grade && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Série/Turma: <span className="font-medium text-gray-700 dark:text-gray-300">{t.student_grade}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${provider.color}`}>
                    {provider.label}
                  </span>
                  {t.social_id && (
                    <a
                      href={t.provider === 'google'
                        ? `https://profiles.google.com/${t.social_id}`
                        : t.provider === 'facebook'
                          ? `https://facebook.com/${t.social_id}`
                          : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-primary dark:text-brand-secondary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Ver perfil
                    </a>
                  )}
                </div>
              </div>
            </div>
          </SettingsCard>

          {/* Info */}
          <SettingsCard title="Informações" icon={Info}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Recebido em</span>
                <span className="text-gray-700 dark:text-gray-300">{formatDateTime(t.created_at)}</span>
              </div>
              {t.approved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Aprovado em</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatDateTime(t.approved_at)}</span>
                </div>
              )}
              {t.status === 'rejected' && t.rejection_reason && (
                <div className="pt-1">
                  <p className="text-gray-500 dark:text-gray-400 mb-1">Motivo da recusa</p>
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2 leading-relaxed">
                    {t.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          </SettingsCard>

          {/* Reject form (shown inline) */}
          {showRejectForm && (
            <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Motivo da recusa (opcional)</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Informe o motivo internamente..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionReason(''); }}
                  className="text-xs px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={() => changeStatus('rejected', rejectionReason)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-40 transition-colors font-medium"
                >
                  {saving ? 'Salvando...' : 'Confirmar recusa'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!showRejectForm && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 flex-shrink-0 space-y-2">
            {canEdit && (
              <>
                {(status === 'pending' || status === 'rejected') && (
                  <button
                    onClick={() => changeStatus('approved')}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Aprovar depoimento'}
                  </button>
                )}
                {(status === 'pending' || status === 'approved') && (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Ban className="w-4 h-4" />
                    Recusar depoimento
                  </button>
                )}
              </>
            )}
            {canDelete && (
              <button
                onClick={deleteTestimonial}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir permanentemente
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestimonialsPage() {
  const { can } = usePermissions();
  const canEdit   = can('testimonials', 'edit');

  const [testimonials, setTestimonials]     = useState<Testimonial[]>([]);
  const [selected, setSelected]             = useState<Testimonial | null>(null);
  const [loading, setLoading]               = useState(true);
  const [statusFilter, setStatusFilter]     = useState<TestimonialStatus | 'all'>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [search, setSearch]                 = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [savingId, setSavingId]             = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });
    setTestimonials(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  // Client-side filtering
  const filtered = testimonials.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;

    const provNorm = t.provider?.toLowerCase() ?? 'form';
    if (providerFilter !== 'all') {
      if (providerFilter === 'form' && t.provider !== null) return false;
      if (providerFilter !== 'form' && provNorm !== providerFilter) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      if (
        !t.parent_name.toLowerCase().includes(q) &&
        !(t.email ?? '').toLowerCase().includes(q) &&
        !t.content.toLowerCase().includes(q)
      ) return false;
    }

    if (dateFrom && t.created_at < dateFrom) return false;
    if (dateTo   && t.created_at.slice(0, 10) > dateTo) return false;

    return true;
  });

  // Counts for status pills
  const counts = {
    all:      testimonials.length,
    pending:  testimonials.filter((t) => t.status === 'pending').length,
    approved: testimonials.filter((t) => t.status === 'approved').length,
    rejected: testimonials.filter((t) => t.status === 'rejected').length,
  };

  // Unique providers for filter dropdown
  const providers = Array.from(new Set(testimonials.map((t) => t.provider?.toLowerCase() ?? 'form')));

  function handleUpdate(id: string, patch: Partial<Testimonial>) {
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  async function quickApprove(e: React.MouseEvent, t: Testimonial) {
    e.stopPropagation();
    setSavingId(t.id);
    const patch: Partial<Testimonial> = { status: 'approved', approved_at: new Date().toISOString(), rejection_reason: null };
    const { error } = await supabase.from('testimonials').update(patch).eq('id', t.id);
    if (!error) {
      logAudit({ action: 'status_change', module: 'testimonials', recordId: t.id, description: `Depoimento de ${t.parent_name} aprovado`, oldData: { status: t.status }, newData: { status: 'approved' } });
      handleUpdate(t.id, patch);
    }
    setSavingId(null);
  }

  async function quickReject(e: React.MouseEvent, t: Testimonial) {
    e.stopPropagation();
    setSavingId(t.id);
    const patch: Partial<Testimonial> = { status: 'rejected' };
    const { error } = await supabase.from('testimonials').update(patch).eq('id', t.id);
    if (!error) {
      logAudit({ action: 'status_change', module: 'testimonials', recordId: t.id, description: `Depoimento de ${t.parent_name} recusado`, oldData: { status: t.status }, newData: { status: 'rejected' } });
      handleUpdate(t.id, patch);
    }
    setSavingId(null);
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-gray-900 dark:text-gray-100">Depoimentos</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {counts.pending > 0
                ? `${counts.pending} pendente${counts.pending > 1 ? 's' : ''} para revisão`
                : 'Nenhum depoimento pendente'}
            </p>
          </div>
        </div>
        <button
          onClick={fetchTestimonials}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-primary dark:hover:border-brand-secondary hover:text-brand-primary dark:hover:text-brand-secondary transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => {
          const sc = s === 'all' ? null : STATUS_CONFIG[s];
          const count = counts[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-brand-primary dark:hover:border-brand-secondary'
              }`}
            >
              {sc && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />}
              {s === 'all' ? 'Todos' : sc!.label}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou conteúdo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20 outline-none text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Provider filter */}
        <div className="relative">
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none text-sm appearance-none"
          >
            <option value="all">Todas as origens</option>
            {providers.map((p) => {
              const cfg = getProviderBadge(p === 'form' ? null : p);
              return <option key={p} value={p}>{cfg.label}</option>;
            })}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Data inicial"
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Data final"
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none text-sm"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-3 py-2.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-3">
          <MessageSquare className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nenhum depoimento encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const sc = STATUS_CONFIG[(t.status as TestimonialStatus)] ?? STATUS_CONFIG.pending;
            const prov = getProviderBadge(t.provider);
            const isSaving = savingId === t.id;

            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="w-full flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-primary/40 dark:hover:border-brand-secondary/40 hover:shadow-sm transition-all text-left group"
              >
                <Avatar name={t.parent_name} avatarUrl={t.avatar_url} size="md" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{t.parent_name}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${prov.color}`}>
                      {prov.label}
                    </span>
                    <StarRating rating={t.rating} size="sm" />
                    <span className="text-xs text-gray-400 ml-auto">{formatDate(t.created_at)}</span>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    "{t.content}"
                  </p>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sc.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>

                    {/* Quick actions — pending only */}
                    {t.status === 'pending' && canEdit && (
                      <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => quickApprove(e, t)}
                          disabled={isSaving}
                          title="Aprovar"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovar
                        </button>
                        <button
                          onClick={(e) => quickReject(e, t)}
                          disabled={isSaving}
                          title="Recusar"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 transition-colors disabled:opacity-40"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <TestimonialDrawer
          testimonial={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onRefresh={fetchTestimonials}
        />
      )}
    </div>
  );
}
