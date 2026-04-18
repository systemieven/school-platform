/**
 * admin-search-index — catálogo de conteúdos navegáveis de /admin para a
 * busca do breadcrumb (Ctrl/Cmd+K).
 *
 * Objetivo: permitir ao usuário digitar qualquer termo (ex: "site", "boleto",
 * "saúde") e saltar direto pra página + aba correspondente, **respeitando as
 * permissões granulares** do usuário logado.
 *
 * Fontes-de-verdade:
 *
 * 1. [ADMIN_NAV](admin-navigation.ts) — menu lateral. Traz URL, moduleKey ou
 *    anyModuleKeys para cada página de topo. Reutilizado aqui para que uma
 *    página nova inserida na sidebar já apareça na busca sem edição extra.
 *
 * 2. Catálogos de sub-tabs abaixo (`SETTINGS_TABS`, `GESTAO_TABS`, etc).
 *    Espelham os arrays `TABS` das páginas-umbrella (SettingsPage, GestaoPage,
 *    FinancialPage, AcademicoPage, LojaPage, SecretariaPage). **Mantenha cada
 *    bloco em sincronia com o `TABS` da página correspondente** — o comentário
 *    acima de cada constante aponta o arquivo.
 *
 * Auto-atualização: qualquer página nova adicionada ao ADMIN_NAV entra na
 * busca na hora. Páginas-umbrella que ganharem uma nova aba precisam de uma
 * linha aqui (mesmo contrato do `umbrella-modules.ts`).
 */
import { ADMIN_NAV } from './admin-navigation';
import type { NavItem, Role } from '../types/admin.types';

// ── Tipos públicos ───────────────────────────────────────────────────────────

export interface SearchEntry {
  /** Chave única (ex: `settings:site`). */
  id: string;
  /** Nome principal exibido no resultado. */
  title: string;
  /** Caminho completo: `['Admin', 'Configurações', 'Site']`. */
  breadcrumb: string[];
  /** URL destino (com `?tab=` quando for sub-aba). */
  path: string;
  /** Texto adicional que participa da busca (descrição + aliases). */
  keywords: string;
  /** Linha curta exibida como subtítulo no resultado. */
  hint?: string;
  /** Nome do grupo do menu (pra agrupar/sortear resultados). */
  group: string;
}

// ── Catálogo de sub-tabs ─────────────────────────────────────────────────────
// Mantenha em sincronia com o `TABS` da página indicada no comentário.

interface TabMeta {
  key: string;
  label: string;
  /** Chave granular que libera `view` nesta aba. */
  moduleKey: string;
  /** Descrição curta / aliases para enriquecer a busca. */
  hint?: string;
}

/** src/admin/pages/settings/SettingsPage.tsx → TABS */
const SETTINGS_TABS: TabMeta[] = [
  { key: 'institutional', label: 'Dados Institucionais', moduleKey: 'settings-institutional', hint: 'Nome, CNPJ, endereço, contato — dados da escola' },
  { key: 'academico',     label: 'Acadêmico',            moduleKey: 'settings-academico',     hint: 'Períodos letivos, fórmulas de média, alertas de frequência' },
  { key: 'visits',        label: 'Agendamentos',         moduleKey: 'settings-visits',        hint: 'Motivos, horários e regras de agendamento de visitas' },
  { key: 'attendance',    label: 'Atendimentos',         moduleKey: 'settings-attendance',    hint: 'Elegibilidade, senha, tela do cliente, feedback' },
  { key: 'ferramentas',   label: 'Ferramentas',          moduleKey: 'settings-ferramentas',   hint: 'Módulos auxiliares (ex: Achados e Perdidos)' },
  { key: 'fiscal',        label: 'Fiscal',               moduleKey: 'settings-fiscal',        hint: 'Emitente NF-e, configurações fiscais' },
  { key: 'audit',         label: 'Auditoria',            moduleKey: 'audit',                  hint: 'Logs de ações realizadas no sistema' },
  { key: 'contact',       label: 'Formulário de Contato', moduleKey: 'settings-contact',      hint: 'Motivos, campos obrigatórios, qualificação de leads' },
  { key: 'financial',     label: 'Financeiro',           moduleKey: 'settings-financial',     hint: 'Gateways, régua de cobrança, PIX' },
  { key: 'ia',            label: 'IA (Agentes)',         moduleKey: 'settings-ia',            hint: 'Agentes, prompts, providers, uso' },
  { key: 'enrollment',    label: 'Pré-Matrícula',        moduleKey: 'settings-enrollment',    hint: 'Campos obrigatórios, documentos, regras do formulário' },
  { key: 'notifications', label: 'Notificações',         moduleKey: 'settings-notifications', hint: 'Alertas automáticos e templates de comunicação' },
  { key: 'permissions',   label: 'Permissões',           moduleKey: 'users',                  hint: 'Permissões por cargo e por usuário' },
  { key: 'security',      label: 'Segurança',            moduleKey: 'settings-security',      hint: 'Políticas de senha, lifetime, reutilização' },
  { key: 'site',          label: 'Site',                 moduleKey: 'settings-site',          hint: 'Aparência, marca, navegação, conteúdo, SEO, logo, favicon, cores' },
  { key: 'users',         label: 'Usuários',             moduleKey: 'users',                  hint: 'Cadastro de usuários do sistema, cargos, acessos' },
  { key: 'whatsapp',      label: 'WhatsApp',             moduleKey: 'settings-whatsapp',      hint: 'Conexão UAZapi, envio de mensagens' },
];

