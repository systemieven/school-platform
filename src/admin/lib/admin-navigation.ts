import type { NavGroup } from '../types/admin.types';
import {
  SETTINGS_SUBTAB_MODULE_KEYS,
  GESTAO_SUBTAB_MODULE_KEYS,
  ACADEMICO_SUBTAB_MODULE_KEYS,
  LOJA_SUBTAB_MODULE_KEYS,
  SECRETARIA_SUBTAB_MODULE_KEYS,
  FINANCIAL_SUBTAB_MODULE_KEYS,
  TEACHER_AREA_SUBTAB_MODULE_KEYS,
  RH_SUBTAB_MODULE_KEYS,
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
    // Os modulos funcionais grandes sao agrupados num unico bloco para
    // facilitar a leitura. Cada item e uma umbrella (page-mae com tabs
    // internas) e fica visivel se o usuario tem view em pelo menos uma
    // sub-aba — semantica de `anyModuleKeys`.
    label: 'Módulos do sistema',
    items: [
      {
        key: 'gestao',
        label: 'Gestão',
        icon: 'Briefcase',
        path: '/admin/gestao',
        roles: ['super_admin', 'admin', 'coordinator'],
        anyModuleKeys: GESTAO_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'financial',
        label: 'Financeiro',
        icon: 'DollarSign',
        path: '/admin/financeiro',
        roles: ['super_admin', 'admin', 'coordinator'],
        anyModuleKeys: FINANCIAL_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'academico',
        label: 'Acadêmico',
        icon: 'BookOpenCheck',
        path: '/admin/academico',
        roles: ['super_admin', 'admin', 'coordinator'],
        anyModuleKeys: ACADEMICO_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'secretaria',
        label: 'Secretaria Digital',
        icon: 'Archive',
        path: '/admin/secretaria',
        roles: ['super_admin', 'admin', 'coordinator'],
        anyModuleKeys: SECRETARIA_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'rh',
        label: 'RH',
        icon: 'Users',
        path: '/admin/rh',
        roles: ['super_admin', 'admin', 'coordinator'],
        anyModuleKeys: RH_SUBTAB_MODULE_KEYS,
      },
      {
        key: 'area-professor',
        label: 'Área do Professor',
        icon: 'GraduationCap',
        path: '/admin/area-professor',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        anyModuleKeys: TEACHER_AREA_SUBTAB_MODULE_KEYS,
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
        key: 'library',
        label: 'Biblioteca Virtual',
        icon: 'Library',
        path: '/admin/biblioteca',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
        moduleKey: 'library',
      },
      // Portaria e Achados/Perdidos foram movidos da antiga sessao
      // "Secretaria" — sao itens institucionais autonomos, nao sub-tabs
      // da Secretaria Digital.
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
