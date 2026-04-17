/**
 * DashboardRouter
 *
 * Decide qual dashboard renderizar na rota `/admin` (index):
 *   - super_admin → DashboardPage clássico (KPIs comparativos,
 *     funil de matrículas, pipeline de leads, métricas WhatsApp).
 *   - todos os outros → SharedDashboard (blocos auto-filtrantes
 *     pelas permissões granulares — ver `blocks/index.ts`).
 *
 * Por que existir: o DashboardPage atual foi desenhado pensando em
 * quem enxerga "tudo" (admin executivo). Quando um professor caía
 * lá, via o número de matrículas/contatos sem contexto e nada do
 * que ele de fato acompanha. O SharedDashboard inverte essa
 * lógica — só mostra blocos dos módulos que aquele usuário tem
 * permissão para abrir.
 *
 * O ponto de entrada continua sendo `/admin` com `ModuleGuard
 * moduleKey="dashboard"` no routes.tsx — quem não tem essa
 * permissão é redirecionado pelo guard antes de chegar aqui.
 */
import { useAdminAuth } from '../../hooks/useAdminAuth';
import DashboardPage from './DashboardPage';
import SharedDashboard from './SharedDashboard';

export default function DashboardRouter() {
  const { profile } = useAdminAuth();
  if (profile?.role === 'super_admin') return <DashboardPage />;
  return <SharedDashboard />;
}
