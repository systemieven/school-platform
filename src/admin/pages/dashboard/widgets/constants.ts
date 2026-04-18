/**
 * Constantes visuais compartilhadas pelos widgets do dashboard.
 * Centralizadas aqui para que registry.ts e os widgets não dupliquem
 * tabelas de labels/cores (como acontecia antes no split
 * DashboardPage/SharedDashboard).
 */

export const REASON_LABELS: Record<string, string> = {
  conhecer_escola: 'Conhecer a escola',
  matricula: 'Pré-Matrícula',
  entrega_documentos: 'Entrega de docs.',
  conversa_pedagogica: 'Conv. pedagógica',
  outros: 'Outros',
};

export const ENROLLMENT_PIPELINE = [
  { key: 'new', label: 'Novo', color: 'bg-blue-500' },
  { key: 'under_review', label: 'Em análise', color: 'bg-purple-500' },
  { key: 'docs_pending', label: 'Docs. pendentes', color: 'bg-amber-500' },
  { key: 'docs_received', label: 'Docs. recebidos', color: 'bg-cyan-500' },
  { key: 'interview_scheduled', label: 'Entrevista', color: 'bg-indigo-500' },
  { key: 'approved', label: 'Aprovado', color: 'bg-emerald-500' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-green-600' },
  { key: 'archived', label: 'Arquivado', color: 'bg-gray-400' },
];

export const APPT_STATUS = [
  { key: 'pending', label: 'Pendente', color: 'bg-amber-400' },
  { key: 'confirmed', label: 'Confirmado', color: 'bg-emerald-500' },
  { key: 'completed', label: 'Realizado', color: 'bg-blue-500' },
  { key: 'cancelled', label: 'Cancelado', color: 'bg-red-400' },
  { key: 'no_show', label: 'Não veio', color: 'bg-gray-400' },
];

export const LEAD_FUNNEL = [
  { key: 'new',           label: 'Novos',         color: 'bg-blue-500' },
  { key: 'first_contact', label: '1º contato',    color: 'bg-indigo-500' },
  { key: 'follow_up',     label: 'Follow-up',     color: 'bg-purple-500' },
  { key: 'contacted',     label: 'Contatado',     color: 'bg-cyan-500' },
  { key: 'converted',     label: 'Convertido',    color: 'bg-emerald-500' },
  { key: 'resolved',      label: 'Resolvido',     color: 'bg-green-600' },
  { key: 'closed',        label: 'Encerrado',     color: 'bg-gray-400' },
  { key: 'archived',      label: 'Arquivado',     color: 'bg-gray-300' },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'super administrador(a)',
  admin: 'administrador(a)',
  coordinator: 'coordenador(a)',
  teacher: 'professor(a)',
  user: 'colaborador(a)',
};

export function formatBRL(v: number | null | undefined): string {
  const n = typeof v === 'number' ? v : 0;
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}
