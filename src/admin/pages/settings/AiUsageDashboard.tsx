/**
 * AiUsageDashboard
 *
 * Tela raiz da aba Configurações → IA. Agrega telemetria interna
 * (RPC `ai_usage_stats` sobre `ai_usage_log`) + snapshots oficiais
 * de gasto dos providers (`ai_usage_snapshots`). Exibe KPIs por
 * período, gasto histórico por provider, gráfico de custo e top agentes.
 *
 * Nota: saldo/créditos restantes NÃO são expostos pelas Admin APIs
 * (nem Anthropic nem OpenAI). Por isso o painel mostra apenas gasto
 * real — para saldo, link direto para o console do provider.
 *
 * Sincronização: a Edge Function `ai-billing-sync` atualiza os
 * snapshots diariamente via `pg_cron` às 00:01 UTC. Botão
 * "Atualizar agora" chama `ai-billing-manual-refresh` (rate-limit
 * de 5 min entre chamadas).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { SettingsCard } from '../../components/SettingsCard';
import {
  Activity, Brain, RefreshCw, Loader2, TrendingUp, AlertTriangle,
  DollarSign, Zap, Clock, ExternalLink,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'custom';
type Provider = 'anthropic' | 'openai';

interface UsageStats {
  kpis: {
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    avg_latency_ms: number;
    errors: number;
  };
  daily: Array<{
    day: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  }>;
  top: Array<{
    agent_slug: string;
    provider: string;
    requests: number;
    input_tokens: number;
    output_tokens: number;
  }>;
}

interface SnapshotRow {
  provider: Provider;
  snapshot_date: string;
  total_spent_usd: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  requests_count: number | null;
  fetched_at: string;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const PROVIDER_CONSOLE: Record<Provider, string> = {
  anthropic: 'https://console.anthropic.com/settings/billing',
  openai: 'https://platform.openai.com/settings/organization/billing/overview',
};

const PROVIDER_COLOR: Record<Provider, string> = {
  anthropic: 'amber',
  openai: 'emerald',
};

function periodRange(p: Period, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (p === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start.toISOString(), to: endOfDay.toISOString() };
  }
  if (p === 'week') {
    const start = new Date(now.getTime() - 7 * 86400000);
    return { from: start.toISOString(), to: endOfDay.toISOString() };
  }
  if (p === 'month') {
    const start = new Date(now.getTime() - 30 * 86400000);
    return { from: start.toISOString(), to: endOfDay.toISOString() };
  }
  return {
    from: custom?.from ? new Date(custom.from).toISOString() : new Date(0).toISOString(),
    to: custom?.to ? new Date(custom.to + 'T23:59:59').toISOString() : endOfDay.toISOString(),
  };
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Number(n).toFixed(2)}`;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(Math.round(Number(n)));
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pt-BR');
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AiUsageDashboard() {
  const [period, setPeriod] = useState<Period>('week');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  const range = useMemo(
    () => periodRange(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [statsRes, snapsRes] = await Promise.all([
      supabase.rpc('ai_usage_stats', {
        p_from: range.from,
        p_to: range.to,
        p_provider: null,
        p_agent_slug: null,
      }),
      supabase
        .from('ai_usage_snapshots')
        .select('provider, snapshot_date, total_spent_usd, tokens_input, tokens_output, requests_count, fetched_at')
        .order('snapshot_date', { ascending: false })
        .limit(60),
    ]);

    setStats((statsRes.data as UsageStats | null) ?? null);
    setSnapshots((snapsRes.data ?? []) as SnapshotRow[]);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const lastSync = snapshots[0]?.fetched_at ?? null;

  const perProviderSpent = useMemo(() => {
    const acc: Record<Provider, number> = { anthropic: 0, openai: 0 };
    for (const s of snapshots) acc[s.provider] = (acc[s.provider] ?? 0) + Number(s.total_spent_usd ?? 0);
    return acc;
  }, [snapshots]);

  const perProviderTokens = useMemo(() => {
    const acc: Record<Provider, { input: number; output: number; requests: number }> = {
      anthropic: { input: 0, output: 0, requests: 0 },
      openai: { input: 0, output: 0, requests: 0 },
    };
    for (const s of snapshots) {
      acc[s.provider].input += Number(s.tokens_input ?? 0);
      acc[s.provider].output += Number(s.tokens_output ?? 0);
      acc[s.provider].requests += Number(s.requests_count ?? 0);
    }
    return acc;
  }, [snapshots]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError('');
    const { data, error } = await supabase.functions.invoke('ai-billing-manual-refresh', { body: {} });
    setRefreshing(false);
    if (error) {
      setRefreshError(error.message);
      return;
    }
    const typed = data as { error?: string; retry_after_seconds?: number };
    if (typed?.error === 'rate_limited') {
      setRefreshError(`Aguarde ${typed.retry_after_seconds}s para sincronizar novamente.`);
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const kpis = stats?.kpis ?? { requests: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, avg_latency_ms: 0, errors: 0 };
  const maxDailyCost = Math.max(1, ...(stats?.daily?.map((d) => d.cost_usd) ?? []));

  return (
    <div className="space-y-4">
      {/* Header: filtros + botão atualizar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 hover:bg-gray-100'
              }`}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : p === 'month' ? 'Mês' : 'Personalizado'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1"
              />
              <span className="text-xs text-gray-400">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Última sync: <span className="font-mono text-gray-500 dark:text-gray-300">{fmtDateTime(lastSync)}</span>
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary-dark disabled:opacity-50 transition-colors"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {refreshing ? 'Sincronizando…' : 'Atualizar agora'}
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" /> {refreshError}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Zap}        label="Chamadas"        value={fmtInt(kpis.requests)}     sub={`${kpis.errors} erro(s)`}  color="blue" />
        <KpiCard icon={Activity}   label="Tokens totais"   value={fmtInt(kpis.input_tokens + kpis.output_tokens)} sub={`${fmtInt(kpis.input_tokens)} in · ${fmtInt(kpis.output_tokens)} out`} color="purple" />
        <KpiCard icon={DollarSign} label="Custo estimado"  value={fmtUsd(kpis.cost_usd)}     sub="Calculado por modelo"      color="emerald" />
        <KpiCard icon={Clock}      label="Latência média"  value={`${kpis.avg_latency_ms}ms`} sub="Por chamada"               color="amber" />
      </div>

      {/* Gasto por provider (snapshots oficiais) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(['anthropic', 'openai'] as const).map((prov) => {
          const spent = perProviderSpent[prov];
          const tok = perProviderTokens[prov];
          const color = PROVIDER_COLOR[prov];
          return (
            <div
              key={prov}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 flex items-center justify-center`}>
                    <Brain className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                  </div>
                  <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">{PROVIDER_LABEL[prov]}</h3>
                </div>
                <a
                  href={PROVIDER_CONSOLE[prov]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-primary dark:text-brand-secondary hover:underline inline-flex items-center gap-1"
                >
                  Ver saldo no console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Gasto histórico</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{fmtUsd(spent)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Chamadas</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">{fmtInt(tok.requests)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">Tokens</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">{fmtInt(tok.input + tok.output)}</p>
                  <p className="text-[10px] text-gray-400">{fmtInt(tok.input)} in · {fmtInt(tok.output)} out</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 italic">
                Gasto extraído do cost_report oficial. Saldo/créditos não são expostos via API — consulte no console.
              </p>
            </div>
          );
        })}
      </div>

      {/* Gráfico de custo diário + top agentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SettingsCard title="Custo diário (período)" icon={TrendingUp} description="Custo estimado agregado por dia com base em ai_usage_log.">
          {(stats?.daily?.length ?? 0) === 0 ? (
            <p className="text-xs text-gray-400">Sem dados no período selecionado.</p>
          ) : (
            <div className="space-y-1.5">
              {stats!.daily.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-gray-500 font-mono">{fmtDate(d.day)}</span>
                  <div className="flex-1 h-5 bg-gray-50 dark:bg-gray-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-brand-primary"
                      style={{ width: `${Math.min(100, (d.cost_usd / maxDailyCost) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-semibold text-gray-700 dark:text-gray-200">{fmtUsd(d.cost_usd)}</span>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>

        <SettingsCard title="Top agentes" icon={Brain} description="Agentes mais chamados no período.">
          {(stats?.top?.length ?? 0) === 0 ? (
            <p className="text-xs text-gray-400">Sem chamadas registradas.</p>
          ) : (
            <div className="space-y-1.5">
              {stats!.top.map((t) => (
                <div key={`${t.agent_slug}-${t.provider}`} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{t.agent_slug}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{t.provider}</span>
                  </span>
                  <span className="w-14 text-right font-semibold text-gray-700 dark:text-gray-200">{fmtInt(t.requests)}</span>
                  <span className="w-24 text-right text-gray-400 text-[10px]">
                    {fmtInt(t.input_tokens + t.output_tokens)} tok
                  </span>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Brain;
  label: string;
  value: string;
  sub: string;
  color: 'blue' | 'purple' | 'emerald' | 'amber';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">{label}</span>
        <div className={`w-7 h-7 rounded-lg ${colorMap[color]} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-800 dark:text-white">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
