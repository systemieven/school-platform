/**
 * Catálogo dos blocos do SharedDashboard.
 *
 * Cada bloco é auto-suficiente: declara seu `moduleKey` internamente,
 * verifica `canView(moduleKey)` no topo e retorna `null` quando o
 * usuário não tem permissão. Adicionar um novo bloco é uma operação
 * isolada — basta criar o arquivo, exportar daqui e adicionar à
 * `DASHBOARD_BLOCKS` em `SharedDashboard.tsx`.
 */
export { AppointmentsBlock } from './AppointmentsBlock';
export { KanbanLeadsBlock } from './KanbanLeadsBlock';
export { FinancialOverviewBlock } from './FinancialOverviewBlock';
export { PortariaTodayBlock } from './PortariaTodayBlock';
export { AbsencesBlock } from './AbsencesBlock';
export { LostFoundBlock } from './LostFoundBlock';
export { StoreOrdersBlock } from './StoreOrdersBlock';
export { TeacherClassesBlock } from './TeacherClassesBlock';
export { OccurrencesBlock } from './OccurrencesBlock';

/**
 * Mapa `moduleKey → existe bloco no SharedDashboard?` usado pelo
 * SharedDashboard para detectar a condição de "dashboard vazio"
 * sem precisar contar children renderizados.
 *
 * Manter em sincronia com a lista de imports acima e com a JSX
 * em `SharedDashboard.tsx`.
 */
export const SHARED_DASHBOARD_MODULE_KEYS = [
  'appointments',
  'kanban',
  'financial',
  'portaria',
  'absence-communications',
  'lost-found',
  'store-orders',
  'teacher-area',
  'occurrences',
] as const;
