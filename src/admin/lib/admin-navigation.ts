import type { NavGroup } from '../types/admin.types';
import {
  SETTINGS_SUBTAB_MODULE_KEYS,
  GESTAO_SUBTAB_MODULE_KEYS,
  ACADEMICO_SUBTAB_MODULE_KEYS,
  LOJA_SUBTAB_MODULE_KEYS,
  SECRETARIA_SUBTAB_MODULE_KEYS,
  FINANCIAL_SUBTAB_MODULE_KEYS,
} from './umbrella-modules';

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        path: '/admin',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'dashboard',
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        key: 'gestao',
        label: 'Gestão',
        icon: 'Briefcase',
        path: '/admin/gestao',
        roles: ['super_admin', 'admin', 'coordinator'],
        // Umbrella: visible iff user can view at least one Gestão sub-tab.
        anyModuleKeys: GESTAO_SUBTAB_MODULE_KEYS,
      },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      {
        key: 'financial',
        label: 'Financeiro',
        icon: 'DollarSign',
        path: '/admin/financeiro',
        roles: ['super_admin', 'admin', 'coordinator'],
        // Umbrella: visible iff the user has view on at least one Financeiro
        // sub-tab. Permite que um usuário com override granular (ex.: só
        // `fornecedores:view` para importar NF-e) veja o menu e só a aba
        // correspondente, sem precisar de permissão global 'financial'.
        anyModuleKeys: FINANCIAL_SUBTAB_MODULE_KEYS,
      },
    ],
  },
  {
    label: 'Acadêmico',
    items: [
      {
        key: 'academico',
        label: 'Acadêmico',
        icon: 'BookOpenCheck',
        path: '/admin/academico',
        roles: ['super_admin', 'admin', 'coordinator'],
        // Umbrella: visible iff user can view at least one Acadêmico sub-tab.
        anyModuleKeys: ACADEMICO_SUBTAB_MODULE_KEYS,
      },
    ],
  },
  {
    label: 'Secretaria',
    items: [
      {
        key: 'secretaria',
        label: 'Secretaria Digital',
        icon: 'Archive',
        path: '/admin/secretaria',
        roles: ['super_admin', 'admin', 'coordinator'],
        // Umbrella: visible iff user can view at least one Secretaria sub-tab.
        anyModuleKeys: SECRETARIA_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'portaria',
        label: 'Portaria',
        icon: 'ScanFace',
        path: '/admin/portaria',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'portaria',
      },
      {
        key: 'achados-perdidos',
        label: 'Achados e Perdidos',
        icon: 'PackageSearch',
        path: '/admin/achados-perdidos',
        roles: ['super_admin', 'admin', 'coordinator', 'user'],
        moduleKey: 'lost-found',
      },
    ],
  },
  {
    label: 'Instituição',
    items: [
      {
        key: 'announcements',
        label: 'Comunicados',
        icon: 'Megaphone',
        path: '/admin/comunicados',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        moduleKey: 'announcements',
      },
      {
        key: 'events',
        label: 'Eventos',
        icon: 'CalendarDays',
        path: '/admin/eventos',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        moduleKey: 'events',
      },
      {
        key: 'teacher-area',
        label: 'Área do Professor',
        icon: 'BookOpen',
        path: '/admin/area-professor',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        moduleKey: 'teacher-area',
      },
      {
        key: 'library',
        label: 'Biblioteca Virtual',
        icon: 'Library',
        path: '/admin/biblioteca',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        moduleKey: 'library',
      },
    ],
  },
  {
    label: 'Ferramentas',
    items: [
      {
        key: 'kanban',
        label: 'Kanban de Leads',
        icon: 'Kanban',
        path: '/admin/leads/kanban',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'kanban',
      },
      {
        key: 'reports',
        label: 'Relatórios',
        icon: 'BarChart2',
        path: '/admin/relatorios',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'reports',
      },
      {
        key: 'testimonials',
        label: 'Depoimentos do Site',
        icon: 'MessageSquare',
        path: '/admin/depoimentos',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'testimonials',
      },
    ],
  },
  {
    label: 'Loja',
    items: [
      {
        key: 'loja',
        label: 'Visão Geral',
        icon: 'ShoppingBag',
        path: '/admin/loja',
        roles: ['super_admin', 'admin', 'coordinator', 'user'],
        // Umbrella: visible iff user can view at least one Loja sub-tab.
        anyModuleKeys: LOJA_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'loja-pdv',
        label: 'PDV',
        icon: 'Monitor',
        path: '/admin/loja/pdv',
        roles: ['super_admin', 'admin', 'coordinator', 'user'],
        moduleKey: 'store-pdv',
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        key: 'settings',
        label: 'Configurações',
        icon: 'Settings',
        path: '/admin/configuracoes',
        roles: ['super_admin', 'admin'],
        // Umbrella: visible iff user can view at least one Configurações sub-tab.
        anyModuleKeys: SETTINGS_SUBTAB_MODULE_KEYS,
      },
      {
        // OP-1 — Central de Migração (Sprint 10). super_admin only:
        // modulo `data-migration` nao tem linha em role_permissions para
        // admin/coordinator, entao apenas super_admin (bypass em can()) ve.
        key: 'data-migration',
        label: 'Central de Migração',
        icon: 'DatabaseBackup',
        path: '/admin/migracao',
        roles: ['super_admin'],
        moduleKey: 'data-migration',
      },
    ],
  },
];
