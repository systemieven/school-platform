/**
 * NfeEmitidasPage
 *
 * Lista de NF-e modelo 55 emitidas (devolucao a fornecedor) com drawer
 * de detalhes e acoes:
 *   - Cancelar (status autorizada, janela SEFAZ 24h; exige justificativa 15-255 chars)
 *   - Abrir DANFE e XML (status autorizada)
 *
 * Emissao nasce em NfeEntradasPage (botao "Emitir devolucao").
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  FileText, Eye, AlertCircle, Loader2, Search,
  FileSignature, CheckCircle2, Clock, XCircle, Ban, ShieldOff, Undo2,
  Check, Download,
} from 'lucide-react';
import { logAudit } from '../../../lib/audit';

type NfeStatus = 'pendente' | 'autorizada' | 'cancelada' | 'rejeitada' | 'denegada' | 'inutilizada';

interface NfeEmitida {
  id: string;
  nfe_entry_id: string | null;
  tipo_operacao: string;
  numero: number | null;
  serie: number | null;
  chave_nfe: string | null;
  protocolo: string | null;
  provider_nfe_id: string | null;
  emitente: Record<string, unknown> | null;
  destinatario: Record<string, unknown> | null;
  itens: Array<Record<string, unknown>> | null;
  referencia: Record<string, unknown> | null;
  valor_total: number | null;
  motivo_operacao: string | null;
  link_danfe: string | null;
  link_xml: string | null;
  status: NfeStatus;
  motivo_rejeicao: string | null;
  motivo_cancelamento: string | null;
  autorizada_em: string | null;
  cancelada_em: string | null;
  created_at: string;
}

interface EmissionLog {
  id: string;
  nfe_id: string;
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

function destinatarioNome(d: Record<string, unknown> | null): string {
  if (!d) return 'Destinatario nao informado';
  return (d.razao_social as string) || 'Destinatario nao informado';
}

function destinatarioDoc(d: Record<string, unknown> | null): string {
  if (!d) return '—';
  return (d.cnpj_cpf as string) || '—';
}

function within24h(autorizadaEm: string | null): boolean {
  if (!autorizadaEm) return false;
  const autorizada = new Date(autorizadaEm).getTime();
  return Date.now() <= autorizada + 24 * 60 * 60 * 1000;
}

const STATUS_CONFIG: Record<NfeStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente:    { label: 'Pendente',     cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',       icon: Clock },
  autorizada:  { label: 'Autorizada',   cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', icon: CheckCircle2 },
  cancelada:   { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',             icon: Ban },
  rejeitada:   { label: 'Rejeitada',    cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',               icon: XCircle },
  denegada:    { label: 'Denegada',     cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',               icon: ShieldOff },
  inutilizada: { label: 'Inutilizada',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',             icon: Ban },
};

function StatusBadge({ status }: { status: NfeStatus }) {
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
  return <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-semibold ${cls}`}>{status}</span>;
}

interface StatCardProps { label: string; count: number; value?: number; colorCls?: string }
function StatCard({ label, count, value, colorCls = 'text-gray-800 dark:text-white' }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorCls}`}>{count}</p>
      {value != null && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fmtBRL(value)}</p>}
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
  nfe,
  onClose,
  onRefresh,
}: {
  nfe: NfeEmitida | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [logs, setLogs] = useState<EmissionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState<null | 'cancel'>(null);
  const [actionDone, setActionDone] = useState<null | 'cancel'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!nfe) return;
    setActionError(null);
    setActionDone(null);
    setLoadingLogs(true);
    supabase
      .from('nfe_emission_log')
      .select('*')
      .eq('nfe_id', nfe.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setLogs((data ?? []) as EmissionLog[]);
        setLoadingLogs(false);
      });
  }, [nfe]);

  async function handleCancel() {
    if (!nfe) return;
    const motivo = prompt(
      'Justificativa do cancelamento (15 a 255 caracteres, exigencia da SEFAZ):',
      '',
    );
    if (motivo === null) return;
    if (motivo.trim().length < 15 || motivo.trim().length > 255) {
      setActionError('Justificativa precisa ter entre 15 e 255 caracteres.');
      return;
    }
    setActionLoading('cancel');
    setActionError(null);
    const { data, error } = await supabase.functions.invoke('nfe-cancel', {
      body: { nfe_id: nfe.id, motivo },
    });
    setActionLoading(null);
    if (error || !data?.ok) {
      const msg = error?.message ?? (typeof data?.detail === 'object' ? JSON.stringify(data.detail) : String(data?.detail ?? data?.error ?? 'falha no cancelamento'));
      setActionError(msg);
      return;
    }
    logAudit({ action: 'update', module: 'fiscal', description: `NF-e nº ${nfe.numero} cancelada` });
    setActionDone('cancel');
    onRefresh();
    setTimeout(() => { setActionDone(null); onClose(); }, 900);
  }

  if (!nfe) return null;

  const destinatario = nfe.destinatario ?? {};
  const itens = nfe.itens ?? [];
  const chaveRef = (nfe.referencia?.chave_nfe_original as string | undefined) ?? null;

  return (
    <Drawer
      open={!!nfe}
      onClose={onClose}
      title={`NF-e Nº ${nfe.numero ?? '—'}`}
      icon={FileSignature}
      badge={<StatusBadge status={nfe.status} />}
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
            {nfe.status === 'autorizada' && within24h(nfe.autorizada_em) && (
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
            {nfe.status === 'autorizada' && !within24h(nfe.autorizada_em) && (
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs text-gray-400 border border-gray-200 dark:border-gray-700">
                Prazo SEFAZ de 24h expirado
              </span>
            )}
          </div>
        </div>
      }
    >
      {nfe.motivo_rejeicao && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{nfe.motivo_rejeicao}</p>
        </div>
      )}

      {nfe.motivo_cancelamento && (
        <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 px-4 py-3">
          <Ban className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Cancelada em {fmtDatetime(nfe.cancelada_em)}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{nfe.motivo_cancelamento}</p>
          </div>
        </div>
      )}

      <DrawerCard title="Identificação" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Número" value={nfe.numero ?? '—'} />
          <Field label="Série" value={nfe.serie ?? '—'} />
          <Field label="Operação" value={nfe.tipo_operacao === 'devolucao' ? 'Devolução' : nfe.tipo_operacao} />
          <Field label="Emissão" value={fmtDate(nfe.created_at)} />
          {nfe.autorizada_em && <Field label="Autorizada em" value={fmtDatetime(nfe.autorizada_em)} />}
          {nfe.chave_nfe && (
            <div className="col-span-2"><Field label="Chave NF-e" value={nfe.chave_nfe} mono /></div>
          )}
          {nfe.protocolo && (
            <div className="col-span-2"><Field label="Protocolo" value={nfe.protocolo} mono /></div>
          )}
          {chaveRef && (
            <div className="col-span-2"><Field label="Chave NF-e original (referenciada)" value={chaveRef} mono /></div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-1">
          {nfe.link_danfe && (
            <a
              href={nfe.link_danfe}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary-dark transition-colors"
            >
              <Eye className="w-4 h-4" /> DANFE
            </a>
          )}
          {nfe.link_xml && (
            <a
              href={nfe.link_xml}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-primary/40 text-brand-primary text-sm font-medium hover:bg-brand-primary/5 transition-colors"
            >
              <Download className="w-4 h-4" /> XML
            </a>
          )}
        </div>
      </DrawerCard>

      <DrawerCard title="Destinatário (Fornecedor)" icon={FileText}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-2"><Field label="Razão Social" value={destinatarioNome(destinatario)} /></div>
          <Field label="CNPJ/CPF" value={destinatarioDoc(destinatario)} />
          {typeof destinatario.ie === 'string' && <Field label="IE" value={destinatario.ie as string} />}
          {typeof destinatario.municipio === 'string' && <Field label="Município" value={destinatario.municipio as string} />}
          {typeof destinatario.uf === 'string' && <Field label="UF" value={destinatario.uf as string} />}
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
                    {item.ncm ? ` · NCM ${item.ncm}` : ''}
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
          <Field label="Total" value={<span className="text-base font-bold">{fmtBRL(nfe.valor_total)}</span>} />
          {nfe.motivo_operacao && <Field label="Motivo" value={nfe.motivo_operacao} />}
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

export default function NfeEmitidasPage() {
  const [notas, setNotas] = useState<NfeEmitida[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NfeEmitida | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nfe_emitidas')
      .select('*')
      .order('created_at', { ascending: false });
    setNotas((data ?? []) as NfeEmitida[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total       = notas.length;
  const autorizadas = notas.filter((n) => n.status === 'autorizada');
  const pendentes   = notas.filter((n) => n.status === 'pendente');
  const rejeitadas  = notas.filter((n) => n.status === 'rejeitada' || n.status === 'denegada');

  const sumValor = (list: NfeEmitida[]) => list.reduce((s, n) => s + (n.valor_total ?? 0), 0);

  const filtered = notas.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterMonth) {
      const d = new Date(n.created_at);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (ym !== filterMonth) return false;
    }
    if (search) {
      const nome = destinatarioNome(n.destinatario).toLowerCase();
      const doc = destinatarioDoc(n.destinatario).toLowerCase();
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
            placeholder="Buscar por fornecedor, CNPJ ou número…"
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
          <FileSignature className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma NF-e emitida</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Emita NF-e de devolução a partir de NF-e de Entrada.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
          <div className="hidden lg:grid lg:grid-cols-[80px_1fr_140px_90px_110px_110px_120px_60px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-semibold tracking-widest uppercase text-gray-400">
            <span>Nº</span>
            <span>Destinatário</span>
            <span>CNPJ</span>
            <span>Operação</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Data</span>
            <span className="text-right">Ver</span>
          </div>

          {filtered.map((nota) => (
            <div
              key={nota.id}
              onClick={() => setSelected(nota)}
              className="grid grid-cols-1 lg:grid-cols-[80px_1fr_140px_90px_110px_110px_120px_60px] gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <p className="text-sm font-mono font-semibold text-gray-800 dark:text-white">{nota.numero ?? '—'}</p>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {destinatarioNome(nota.destinatario)}
                </p>
              </div>

              <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                {destinatarioDoc(nota.destinatario)}
              </p>

              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <Undo2 className="w-3 h-3" />
                {nota.tipo_operacao === 'devolucao' ? 'Devol.' : nota.tipo_operacao}
              </span>

              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{fmtBRL(nota.valor_total)}</p>

              <div><StatusBadge status={nota.status} /></div>

              <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(nota.created_at)}</p>

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

      <DetailDrawer nfe={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  );
}