/** src/admin/pages/gestao/GestaoPage.tsx → TABS */
const GESTAO_TABS: TabMeta[] = [
  { key: 'agendamentos', label: 'Agendamentos de Visitas', moduleKey: 'appointments', hint: 'Visitas agendadas pelo site' },
  { key: 'atendimentos', label: 'Atendimentos',            moduleKey: 'attendance',   hint: 'Fila de atendimento e histórico' },
  { key: 'contatos',     label: 'Contatos',                moduleKey: 'contacts',     hint: 'Leads recebidos pelo formulário' },
  { key: 'matriculas',   label: 'Pré-Matrículas',          moduleKey: 'enrollments',  hint: 'Solicitações de matrícula online' },
];

/** src/admin/pages/financial/FinancialPage.tsx → TABS */
const FINANCIAL_TABS: TabMeta[] = [
  { key: 'dashboard',    label: 'Visão Geral',    moduleKey: 'financial',                hint: 'KPIs e indicadores financeiros' },
  { key: 'plans',        label: 'Planos',         moduleKey: 'financial-plans',          hint: 'Planos de mensalidade' },
  { key: 'contracts',    label: 'Contratos',      moduleKey: 'financial-contracts',      hint: 'Contratos ativos e encerrados' },
  { key: 'installments', label: 'Cobranças',      moduleKey: 'financial-installments',   hint: 'Parcelas, boletos e régua' },
  { key: 'cash',         label: 'Caixas',         moduleKey: 'financial-cash',           hint: 'Caixas físicos e abertura/fechamento' },
  { key: 'receivables',  label: 'A Receber',      moduleKey: 'financial-receivables',    hint: 'Contas a receber avulsas' },
  { key: 'payables',     label: 'A Pagar',        moduleKey: 'financial-payables',       hint: 'Contas a pagar, fornecedores' },
  { key: 'fornecedores', label: 'Fornecedores',   moduleKey: 'fornecedores',             hint: 'Cadastro de fornecedores e NF-e' },
  { key: 'reports',      label: 'Relatórios',     moduleKey: 'financial-reports',        hint: 'Relatórios financeiros' },
  { key: 'discounts',    label: 'Descontos',      moduleKey: 'financial-discounts',      hint: 'Descontos disponíveis' },
  { key: 'scholarships', label: 'Bolsas',         moduleKey: 'financial-scholarships',   hint: 'Bolsas de estudo' },
  { key: 'templates',    label: 'Templates',      moduleKey: 'financial-templates',      hint: 'Templates de contrato, recibo, boleto' },
  { key: 'nfse',         label: 'NFS-e',          moduleKey: 'nfse',                     hint: 'Notas fiscais de serviço' },
];

/** src/admin/pages/academico/AcademicoPage.tsx → TABS */
const ACADEMICO_TABS: TabMeta[] = [
  { key: 'dashboard',       label: 'Dashboard',           moduleKey: 'academic-dashboard',    hint: 'KPIs acadêmicos' },
  { key: 'alunos',          label: 'Alunos',              moduleKey: 'students',              hint: 'Cadastro de alunos' },
  { key: 'segmentos',       label: 'Segmentos',           moduleKey: 'segments',              hint: 'Segmentos de ensino' },
  { key: 'disciplinas',     label: 'Disciplinas',         moduleKey: 'academic-disciplines',  hint: 'Disciplinas e professores' },
  { key: 'grade-horaria',   label: 'Grade Horária',       moduleKey: 'academic-schedule',     hint: 'Grade de aulas' },
  { key: 'calendario',      label: 'Calendário',          moduleKey: 'academic-calendar',     hint: 'Calendário letivo' },
  { key: 'boletim',         label: 'Boletim',             moduleKey: 'academic-report-cards', hint: 'Boletins escolares' },
  { key: 'resultado-final', label: 'Resultado Final',     moduleKey: 'academic-results',      hint: 'Resultado final do ano' },
  { key: 'alertas',         label: 'Alertas de Frequência', moduleKey: 'academic-alerts',     hint: 'Faltas e alertas' },
  { key: 'historico',       label: 'Histórico Escolar',   moduleKey: 'academic-history',      hint: 'Histórico do aluno' },
  { key: 'bncc',            label: 'BNCC',                moduleKey: 'academic-bncc',         hint: 'Currículo BNCC' },
];

