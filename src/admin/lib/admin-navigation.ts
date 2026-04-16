import type { NavGroup } from '../types/admin.types';

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
        key: 'appointments',
        label: 'Agendamentos',
        icon: 'CalendarCheck',
        path: '/admin/agendamentos',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'appointments',
      },
      {
        key: 'attendance',
        label: 'Atendimentos',
        icon: 'Ticket',
        path: '/admin/atendimentos',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'attendance',
      },
      {
        key: 'contacts',
        label: 'Contatos',
        icon: 'MessageSquare',
        path: '/admin/contatos',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'contacts',
      },
      {
        key: 'enrollments',
        label: 'Matrícula',
        icon: 'GraduationCap',
        path: '/admin/matriculas',
        roles: ['super_admin', 'admin', 'coordinator'],
        moduleKey: 'enrollments',
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
        moduleKey: 'financial',
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
        moduleKey: 'academico',
      },
    ],
  },
  {
    label: 'Qualificação',
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
        moduleKey: 'secretaria-declaracoes',
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
    ],
  },
  {
    label: 'Ferramentas',
    items: [
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
    label: 'Sistema',
    items: [
      {
        key: 'settings',
        label: 'Configurações',
        icon: 'Settings',
        path: '/admin/configuracoes',
        roles: ['super_admin', 'admin'],
        moduleKey: 'settings',
      },
    ],
  },
];
