/**
 * SecretariaDashboardPage
 *
 * Visão geral operacional da secretaria digital. Segue o mesmo padrão do
 * FinancialDashboardPage/AcademicoDashboardPage (5 KPI cards + grid de
 * gráficos customizáveis via DashboardChartGrid).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  FileText, Heart, RefreshCw, ArrowRightLeft, CheckCircle2, Loader2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import KpiCard from '../../components/KpiCard';
import DashboardChartGrid from '../../components/DashboardChartGrid';

interface Stats {
  declaracoesPendentes: number;
  fichasSaudePendentes: number;
  rematriculaEmAndamento: number;
  transferenciasMes: number;
  declaracoesEmitidasMes: number;
}

export default function SecretariaDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [pendentesRes, fichasRes, rematRes, transfRes, emitidasRes] = await Promise.all([
      supabase
        .from('document_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('health_record_update_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('reenrollment_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed', 'signed', 'contract_generated']),
      supabase
        .from('student_transfers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('document_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['generated', 'delivered'])
        .gte('updated_at', monthStart),
    ]);

    setStats({
      declaracoesPendentes:   pendentesRes.count ?? 0,
      fichasSaudePendentes:   fichasRes.count ?? 0,
      rematriculaEmAndamento: rematRes.count ?? 0,
      transferenciasMes:      transfRes.count ?? 0,
      declaracoesEmitidasMes: emitidasRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Declarações pendentes"
          value={String(stats.declaracoesPendentes)}
          sub="aguardando emissão"
          icon={FileText}
          color="amber"
        />
        <KpiCard
          label="Fichas de saúde"
          value={String(stats.fichasSaudePendentes)}
          sub="atualizações pendentes"
          icon={Heart}
          color="red"
        />
        <KpiCard
          label="Rematrícula"
          value={String(stats.rematriculaEmAndamento)}
          sub="em andamento"
          icon={RefreshCw}
          color="blue"
        />
        <KpiCard
          label="Transferências (30d)"
          value={String(stats.transferenciasMes)}
          sub="movimentações"
          icon={ArrowRightLeft}
          color="purple"
        />
        <KpiCard
          label="Declarações emitidas"
          value={String(stats.declaracoesEmitidasMes)}
          sub="no mês"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      <DashboardChartGrid module="secretaria" />
    </div>
  );
}