/** src/admin/pages/loja/LojaPage.tsx → TABS */
const LOJA_TABS: TabMeta[] = [
  { key: 'dashboard',  label: 'Visão Geral', moduleKey: 'loja',            hint: 'KPIs da loja' },
  { key: 'produtos',   label: 'Produtos',    moduleKey: 'store-products',  hint: 'Catálogo de produtos' },
  { key: 'categorias', label: 'Categorias',  moduleKey: 'store-products',  hint: 'Árvore hierárquica de categorias' },
  { key: 'pedidos',    label: 'Pedidos',     moduleKey: 'store-orders',    hint: 'Pedidos e histórico' },
  { key: 'pdv',        label: 'PDV',         moduleKey: 'store-pdv',       hint: 'Ponto de venda' },
  { key: 'relatorios', label: 'Relatórios',  moduleKey: 'store-reports',   hint: 'Relatórios de venda' },
];

/** src/admin/pages/secretaria/SecretariaPage.tsx → TABS */
const SECRETARIA_TABS: TabMeta[] = [
  { key: 'declaracoes',    label: 'Declarações',     moduleKey: 'secretaria-declaracoes',    hint: 'Declarações e templates de documentos' },
  { key: 'fichas-saude',   label: 'Fichas de Saúde', moduleKey: 'secretaria-saude',          hint: 'Alergias, medicamentos, contatos de emergência' },
  { key: 'rematricula',    label: 'Rematrícula',     moduleKey: 'secretaria-rematricula',    hint: 'Campanhas de rematrícula' },
  { key: 'transferencias', label: 'Transferências',  moduleKey: 'secretaria-transferencias', hint: 'Entrada e saída de alunos' },
];

/** Mapa path → lista de sub-tabs. */
const UMBRELLA_TAB_INDEX: Record<string, TabMeta[]> = {
  '/admin/configuracoes': SETTINGS_TABS,
  '/admin/gestao':        GESTAO_TABS,
  '/admin/financeiro':    FINANCIAL_TABS,
  '/admin/academico':     ACADEMICO_TABS,
  '/admin/loja':          LOJA_TABS,
  '/admin/secretaria':    SECRETARIA_TABS,
};

// ── Builder ──────────────────────────────────────────────────────────────────

function canSeeNavItem(
  item: NavItem,
  role: Role | undefined,
  canView: (m: string) => boolean,
): boolean {
  if (!role) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  if (role === 'super_admin') return true;
  if (item.moduleKey) return canView(item.moduleKey);
  if (item.anyModuleKeys && item.anyModuleKeys.length > 0) {
    return item.anyModuleKeys.some((k) => canView(k));
  }
  return true;
}

/**
 * Constrói o índice filtrado pelas permissões do usuário atual.
 *
 * @param role     Papel do usuário (profile.role) — determina visibilidade em
 *                 itens do ADMIN_NAV com `roles` restrito.
 * @param canView  Função `(moduleKey) => boolean` do PermissionsContext.
 */
export function buildSearchIndex(
  role: Role | undefined,
  canView: (moduleKey: string) => boolean,
): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const isSuperAdmin = role === 'super_admin';

  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (!canSeeNavItem(item, role, canView)) continue;

      // Entrada da página de topo (clique leva pra URL raiz da página)
      entries.push({
        id: `nav:${item.key}`,
        title: item.label,
        breadcrumb: ['Admin', group.label, item.label],
        path: item.path,
        keywords: [item.label, group.label, item.path].join(' ').toLowerCase(),
        group: group.label,
      });

      // Expansão de sub-tabs, se for página-umbrella
      const tabs = UMBRELLA_TAB_INDEX[item.path];
      if (!tabs) continue;

      for (const tab of tabs) {
        if (!isSuperAdmin && !canView(tab.moduleKey)) continue;
        entries.push({
          id: `nav:${item.key}:${tab.key}`,
          title: tab.label,
          breadcrumb: ['Admin', item.label, tab.label],
          path: `${item.path}?tab=${tab.key}`,
          keywords: [tab.label, tab.hint ?? '', item.label, tab.key].join(' ').toLowerCase(),
          hint: tab.hint,
          group: item.label,
        });
      }
    }
  }

  return entries;
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Filtra + ranqueia entradas para um termo livre.
 * - Match no título ganha prioridade máxima; match em keywords vem depois.
 * - Sem termo: retorna primeiros N itens.
 */
export function rankSearch(
  entries: SearchEntry[],
  query: string,
  limit = 12,
): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored: { e: SearchEntry; score: number }[] = [];

  for (const e of entries) {
    const title = e.title.toLowerCase();
    let score = 0;
    let matchedAll = true;

    for (const t of tokens) {
      if (title.startsWith(t))            score += 40;
      else if (title.includes(t))          score += 20;
      else if (e.keywords.includes(t))     score += 8;
      else { matchedAll = false; break; }
    }

    if (matchedAll && score > 0) scored.push({ e, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}
