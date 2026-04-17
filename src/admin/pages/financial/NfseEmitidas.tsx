/**
 * NfseEmitidas
 *
 * Lista de NFS-e emitidas com drawer de detalhes (somente leitura).
 * Filtros: status, mês/ano, busca por nome do tomador.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  FileText, Eye, AlertCircle, Loader2, Search,
  Receipt, CheckCircle2, Clock, XCircle, Ban, RefreshCw,
  Send, MessageSquare, Check,
} from 'lucide-react';
import { logAudit } from '../../../lib/audit';

// ── Types ─────────────────────────────────────────────────────────────────────

type NfseStatus = 'pendente' | 'autorizada' | 'cancelada' | 'substituida' | 'rejeitada';

interface NfseEmitida {
  id: string;
  numero: string | null;
  serie: string | null;
  provider_nfse_id: string | null;
  tomador: Record<string, unknown> | null;
  servico: Record<string, unknown> | null;
  valor_servico: number | null;
  aliq_iss: number | null;
  valor_iss: number | null;
  valor_liquido: number | null;
  status: NfseStatus;
  link_pdf: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  installment_id: string | null;
  guardian_id: string | null;
}

interface EmissionLog {
  id: string;
  nfse_id: string;
  tentativa: number;
  dados_env: Record<string, unknown> | null;
  resposta: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function tomadorNome(tomador: Record<string, unknown> | null): string {
  if (!tomador) return '—';
  return (tomador.nome as string) || (tomador.razao_social as string) || '—';
}

function servicoDiscriminacao(servico: Record<string, unknown> | null, maxLen = 60): string {
  if (!servico) return '—';
  const d = (servico.discriminacao as string) || '';
  return d.length > maxLen ? d.slice(0, maxLen) + '…' : d || '—';
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<NfseStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente:    { label: 'Pendente',    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',      icon: Clock },
  autorizada:  { label: 'Autorizada',  cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',   cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',            icon: Ban },
  substituida: { label: 'Substituída', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',  icon: RefreshCw },
  rejeitada:   { label: 'Rejeitada',   cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',              icon: XCircle },
};

function StatusBadge({ status }: { status: NfseStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function LogStatusBadge({ status }: { status: string }) {
  const ok = status === 'success' || status === 'autorizada';
  const cls = ok
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ── Stats card ────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; count: number; value?: number; colorCls?: string }
function StatCard({ label, count, value, colorCls = 'text-gray-800 dark:text-white' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorCls}`}>{count}</p>
      {value != null && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtBRL(value)}</p>
      )}
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  nfse,
  onClose,
  onRefresh,
}: {
  nfse: NfseEmitida | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [logs, setLogs] = useState<EmissionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | 'cancel' | 'retry' | 'resend'>(null);
  const [actionDone, setActionDone] = useState<null | 'cancel' | 'retry' | 'resend'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!nfse) return;
    setActionError(null);
    setActionDone(null);
    setLoadingLogs(true);
    supabase
      .from('nfse_emission_log')
      .select('*')
      .eq('nfse_id', nfse.id)
      .order('tentativa', { ascending: true })
      .then(({ data }) => {
        setLogs((data ?? []) as EmissionLog[]);
        setLoadingLogs(false);
      });
  }, [nfse]);

  async function handleCancel() {
    if (!nfse) return;
    const motivo = prompt('Motivo do cancelamento (obrigatório por algumas prefeituras):', '');
    if (motivo === null) return;
    setActionLoading('cancel');
    setActionError(null);
    const { data, error } = await supabase.functions.invoke('nfse-cancel', {
      body: { nfse_id: nfse.id, motivo: motivo || undefined },
    });
    setActionLoading(null);
    if (error || !data?.ok) {
      const msg = error?.message ?? (typeof data?.detail === 'object' ? JSON.stringify(data.detail) : String(data?.detail ?? 'falha no cancelamento'));
      setActionError(msg);
      return;
    }
    logAudit({ action: 'update', module: 'nfse-emitidas', description: `NFS-e nº ${nfse.numero} cancelada` });
    setActionDone('cancel');
    onRefresh();
    setTimeout(() => { setActionDone(null); onClose(); }, 900);
  }

  async function handleRetry() {
    if (!nfse) return;
    setActionLoading('retry');
    setActionError(null);
    const servico = (nfse.servico ?? {}) as Record<string, unknown>;
    const { data, error } = await supabase.functions.invoke('nfse-emitter', {
      body: {
        source: nfse.installment_id ? 'installment' : 'receivable',
        source_id: nfse.installment_id ?? (nfse as NfseEmitida & { receivable_id?: string }).receivable_id,
        guardian_id: nfse.guardian_id,
        valor_servico: Number(nfse.valor_servico ?? 0),
        discriminacao: String(servico.discriminacao ?? `Reemissao NFS-e ${nfse.numero}`),
        initiated_by: (await supabase.auth.getUser()).data.user?.id,
      },
    });
    setActionLoading(null);
    if (error || !data?.success) {
      setActionError(error?.message ?? JSON.stringify(data ?? {}));
      return;
    }
    setActionDone('retry');
    onRefresh();
    setTimeout(() => { setActionDone(null); onClose(); }, 900);
  }

  async function handleResendPdf() {
    if (!nfse?.link_pdf || !nfse.guardian_id) return;
    setActionLoading('resend');
    setActionError(null);
    const { data: g } = await supabase
      .from('guardian_profiles')
      .select('telefone')
      .eq('id', nfse.guardian_id)
      .single();
    const phone = (g as { telefone?: string } | null)?.telefone;
    if (!phone) {
      setActionError('Responsável sem telefone cadastrado.');
      setActionLoading(null);
      return;
    }
    const { error } = await supabase.functions.invoke('message-orchestrator', {
      body: {
        phone,
        module: 'fiscal',
        body: `Sua NFS-e nº ${nfse.numero} está disponível. Link: ${nfse.link_pdf}`,
        priority: 1,
      },
    });
    setActionLoading(null);
    if (error) { setActionError(error.message); return; }
    logAudit({ action: 'update', module: 'nfse-emitidas', description: `PDF da NFS-e nº ${nfse.numero} reenviado` });
    setActionDone('resend');
    setTimeout(() => setActionDone(null), 1500);
  }

  if (!nfse) return null;

  const tomador = nfse.tomador ?? {};
  const servico = nfse.servico ?? {};

  return (
    <Drawer
      open={!!nfse}
      onClose={onClose}
      title={`NFS-e Nº ${nfse.numero ?? '—'}`}
      icon={Receipt}
      badge={<StatusBadge status={nfse.status} />}
      footer={
        <div className="flex flex-col gap-2">
          {actionError && (
            <p className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">{actionError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Fechar
            </button>
            {nfse.status === 'autorizada' && nfse.link_pdf && (
              <button
                onClick={handleResendPdf}
                disabled={actionLoading !== null}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  actionDone === 'resend'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
                }`}
              >
                {actionLoading === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" />
                 : actionDone === 'resend' ? <Check className="w-4 h-4" />
                 : <MessageSquare className="w-4 h-4" />}
                {actionLoading === 'resend' ? 'Enviando…' : actionDone === 'resend' ? 'Enviado!' : 'Reenviar PDF'}
              </button>
            )}
            {nfse.status === 'autorizada' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {actionLoading === 'cancel' ? 'Cancelando…' : 'Cancelar'}
              </button>
            )}
            {(nfse.status === 'rejeitada' || nfse.status === 'pendente') && (
              <button
                onClick={handleRetry}
                disabled={actionLoading !== null}
                className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  actionDone === 'retry'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
                }`}
              >
                {actionLoading === 'retry' ? <Loader2 className="w-4 h-4 animate-spin" />
                 : actionDone === 'retry' ? <Check className="w-4 h-4" />
                 : <Send className="w-4 h-4" />}
                {actionLoading === 'retry' ? 'Emitindo…' : actionDone === 'retry' ? 'Enviado!' : 'Emitir novamente'}
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Motivo rejeição */}
      {nfse.motivo_rejeicao && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{nfse.motivo_rejeicao}</p>
        </div>
      )}

      {/* Identificação */}
      <DrawerCard title="Identificação" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Número" value={nfse.numero ?? '—'} />
          <Field label="Série" value={nfse.serie ?? '—'} />
          <Field label="Status" value={<StatusBadge status={nfse.status} />} />
          <Field label="Data de Emissão" value={fmtDate(nfse.created_at)} />
          {nfse.provider_nfse_id && (
            <div className="col-span-2">
              <Field label="ID no Provider" value={nfse.provider_nfse_id} mono />
            </div>
          )}
        </div>
        {nfse.link_pdf && (
          <a
            href={nfse.link_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-dark transition-colors"
          >
            <Eye className="w-4 h-4" />
            Visualizar PDF
          </a>
        )}
      </DrawerCard>

      {/* Tomador */}
      <DrawerCard title="Tomador" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <Field label="Nome" value={(tomador.nome as string) || (tomador.razao_social as string) || '—'} />
          </div>
          <Field label="CPF/CNPJ" value={(tomador.cpf_cnpj as string) || (tomador.cnpj as string) || (tomador.cpf as string) || '—'} />
          {!!(tomador.email as string | undefined) && <Field label="E-mail" value={tomador.email as string} />}
          {(tomador.endereco as Record<string, unknown>) && (
            <div className="col-span-2">
              <Field
                label="Endereço"
                value={formatEndereco(tomador.endereco as Record<string, unknown>)}
              />
            </div>
          )}
        </div>
      </DrawerCard>

      {/* Serviço */}
      <DrawerCard title="Serviço" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {!!(servico.discriminacao as string | undefined) && (
            <div className="col-span-2">
              <p className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Discriminação</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{servico.discriminacao as string}</p>
            </div>
          )}
          {!!(servico.codigo_servico as string | undefined) && <Field label="Código Serviço" value={servico.codigo_servico as string} />}
          <Field label="Valor Serviço" value={fmtBRL(nfse.valor_servico)} />
          <Field label="Alíq. ISS" value={nfse.aliq_iss != null ? `${nfse.aliq_iss}%` : '—'} />
          <Field label="Valor ISS" value={fmtBRL(nfse.valor_iss)} />
          <Field label="Valor Líquido" value={fmtBRL(nfse.valor_liquido)} />
        </div>
      </DrawerCard>

      {/* Log de tentativas */}
      <DrawerCard title="Log de Tentativas" icon={FileText}>
        {loadingLogs ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando…
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhuma tentativa registrada.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-3 py-2.5 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Tentativa #{log.tentativa}
                  </p>
                  <p className="text-[11px] text-gray-400">{fmtDatetime(log.created_at)}</p>
                </div>
                <LogStatusBadge status={log.status} />
              </div>
            ))}
          </div>
        )}
      </DrawerCard>
    </Drawer>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {typeof value === 'string' || typeof value === 'number' ? (
        <p className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
      ) : (
        <div>{value}</div>
      )}
    </div>
  );
}

