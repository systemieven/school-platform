import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { supabase } from '../../../lib/supabase';
import {
  CalendarCheck,
  GraduationCap,
  MessageSquare,
  TrendingUp,
  Clock,
  Loader2,
} from 'lucide-react';

interface Stats {
  visits: number;
  enrollments: number;
  contacts: number;
  pendingVisits: number;
}

export default function DashboardPage() {
  const { profile } = useAdminAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [visits, enrollments, contacts, pending] = await Promise.all([
        supabase.from('visit_appointments').select('id', { count: 'exact', head: true }),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('contact_requests').select('id', { count: 'exact', head: true }),
        supabase
          .from('visit_appointments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      setStats({
        visits: visits.count ?? 0,
        enrollments: enrollments.count ?? 0,
        contacts: contacts.count ?? 0,
        pendingVisits: pending.count ?? 0,
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const CARDS = stats
    ? [
        {
          label: 'Agendamentos',
          value: stats.visits,
          icon: CalendarCheck,
          color: 'bg-blue-50 text-blue-600',
          iconBg: 'bg-blue-100',
        },
        {
          label: 'Pré-Matrículas',
          value: stats.enrollments,
          icon: GraduationCap,
          color: 'bg-emerald-50 text-emerald-600',
          iconBg: 'bg-emerald-100',
        },
        {
          label: 'Contatos',
          value: stats.contacts,
          icon: MessageSquare,
          color: 'bg-purple-50 text-purple-600',
          iconBg: 'bg-purple-100',
        },
        {
          label: 'Visitas Pendentes',
          value: stats.pendingVisits,
          icon: Clock,
          color: 'bg-amber-50 text-amber-600',
          iconBg: 'bg-amber-100',
        },
      ]
    : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-[#003876]">
          {greeting}, {profile?.full_name?.split(' ')[0] || 'Administrador'}
        </h1>
        <p className="text-gray-500 mt-1">Aqui está o resumo do seu painel.</p>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {CARDS.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <card.icon className={`w-5 h-5 ${card.color.split(' ')[1]}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-3xl font-bold text-gray-800">{card.value}</p>
              <p className="text-sm text-gray-500 mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder sections */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display text-lg font-bold text-[#003876] mb-4">Atividade Recente</h2>
          <div className="text-center py-12 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">O feed de atividades será implementado em breve.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-display text-lg font-bold text-[#003876] mb-4">Próximas Visitas</h2>
          <div className="text-center py-12 text-gray-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">A lista de próximas visitas será implementada em breve.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
