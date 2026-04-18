/**
 * Umbrella module key sets — granular permission unions.
 *
 * As "umbrella" pages are page-level containers that aggregate several
 * sub-tabs, each guarded by its own granular module key. The umbrella menu
 * entry and the umbrella route should be visible iff the user has `view` on
 * **at least one** sub-tab.
 *
 * Keep each list strictly in sync with the `TABS` array of its corresponding
 * page (the `moduleKey` / `requiredModule` field of every tab def).
 *
 * If you add a new sub-tab in one of these pages, append its module key here
 * — otherwise users with permission on the new tab won't see the umbrella in
 * the sidebar.
 */

// /admin/configuracoes — src/admin/pages/settings/SettingsPage.tsx
//
// Desde a migration 148, cada aba de Configurações é gateada por uma chave
// granular `settings-*`. As chaves `users` e `audit` permanecem "cruas" pois
// já eram módulos independentes (não foram desdobrados de `settings`).
export const SETTINGS_SUBTAB_MODULE_KEYS = [
  'settings-institutional',
  'settings-academico',
  'settings-visits',
  'settings-attendance',
  'settings-ferramentas',
  'settings-fiscal',
  'settings-contact',
  'settings-financial',
  'settings-enrollment',
  'settings-notifications',
  'settings-security',
  'settings-site',
  'settings-whatsapp',
  'audit',
  'users',
] as const;

// /admin/gestao — src/admin/pages/gestao/GestaoPage.tsx
export const GESTAO_SUBTAB_MODULE_KEYS = [
  'appointments',
  'attendance',
  'contacts',
  'enrollments',
] as const;

// /admin/academico — src/admin/pages/academico/AcademicoPage.tsx
export const ACADEMICO_SUBTAB_MODULE_KEYS = [
  'academico',                 // mantido para retrocompat (ainda usado em alguns lugares)
  'academic-dashboard',
  'academic-disciplines',
  'academic-schedule',
  'academic-calendar',
  'academic-report-cards',
  'academic-results',
  'academic-alerts',
  'academic-history',
  'academic-bncc',
  'students',
  'segments',
  'absence-communications',
  'exit-authorizations',
] as const;

// /admin/loja — src/admin/pages/loja/LojaPage.tsx
export const LOJA_SUBTAB_MODULE_KEYS = [
  'loja',
  'store-products',
  'store-orders',
  'store-pdv',
  'store-reports',
] as const;

// /admin/secretaria — src/admin/pages/secretaria/SecretariaPage.tsx
export const SECRETARIA_SUBTAB_MODULE_KEYS = [
  'secretaria-dashboard',
  'secretaria-declaracoes',
  'secretaria-saude',
  'secretaria-rematricula',
  'secretaria-transferencias',
] as const;

// /admin/financeiro — src/admin/pages/financial/FinancialPage.tsx
// A própria página filtra tabs internamente por permissão. A umbrella libera
// o acesso à rota se o usuário tem view em **qualquer** sub-aba do Financeiro.
export const FINANCIAL_SUBTAB_MODULE_KEYS = [
  'financial',                     // dashboard (visão geral)
  'financial-plans',
  'financial-contracts',
  'financial-installments',
  'financial-cash',
  'financial-receivables',
  'financial-payables',
  'financial-reports',
  'financial-account-categories',  // descontos, bolsas, templates
  'nfse-emitidas',
  'nfse-apuracao',
  'fornecedores',                  // cobre fornecedores + NF-e de entrada
] as const;

// /admin/area-professor — src/admin/pages/area-professor/AreaProfessorPage.tsx
//
// Umbrella da Área do Professor: agrega Dashboard + Turmas (ambos sob
// `teacher-area`), Planos de Aula e Provas. Os drilldowns profundos
// (`teacher-diary`, `teacher-activities`) são páginas próprias fora da
// umbrella, então suas chaves não entram aqui.
export const TEACHER_AREA_SUBTAB_MODULE_KEYS = [
  'teacher-area',           // Dashboard + Turmas
  'teacher-lesson-plans',   // Planos
  'teacher-exams',          // Provas
] as const;
