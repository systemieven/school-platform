// ── Role hierarchy ──
export const ROLES = ['super_admin', 'admin', 'coordinator', 'teacher', 'student', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  coordinator: 'Coordenador(a)',
  teacher: 'Professor(a)',
  student: 'Aluno(a)',
  user: 'Usuário',
};

/** Roles that can access /admin */
export const ADMIN_ROLES: Role[] = ['super_admin', 'admin', 'coordinator'];

// ── Profile (mirrors profiles table) ──
export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── System Settings ──
export interface SystemSetting {
  id: string;
  key: string;
  value: unknown; // jsonb — can be string, object, array, etc.
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Navigation ──
export interface NavItem {
  key: string;
  label: string;
  icon: string;          // Lucide icon name
  path: string;
  roles: Role[];         // roles that can see this item
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
