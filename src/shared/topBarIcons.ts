// Registry de icones disponiveis para links do topbar publico.
// Curado para contextos que fazem sentido em uma barra superior
// de site institucional (portais, contato, carreiras, etc).
// Usado tanto pelo picker no admin (NavigationSettingsPanel) quanto pelo
// render publico (TopBar.tsx).

import {
  User, Users, GraduationCap, BookOpen, ShoppingBag, Phone, Mail,
  MessageCircle, MapPin, Calendar, HelpCircle, Newspaper, Briefcase,
  Building2, Award, Heart, Key, LogIn, FileText, Info,
  type LucideIcon,
} from 'lucide-react';

export interface TopBarIconOption {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const TOPBAR_ICONS: TopBarIconOption[] = [
  { key: 'user',          label: 'Aluno',         icon: User },
  { key: 'users',         label: 'Responsaveis',  icon: Users },
  { key: 'graduation-cap',label: 'Professor',     icon: GraduationCap },
  { key: 'book-open',     label: 'Biblioteca',    icon: BookOpen },
  { key: 'shopping-bag',  label: 'Loja',          icon: ShoppingBag },
  { key: 'phone',         label: 'Telefone',      icon: Phone },
  { key: 'mail',          label: 'Email',         icon: Mail },
  { key: 'message-circle',label: 'Atendimento',   icon: MessageCircle },
  { key: 'map-pin',       label: 'Endereco',      icon: MapPin },
  { key: 'calendar',      label: 'Agendar',       icon: Calendar },
  { key: 'help-circle',   label: 'Ajuda',         icon: HelpCircle },
  { key: 'newspaper',     label: 'Noticias',      icon: Newspaper },
  { key: 'briefcase',     label: 'Carreiras',     icon: Briefcase },
  { key: 'building',      label: 'Institucional', icon: Building2 },
  { key: 'award',         label: 'Premios',       icon: Award },
  { key: 'heart',         label: 'Saude',         icon: Heart },
  { key: 'key',           label: 'Acesso',        icon: Key },
  { key: 'log-in',        label: 'Login',         icon: LogIn },
  { key: 'file-text',     label: 'Documentos',    icon: FileText },
  { key: 'info',          label: 'Informacoes',   icon: Info },
];

const INDEX: Record<string, LucideIcon> = Object.fromEntries(
  TOPBAR_ICONS.map((o) => [o.key, o.icon]),
);

export function getTopBarIcon(key: string | null | undefined): LucideIcon | null {
  if (!key) return null;
  return INDEX[key] ?? null;
}
