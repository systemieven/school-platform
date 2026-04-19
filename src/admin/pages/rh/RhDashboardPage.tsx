import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Briefcase, UserPlus, CalendarCheck, Loader2, ArrowRight,
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

      {/* Atalhos para abas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/admin/rh?tab=colaboradores"
          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:border-brand-primary hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                <Briefcase className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white text-sm">Colaboradores</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cadastro, documentos e contratos</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary transition-colors" />
          </div>
        </Link>

        <Link
          to="/admin/rh?tab=seletivo"
          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:border-brand-primary hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                <UserPlus className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white text-sm">Processo seletivo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vagas, candidatos e pipeline</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-brand-primary transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
