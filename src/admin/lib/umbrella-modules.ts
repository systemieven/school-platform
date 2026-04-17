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
export const SETTINGS_SUBTAB_MODULE_KEYS = [
  'settings',          // institucional, notificações, segurança, site, whatsapp
  'academico',         // configurações acadêmicas
  'appointments',      // configurações de agendamentos
  'attendance',        // configurações de atendimento
  'lost-found',        // configurações de achados e perdidos
  'nfse-config',       // configurações fiscais
  'audit',             // log de auditoria
  'contacts',          // configurações de contatos
  'payment-gateways',  // gateways de pagamento
  'enrollments',       // configurações de matrículas
  'users',             // usuários e perfis
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
  'academico',
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
  'secretaria-declaracoes',
  'secretaria-saude',
  'secretaria-rematricula',
  'secretaria-transferencias',
] as const;
