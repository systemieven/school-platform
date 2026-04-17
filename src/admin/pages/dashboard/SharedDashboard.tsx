/**
 * SharedDashboard
 *
 * Dashboard compartilhado entre todos os roles que têm acesso à
 * rota `/admin` (módulo `dashboard`) e que NÃO são `super_admin`.
 * O super_admin continua aterrissando no `DashboardPage` clássico
 * (com KPIs comparativos, charts e funil completo) — quem decide
 * é o `DashboardRouter`.
 *
 * Filosofia:
 *   - 1 página, N blocos auto-contidos.
 *   - Cada bloco se auto-oculta com `canView(moduleKey)`. Não há
 *     configuração de layout por role: a visibilidade é exatamente
 *     o que as permissões granulares já liberam — habilitar o
 *     módulo X libera automaticamente o bloco X aqui.
 *   - Coordenadores e admins veem mais blocos porque tipicamente
 *     têm mais módulos liberados; um professor vê só os relevantes
 *     a ele (turmas, faltas, ocorrências), e um financeiro vê
 *     só o bloco financeiro.
 *   - Super_admin não vem aqui — continua no DashboardPage clássico.
 *
 * Empty-state: se o usuário tem `dashboard.can_view = true` mas
 * nenhum dos blocos cadastrados é visível para ele, mostramos um
 * card educativo apontando para o admin.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Lock } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import {
  AppointmentsBlock,
  KanbanLeadsBlock,
  FinancialOverviewBlock,
  PortariaTodayBlock,
  AbsencesBlock,
  LostFoundBlock,
  StoreOrdersBlock,
  TeacherClassesBlock,
  OccurrencesBlock,
  SHARED_DASHBOARD_MODULE_KEYS,
} from './blocks';

const ROLE_LABELS: Record<string, string> = {
  admin: 'administrador',
  coordinator: 'coordenador(a)',
  teacher: 'professor(a)',
  user: 'colaborador(a)',
};

export default function SharedDashboard() {
  const { profile } = useAdminAuth();
  const { canView, loading } = usePermissions();

  const visibleCount = useMemo(
    () => SHARED_DASHBOARD_MODULE_KEYS.filter((k) => canView(k)).length,
    [canView],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-brand-primary dark:border-brand-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const greeting = profile?.name?.split(' ')[0] ?? 'olá';
  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] ?? null : null;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-2xl bg-brand-primary/10 dark:bg-brand-secondary/10 flex items-center justify-center flex-shrink-0">
          <LayoutDashboard className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Olá, {greeting}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {roleLabel
              ? `Resumo do que você acompanha como ${roleLabel}.`
              : 'Resumo dos seus módulos.'}
          </p>
        </div>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {visibleCount === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700/40 flex items-center justify-center">
            <Lock className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">
            Nenhum bloco para exibir
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            Você ainda não tem acesso a nenhum dos módulos que aparecem
            neste dashboard. Solicite ao administrador do sistema o
            acesso aos módulos que você utiliza.
          </p>
          <Link
            to="/admin/configuracoes"
            className="inline-flex items-center gap-1 mt-4 text-xs font-medium text-brand-primary dark:text-brand-secondary hover:underline"
          >
            Ir para Configurações
          </Link>
        </div>
      ) : (
        /* ── Grid de blocos ──────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AppointmentsBlock />
          <KanbanLeadsBlock />
          <FinancialOverviewBlock />
          <PortariaTodayBlock />
          <AbsencesBlock />
          <OccurrencesBlock />
          <TeacherClassesBlock />
          <LostFoundBlock />
          <StoreOrdersBlock />
        </div>
      )}
    </div>
  );
}
