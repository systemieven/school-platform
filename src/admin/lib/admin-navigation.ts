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
      },
      {
        key: 'enrollments',
        label: 'Pré-Matrículas',
        icon: 'GraduationCap',
        path: '/admin/matriculas',
        roles: ['super_admin', 'admin', 'coordinator'],
      },
      {
        key: 'contacts',
        label: 'Contatos',
        icon: 'MessageSquare',
        path: '/admin/contatos',
        roles: ['super_admin', 'admin', 'coordinator'],
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
      },
      {
        key: 'reports',
        label: 'Relatórios',
        icon: 'BarChart2',
        path: '/admin/relatorios',
        roles: ['super_admin', 'admin', 'coordinator'],
      },
    ],
  },
  {
    label: 'Escola',
    items: [
      {
        key: 'segments',
        label: 'Segmentos e Turmas',
        icon: 'School',
        path: '/admin/segmentos',
        roles: ['super_admin', 'admin', 'coordinator'],
      },
      {
        key: 'students',
        label: 'Alunos',
        icon: 'UserCheck',
        path: '/admin/alunos',
        roles: ['super_admin', 'admin', 'coordinator'],
      },
      {
        key: 'teacher-area',
        label: 'Área do Professor',
        icon: 'BookOpen',
        path: '/admin/area-professor',
        roles: ['super_admin', 'admin', 'coordinator', 'teacher'],
      },
    ],
  },
  {
    label: 'Sistema',
    items: [
      {
        key: 'users',
        label: 'Usuários',
        icon: 'Users',
        path: '/admin/usuarios',
        roles: ['super_admin', 'admin'],
      },
      {
        key: 'settings',
        label: 'Configurações',
        icon: 'Settings',
        path: '/admin/configuracoes',
        roles: ['super_admin', 'admin'],
      },
    ],
  },
];
