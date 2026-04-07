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
    label: 'WhatsApp',
    items: [
      {
        key: 'wa-templates',
        label: 'Templates',
        icon: 'LayoutTemplate',
        path: '/admin/whatsapp/templates',
        roles: ['super_admin', 'admin', 'coordinator'],
      },
      {
        key: 'wa-messages',
        label: 'Histórico',
        icon: 'Send',
        path: '/admin/whatsapp/mensagens',
        roles: ['super_admin', 'admin', 'coordinator'],
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
