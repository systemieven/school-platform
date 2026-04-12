import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import type { SchoolClass } from '../../../types/admin.types';
import { Users, FileText, ClipboardList, CalendarCheck, Loader2 } from 'lucide-react';

interface Stats {
  students: number;
  materials: number;
  activities: number;
  presentRate: number | null;
}

export default function OverviewTab({ cls }: { cls: SchoolClass }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split('T')[0];

      const [studentsRes, materialsRes, activitiesRes, attRes] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', cls.id).eq('status', 'active'),
        supabase.from('class_materials').select('id', { count: 'exact', head: true }).eq('class_id', cls.id),
        supabase.from('activities').select('id', { count: 'exact', head: true }).eq('class_id', cls.id),
        supabase.from('attendance').select('status').eq('class_id', cls.id).gte('date', monthStr),
      ]);

      let presentRate: number | null = null;
      if (attRes.data && attRes.data.length > 0) {
        const present = attRes.data.filter((r) => r.status === 'present' || r.status === 'late').length;
        presentRate = Math.round((present / attRes.data.length) * 100);
      }

      setStats({
        students:    studentsRes.count ?? 0,
        materials:   materialsRes.count ?? 0,
        activities:  activitiesRes.count ?? 0,
        presentRate,
      });
      setLoading(false);
    }
    load();
  }, [cls.id]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  const cards = [
    { label: 'Alunos ativos',     value: stats!.students,                          icon: Users,          color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { label: 'Materiais',         value: stats!.materials,                         icon: FileText,       color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
    { label: 'Atividades',        value: stats!.activities,                        icon: ClipboardList,  color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
    { label: 'Presença (mês)',    value: stats!.presentRate != null ? `${stats!.presentRate}%` : '—', icon: CalendarCheck, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 flex items-start gap-4 shadow-sm">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
