import { useCallback, useEffect, useState } from 'react';
import {
  Users, Briefcase, UserPlus, CalendarCheck, Loader2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import KpiCard from '../../components/KpiCard';

/**
 * RhDashboardPage — visao geral do modulo RH.
 *
 * KPIs:
 *  - Colaboradores ativos (`staff.is_active`).
 *  - Vagas publicadas (`job_openings.status='published'`).
 *  - Candidatos em pipeline (`job_applications` cuja `stage` nao e final —
 *    consideramos `hired` e `rejected` como saidas).
 *  - Contratacoes no ano corrente (`staff.hire_date >= 1o jan`).
 *
 * As consultas sao independentes; falhas individuais nao quebram o card.
 */
interface Stats {
  staffAtivos: number;
  vagasAbertas: number;
  pipelineCount: number;
  contratacoesAno: number;
}

const FINAL_STAGES = ['hired', 'rejected', 'withdrawn', 'archived'];

export default function RhDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

    const [staffActiveRes, openingsRes, applicationsRes, hiresThisYearRes] = await Promise.all([
      supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('job_openings').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('job_applications').select('stage'),
      supabase.from('staff').select('id', { count: 'exact', head: true }).gte('hire_date', startOfYear),
    ]);

    const pipelineCount = (applicationsRes.data ?? []).filter(
      (r: { stage: string | null }) => r.stage && !FINAL_STAGES.includes(r.stage),
    ).length;

    setStats({
      staffAtivos: staffActiveRes.count ?? 0,
      vagasAbertas: openingsRes.count ?? 0,
      pipelineCount,
      contratacoesAno: hiresThisYearRes.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Colaboradores ativos"
          value={String(stats.staffAtivos)}
          icon={Users}
          color="emerald"
        />
        <KpiCard
          label="Vagas publicadas"
          value={String(stats.vagasAbertas)}
          icon={Briefcase}
          color="blue"
        />
        <KpiCard
          label="Candidatos no pipeline"
          value={String(stats.pipelineCount)}
          icon={UserPlus}
          color="purple"
        />
        <KpiCard
          label="Contratações no ano"
          value={String(stats.contratacoesAno)}
          sub={`Desde 01/01/${new Date().getFullYear()}`}
          icon={CalendarCheck}
          color="amber"
        />
      </div>
    </div>
  );
}