function formatEndereco(e: Record<string, unknown>): string {
  const parts: string[] = [];
  if (e.logradouro) parts.push(e.logradouro as string);
  if (e.numero) parts.push(`nº ${e.numero}`);
  if (e.bairro) parts.push(e.bairro as string);
  if (e.municipio) parts.push(e.municipio as string);
  if (e.uf) parts.push(e.uf as string);
  return parts.join(', ') || '—';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NfseEmitidas() {
  const [notas, setNotas] = useState<NfseEmitida[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NfseEmitida | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nfse_emitidas')
      .select('*')
      .order('created_at', { ascending: false });
    setNotas((data ?? []) as NfseEmitida[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const total       = notas.length;
  const autorizadas = notas.filter((n) => n.status === 'autorizada');
  const pendentes   = notas.filter((n) => n.status === 'pendente');
  const rejeitadas  = notas.filter((n) => n.status === 'rejeitada');

  const sumValor = (list: NfseEmitida[]) => list.reduce((s, n) => s + (n.valor_servico ?? 0), 0);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = notas.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterMonth) {
      const d = new Date(n.created_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym !== filterMonth) return false;
    }
    if (search) {
      const nome = tomadorNome(n.tomador).toLowerCase();
      if (!nome.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Emitidas"  count={total}              value={sumValor(notas)}       />
        <StatCard label="Autorizadas"     count={autorizadas.length} value={sumValor(autorizadas)} colorCls="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Pendentes"       count={pendentes.length}   value={sumValor(pendentes)}   colorCls="text-amber-600 dark:text-amber-400" />
        <StatCard label="Rejeitadas"      count={rejeitadas.length}  value={sumValor(rejeitadas)}  colorCls="text-red-600 dark:text-red-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tomador…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none"
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="autorizada">Autorizada</option>
          <option value="cancelada">Cancelada</option>
          <option value="substituida">Substituída</option>
          <option value="rejeitada">Rejeitada</option>
        </select>

        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma NFS-e encontrada</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Ajuste os filtros ou aguarde a emissão de notas.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
          {/* Header row */}
          <div className="hidden lg:grid lg:grid-cols-[80px_1fr_1fr_110px_100px_110px_120px_60px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-semibold tracking-widest uppercase text-gray-400">
            <span>Nº</span>
            <span>Tomador</span>
            <span>Serviço</span>
            <span>Valor</span>
            <span>ISS</span>
            <span>Status</span>
            <span>Data</span>
            <span className="text-right">Ver</span>
          </div>

          {filtered.map((nota) => (
            <div
              key={nota.id}
              onClick={() => setSelected(nota)}
              className="grid grid-cols-1 lg:grid-cols-[80px_1fr_1fr_110px_100px_110px_120px_60px] gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-white">
                {nota.numero ?? '—'}
              </p>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {tomadorNome(nota.tomador)}
                </p>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {servicoDiscriminacao(nota.servico)}
              </p>

              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {fmtBRL(nota.valor_servico)}
              </p>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {fmtBRL(nota.valor_iss)}
              </p>

              <div>
                <StatusBadge status={nota.status} />
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {fmtDate(nota.created_at)}
              </p>

              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelected(nota); }}
                  className="p-1.5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                  title="Ver detalhes"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer nfse={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  );
}
