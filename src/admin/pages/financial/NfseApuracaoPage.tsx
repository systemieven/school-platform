/**
 * NfseApuracaoPage
 *
 * Apuração mensal de NFS-e: totais, ISS a recolher, retenções e exportação CSV.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarChart3, Download, Loader2, Receipt } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NfseStatus = 'pendente' | 'autorizada' | 'cancelada' | 'substituida' | 'rejeitada';

interface NfseEmitida {
  id: string;
  numero: string | null;
  serie: string | null;
  tomador: Record<string, unknown> | null;
  servico: Record<string, unknown> | null;
  valor_servico: number | null;
  aliq_iss: number | null;
  valor_iss: number | null;
  valor_liquido: number | null;
  status: NfseStatus;
  created_at: string;
  // Retenções opcionais
  valor_iss_retido?: number | null;
  valor_pis?: number | null;
  valor_cofins?: number | null;
  valor_csll?: number | null;
  valor_irpj?: number | null;
  valor_inss?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function tomadorNome(tomador: Record<string, unknown> | null): string {
  if (!tomador) return '—';
  return (tomador.nome as string) || (tomador.razao_social as string) || '—';
}

function sumField(list: NfseEmitida[], key: keyof NfseEmitida): number {
  return list.reduce((s, n) => s + ((n[key] as number) ?? 0), 0);
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const endDate = new Date(y, m, 1);
  const end = endDate.toISOString();
  return { start, end };
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        highlight
          ? 'bg-brand-primary/5 dark:bg-brand-primary/10 border-brand-primary/20 dark:border-brand-primary/30'
          : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
      }`}
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-brand-primary dark:text-brand-secondary' : 'text-gray-800 dark:text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Status breakdown ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<NfseStatus, string> = {
  pendente:    'Pendente',
  autorizada:  'Autorizada',
  cancelada:   'Cancelada',
  substituida: 'Substituída',
  rejeitada:   'Rejeitada',
};

const STATUS_DOT: Record<NfseStatus, string> = {
  pendente:    'bg-amber-400',
  autorizada:  'bg-emerald-500',
  cancelada:   'bg-gray-400',
  substituida: 'bg-purple-500',
  rejeitada:   'bg-red-500',
};

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(notas: NfseEmitida[], monthLabel: string) {
  const headers = [
    'Número', 'Série', 'Tomador', 'Status',
    'Valor Serviço', 'Alíq. ISS (%)', 'Valor ISS', 'Valor Líquido',
    'ISS Retido', 'PIS', 'COFINS', 'CSLL', 'IRPJ', 'INSS',
    'Data Emissão',
  ];

  const rows = notas.map((n) => [
    n.numero ?? '',
    n.serie ?? '',
    tomadorNome(n.tomador),
    n.status,
    (n.valor_servico ?? 0).toFixed(2),
    (n.aliq_iss ?? 0).toFixed(4),
    (n.valor_iss ?? 0).toFixed(2),
    (n.valor_liquido ?? 0).toFixed(2),
    (n.valor_iss_retido ?? 0).toFixed(2),
    (n.valor_pis ?? 0).toFixed(2),
    (n.valor_cofins ?? 0).toFixed(2),
    (n.valor_csll ?? 0).toFixed(2),
    (n.valor_irpj ?? 0).toFixed(2),
    (n.valor_inss ?? 0).toFixed(2),
    fmtDate(n.created_at),
  ]);

  const csv = [headers, ...rows].map((r) => r.join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nfse_apuracao_${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NfseApuracaoPage() {
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [notas, setNotas] = useState<NfseEmitida[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (ym: string) => {
    setLoading(true);
    const { start, end } = monthBounds(ym);
    const { data } = await supabase
      .from('nfse_emitidas')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true });
    setNotas((data ?? []) as NfseEmitida[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  // ── Derived values ────────────────────────────────────────────────────────

  const autorizadas = notas.filter((n) => n.status === 'autorizada');

  const totalNotas = notas.length;
  const totalServicos = sumField(notas, 'valor_servico');

  // ISS a recolher = ISS de autorizadas onde ISS NÃO foi retido
  const issRecolher = autorizadas
    .filter((n) => !n.valor_iss_retido)
    .reduce((s, n) => s + (n.valor_iss ?? 0), 0);

  const issRetido = sumField(autorizadas, 'valor_iss_retido' as keyof NfseEmitida);

  const totalPis    = sumField(notas, 'valor_pis'    as keyof NfseEmitida);
  const totalCofins = sumField(notas, 'valor_cofins' as keyof NfseEmitida);
  const totalCsll   = sumField(notas, 'valor_csll'   as keyof NfseEmitida);
  const totalIrpj   = sumField(notas, 'valor_irpj'   as keyof NfseEmitida);
  const totalInss   = sumField(notas, 'valor_inss'   as keyof NfseEmitida);
  const hasRetencoes = totalPis + totalCofins + totalCsll + totalIrpj + totalInss > 0;

  // Breakdown por status
  const statusBreakdown = (['autorizada', 'pendente', 'cancelada', 'substituida', 'rejeitada'] as NfseStatus[]).map((s) => {
    const list = notas.filter((n) => n.status === s);
    return {
      status: s,
      count: list.length,
      valor: sumField(list, 'valor_servico'),
      iss: sumField(list, 'valor_iss'),
    };
  }).filter((r) => r.count > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-brand-primary" />
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">Apuração Mensal de NFS-e</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Resumo fiscal do período selecionado</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none"
          />
          {notas.length > 0 && (
            <button
              onClick={() => exportCsv(notas, month)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary-dark transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : notas.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhuma NFS-e no período</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Selecione outro mês ou aguarde a emissão de notas.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Total de Notas"
              value={String(totalNotas)}
              sub={`${autorizadas.length} autorizada${autorizadas.length !== 1 ? 's' : ''}`}
            />
            <SummaryCard
              label="Total Serviços"
              value={fmtBRL(totalServicos)}
              sub="autorizadas + pendentes"
            />
            <SummaryCard
              label="ISS a Recolher"
              value={fmtBRL(issRecolher)}
              sub="notas autorizadas sem retenção"
              highlight
            />
            <SummaryCard
              label="ISS Retido"
              value={fmtBRL(issRetido)}
              sub="retido na fonte pelo tomador"
            />
          </div>

          {/* Breakdown table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400">Breakdown por Status</p>
            </div>
            <div>
              <div className="hidden lg:grid lg:grid-cols-[200px_80px_1fr_1fr] gap-4 px-5 py-2.5 text-[10px] font-semibold tracking-widest uppercase text-gray-400 border-b border-gray-50 dark:border-gray-800">
                <span>Status</span>
                <span className="text-right">Qtd</span>
                <span className="text-right">Valor Serviços</span>
                <span className="text-right">Valor ISS</span>
              </div>
              {statusBreakdown.map((row) => (
                <div
                  key={row.status}
                  className="grid grid-cols-1 lg:grid-cols-[200px_80px_1fr_1fr] gap-4 px-5 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 items-center"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[row.status]}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {STATUS_LABELS[row.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 lg:text-right font-semibold">{row.count}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 lg:text-right">{fmtBRL(row.valor)}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 lg:text-right">{fmtBRL(row.iss)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Retenções card (só exibe se houver valores) */}
          {hasRetencoes && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-semibold tracking-[0.12em] uppercase text-gray-400">Retenções na Fonte</p>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
                <RetencaoItem label="PIS"    value={totalPis} />
                <RetencaoItem label="COFINS" value={totalCofins} />
                <RetencaoItem label="CSLL"   value={totalCsll} />
                <RetencaoItem label="IRPJ"   value={totalIrpj} />
                <RetencaoItem label="INSS"   value={totalInss} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RetencaoItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-800 dark:text-white">{fmtBRL(value)}</p>
    </div>
  );
}
