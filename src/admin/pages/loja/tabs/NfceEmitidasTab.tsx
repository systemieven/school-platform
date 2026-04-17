/**
 * NfceEmitidasTab
 *
 * Lista de NFC-e emitidas (modelo 65) com drawer de detalhes e acoes:
 *   - Reemitir (status pendente/rejeitada)
 *   - Cancelar (status autorizada; exige justificativa >=15 caracteres)
 *   - Abrir DANFE e QRCode (status autorizada)
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import {
  FileText, Eye, AlertCircle, Loader2, Search,
  Receipt, CheckCircle2, Clock, XCircle, Ban, ShieldOff,
  Send, Check, QrCode,
} from 'lucide-react';
import { logAudit } from '../../../../lib/audit';

type NfceStatus = 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada' | 'denegada' | 'inutilizada';

interface NfceEmitida {
  id: string;
  order_id: string | null;
  numero: number | null;
  serie: number | null;
  chave_nfce: string | null;
  protocolo: string | null;
  provider_nfce_id: string | null;
  emitente: Record<string, unknown> | null;
  consumidor: Record<string, unknown> | null;
  itens: Array<Record<string, unknown>> | null;
  valor_total: number | null;
  valor_desconto: number | null;
  forma_pagamento: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  qrcode_url: string | null;
  status: NfceStatus;
  motivo_rejeicao: string | null;
  motivo_cancelamento: string | null;
  cancelada_em: string | null;
  created_at: string;
}

interface EmissionLog {
  id: string;
  nfce_id: string;
  tentativa: number | null;
  dados_env: Record<string, unknown> | null;
  resposta: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

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

function consumidorNome(c: Record<string, unknown> | null): string {
  if (!c) return 'Consumidor nao identificado';
  return (c.nome as string) || 'Consumidor nao identificado';
}

function consumidorDoc(c: Record<string, unknown> | null): string {
  if (!c) return '—';
  return (c.cpf_cnpj as string) || '—';
}

const STATUS_CONFIG: Record<NfceStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente:    { label: 'Pendente',     cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',       icon: Clock },
  autorizada:  { label: 'Autorizada',   cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',             icon: Ban },
  rejeitada:   { label: 'Rejeitada',    cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',               icon: XCircle },
  denegada:    { label: 'Denegada',     cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',               icon: ShieldOff },
  inutilizada: { label: 'Inutilizada',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',             icon: Ban },
};

function StatusBadge({ status }: { status: NfceStatus }) {
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

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {typeof value === 'string' || typeof value === 'number' ? (
        <p className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono text-xs break-all' : ''}`}>{value}</p>
      ) : (
        <div>{value}</div>
      )}
    </div>
  );
}

function DetailDrawer({
  nfce,
  onClose,
  onRefresh,
}: {
  nfce: NfceEmitida | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [logs, setLogs] = useState<EmissionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | 'cancel' | 'retry'>(null);
  const [actionDone, setActionDone] = useState<null | 'cancel' | 'retry'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!nfce) return;
    setActionError(null);
    setActionDone(null);
    setLoadingLogs(true);
    supabase
      .from('nfce_emission_log')
      .select('*')
      .eq('nfce_id', nfce.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setLogs((data ?? []) as EmissionLog[]);
        setLoadingLogs(false);
      });
  }, [nfce]);

  async function handleCancel() {
    if (!nfce) return;
    const motivo = prompt(
      'Justificativa do cancelamento (mínimo 15 caracteres, exigência da SEFAZ):',
      '',
    );
    if (motivo === null) return;
    if (motivo.trim().length < 15) {
      setActionError('Justificativa precisa ter pelo menos 15 caracteres.');
      return;
    }
    setActionLoading('cancel');
    setActionError(null);
    const { data, error } = await supabase.functions.invoke('nfce-cancel', {
      body: { nfce_id: nfce.id, motivo },
    });
    setActionLoading(null);
    if (error || !data?.ok) {
      const msg = error?.message ?? (typeof data?.detail === 'object' ? JSON.stringify(data.detail) : String(data?.detail ?? 'falha no cancelamento'));
      setActionError(msg);
      return;
    }
    logAudit({ action: 'update', module: 'nfce-emitidas', description: `NFC-e nº ${nfce.numero} cancelada` });
    setActionDone('cancel');
    onRefresh();
    setTimeout(() => { setActionDone(null); onClose(); }, 900);
  }

  async function handleRetry() {
    if (!nfce?.order_id) {
      setActionError('NFC-e sem pedido vinculado — não é possível reemitir.');
      return;
    }
    setActionLoading('retry');
    setActionError(null);
    const { data, error } = await supabase.functions.invoke('nfce-emitter', {
      body: {
        order_id: nfce.order_id,
        initiated_by: (await supabase.auth.getUser()).data.user?.id,
      },
    });
    setActionLoading(null);
    if (error || !data?.success) {
      setActionError(error?.message ?? JSON.stringify(data ?? {}));
      return;
    }
    logAudit({ action: 'update', module: 'nfce-emitidas', description: `Reemissão de NFC-e (original nº ${nfce.numero})` });
    setActionDone('retry');
    onRefresh();
    setTimeout(() => { setActionDone(null); onClose(); }, 900);
  }

  if (!nfce) return null;

  const consumidor = nfce.consumidor ?? {};
  const itens = nfce.itens ?? [];

  return (
    <Drawer
      open={!!nfce}
      onClose={onClose}
      title={`NFC-e Nº ${nfce.numero ?? '—'}`}
      icon={Receipt}
      badge={<StatusBadge status={nfce.status} />}
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
            {nfce.status === 'autorizada' && (
              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" />
                 : actionDone === 'cancel' ? <Check className="w-4 h-4" />
                 : <Ban className="w-4 h-4" />}
                {actionLoading === 'cancel' ? 'Cancelando…' : actionDone === 'cancel' ? 'Cancelada!' : 'Cancelar'}
              </button>
            )}
            {(nfce.status === 'rejeitada' || nfce.status === 'pendente') && nfce.order_id && (
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
      {nfce.motivo_rejeicao && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{nfce.motivo_rejeicao}</p>
        </div>
      )}

      {nfce.motivo_cancelamento && (
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-4 py-3">
          <Ban className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Cancelada em {fmtDatetime(nfce.cancelada_em)}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{nfce.motivo_cancelamento}</p>
          </div>
        </div>
      )}

      <DrawerCard title="Identificação" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Número" value={nfce.numero ?? '—'} />
          <Field label="Série" value={nfce.serie ?? '—'} />
          <Field label="Status" value={<StatusBadge status={nfce.status} />} />
          <Field label="Emissão" value={fmtDate(nfce.created_at)} />
          {nfce.chave_nfce && (
            <div className="col-span-2">
              <Field label="Chave NFC-e" value={nfce.chave_nfce} mono />
            </div>
          )}
          {nfce.protocolo && (
            <div className="col-span-2">
              <Field label="Protocolo" value={nfce.protocolo} mono />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-1">
          {nfce.link_danfe && (
            <a
              href={nfce.link_danfe}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-dark transition-colors"
            >
              <Eye className="w-4 h-4" /> DANFE
            </a>
          )}
          {nfce.qrcode_url && (
            <a
              href={nfce.qrcode_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-primary/40 text-brand-primary text-sm font-medium hover:bg-brand-primary/5 transition-colors"
            >
              <QrCode className="w-4 h-4" /> QRCode
            </a>
          )}
        </div>
      </DrawerCard>

      <DrawerCard title="Consumidor" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <Field label="Nome" value={consumidorNome(consumidor)} />
          </div>
          <Field label="CPF/CNPJ" value={consumidorDoc(consumidor)} />
        </div>
      </DrawerCard>

      <DrawerCard title="Itens" icon={FileText}>
        {itens.length === 0 ? (
          <p className="text-sm text-gray-400">Sem itens registrados.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {(item.descricao as string) ?? '—'}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {Number(item.quantidade ?? 0)} × {fmtBRL(Number(item.valor_unitario ?? 0))}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {fmtBRL(Number(item.valor_total ?? 0))}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
          <Field label="Desconto" value={fmtBRL(nfce.valor_desconto)} />
          <Field label="Total" value={<span className="text-base font-bold">{fmtBRL(nfce.valor_total)}</span>} />
          {nfce.forma_pagamento && <Field label="Pagamento" value={nfce.forma_pagamento} />}
        </div>
      </DrawerCard>

      <DrawerCard title="Log de Tentativas" icon={FileText}>
        {loadingLogs ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
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
                    {log.tentativa ? `Tentativa #${log.tentativa}` : 'Callback do provider'}
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

export default function NfceEmitidasTab() {
  const [notas, setNotas] = useState<NfceEmitida[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NfceEmitida | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nfce_emitidas')
      .select('*')
      .order('created_at', { ascending: false });
    setNotas((data ?? []) as NfceEmitida[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total       = notas.length;
  const autorizadas = notas.filter((n) => n.status === 'autorizada');
  const pendentes   = notas.filter((n) => n.status === 'pendente');
  const rejeitadas  = notas.filter((n) => n.status === 'rejeitada' || n.status === 'denegada');

  const sumValor = (list: NfceEmitida[]) => list.reduce((s, n) => s + (n.valor_total ?? 0), 0);

  const filtered = notas.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterMonth) {
      const d = new Date(n.created_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym !== filterMonth) return false;
    }
    if (search) {
      const nome = consumidorNome(n.consumidor).toLowerCase();
      const doc = consumidorDoc(n.consumidor).toLowerCase();
      const num = String(n.numero ?? '').toLowerCase();
      const q = search.toLowerCase();
      if (!nome.includes(q) && !doc.includes(q) && !num.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Emitidas" count={total}              value={sumValor(notas)}       />
        <StatCard label="Autorizadas"    count={autorizadas.length} value={sumValor(autorizadas)} colorCls="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Pendentes"      count={pendentes.length}   value={sumValor(pendentes)}   colorCls="text-amber-600 dark:text-amber-400" />
        <StatCard label="Rejeitadas"     count={rejeitadas.length}  value={sumValor(rejeitadas)}  colorCls="text-red-600 dark:text-red-400" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por consumidor, CPF ou número…"
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
          <option value="rejeitada">Rejeitada</option>
          <option value="denegada">Denegada</option>
          <option value="inutilizada">Inutilizada</option>
        </select>

        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma NFC-e encontrada</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Ajuste os filtros ou aguarde a emissão de notas.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[80px_1fr_140px_110px_110px_120px_60px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-semibold tracking-widest uppercase text-gray-400">
            <span>Nº</span>
            <span>Consumidor</span>
            <span>CPF/CNPJ</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Data</span>
            <span className="text-right">Ver</span>
          </div>

          {filtered.map((nota) => (
            <div
              key={nota.id}
              onClick={() => setSelected(nota)}
              className="grid grid-cols-1 lg:grid-cols-[80px_1fr_140px_110px_110px_120px_60px] gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-white">
                {nota.numero ?? '—'}
              </p>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {consumidorNome(nota.consumidor)}
                </p>
              </div>

              <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                {consumidorDoc(nota.consumidor)}
              </p>

              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {fmtBRL(nota.valor_total)}
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

      <DetailDrawer nfce={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  );
}
