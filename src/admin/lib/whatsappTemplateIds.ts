/**
 * WhatsApp Template ID resolver.
 *
 * Por que existir: o admin UI permite editar templates (incluindo o `name`).
 * Antes, o código consultava `.eq('name', 'senha_temporaria')` — quando o
 * usuário renomeou para "Senha temporária" no painel, o lookup quebrou
 * silenciosamente e a mensagem caiu no fallback de texto puro, sem botão.
 *
 * Solução:
 *   - Migration 142 normalizou todos os names para slug e adicionou
 *     CHECK constraint `name ~ '^[a-z0-9_]+$'` (não aceita acento/espaço).
 *   - Este módulo expõe o catálogo de slugs canônicos como constantes
 *     tipadas + resolver `getTemplateIdBySlug` que mapeia slug → UUID
 *     (com cache em memória) para que TODA query subsequente possa rodar
 *     `.eq('id', uuid)` — referência estável e à prova de renomeações.
 *
 * Multi-tenant: UUIDs variam por install. Por isso o resolver consulta o DB
 * uma vez por slug e cacheia. Para evitar a viagem extra em hot paths,
 * chame `prefetchTemplateIds()` no boot do app admin.
 */
import { supabase } from '../../lib/supabase';

/** Slugs canônicos dos templates seedados pelas migrations.
 *  Este catálogo deve permanecer em sincronia com `whatsapp_templates.name`
 *  no banco. A CHECK constraint da migration 142 garante que o name nunca
 *  diverge do formato slug.
 */
export const WHATSAPP_TEMPLATE_SLUGS = {
  // 2FA
  SENHA_TEMPORARIA:  'senha_temporaria',
  REDEFINICAO_SENHA: 'redefinicao_senha',
  // Acadêmico
  ALERTA_DE_FALTAS:     'alerta_de_faltas',
  NOTA_ABAIXO_DA_MEDIA: 'nota_abaixo_da_media',
  NOVA_ATIVIDADE:       'nova_atividade',
  PRAZO_DE_ATIVIDADE:   'prazo_de_atividade',
  RESULTADO_FINAL:      'resultado_final',
  // Agendamento
  AGENDAMENTO_CANCELADO:   'agendamento_cancelado',
  AGENDAMENTO_CONFIRMADO:  'agendamento_confirmado',
  AGENDAMENTO_REALIZADO:   'agendamento_realizado',
  LEMBRETE_DE_AGENDAMENTO: 'lembrete_de_agendamento',
  // Contato
  CONTATO_RECEBIDO: 'contato_recebido',
  // Financeiro
  COBRANCA_D5_PRE_VENCIMENTO: 'cobranca_d_5_lembrete_pre_vencimento',
  COBRANCA_D0_VENCIMENTO_HOJE: 'cobranca_d0_vencimento_hoje',
  COBRANCA_D3_ATRASO_LEVE:     'cobranca_d3_atraso_leve',
  COBRANCA_D10_ATRASO_MODERADO:'cobranca_d10_atraso_moderado',
  COBRANCA_D30_ATRASO_CRITICO: 'cobranca_d30_atraso_critico',
  CONFIRMACAO_DE_PAGAMENTO:    'confirmacao_de_pagamento',
  // Fiscal
  NFSE_AUTORIZADA: 'nfse_autorizada',
  NFSE_CANCELADA:  'nfse_cancelada',
  // Matrícula
  BOAS_VINDAS_PRE_MATRICULA: 'boas_vindas_pre_matricula',
  DOCUMENTOS_PENDENTES:      'documentos_pendentes',
  MATRICULA_CONFIRMADA:      'matricula_confirmada',
  // Pedidos (loja)
  LEMBRETE_DE_RETIRADA:    'lembrete_de_retirada',
  PAGAMENTO_CONFIRMADO:    'pagamento_confirmado',
  PAGAMENTO_NAO_CONFIRMADO:'pagamento_nao_confirmado',
  PEDIDO_CANCELADO:        'pedido_cancelado',
  PEDIDO_CONCLUIDO:        'pedido_concluido',
  PEDIDO_EM_SEPARACAO:     'pedido_em_separacao',
  PEDIDO_RECEBIDO:         'pedido_recebido',
  PEDIDO_RETIRADO:         'pedido_retirado',
  PRONTO_PARA_RETIRADA:    'pronto_para_retirada',
} as const;

export type WhatsAppTemplateSlug =
  (typeof WHATSAPP_TEMPLATE_SLUGS)[keyof typeof WHATSAPP_TEMPLATE_SLUGS];

/** Cache em memória do mapeamento slug → uuid. */
const idCache = new Map<string, string>();

/** Limpa o cache (útil em testes ou após troca de tenant). */
export function clearTemplateIdCache(): void {
  idCache.clear();
}

/**
 * Resolve um slug para o UUID do template ativo correspondente.
 * Retorna `null` se o slug não existir ou estiver inativo.
 * Faz uma única consulta por slug (cache em memória).
 */
export async function getTemplateIdBySlug(slug: string): Promise<string | null> {
  const cached = idCache.get(slug);
  if (cached) return cached;

  const { data } = await supabase
    .from('whatsapp_templates')
    .select('id')
    .eq('name', slug)
    .eq('is_active', true)
    .maybeSingle();

  const id = (data as { id?: string } | null)?.id ?? null;
  if (id) idCache.set(slug, id);
  return id;
}

/** Carrega o template completo a partir do slug. Usa lookup por UUID. */
export async function loadTemplateBySlug<T = Record<string, unknown>>(
  slug: string,
  columns = 'id, message_type, content, variables',
): Promise<T | null> {
  const id = await getTemplateIdBySlug(slug);
  if (!id) return null;

  const { data } = await supabase
    .from('whatsapp_templates')
    .select(columns)
    .eq('id', id)
    .maybeSingle();

  return (data as T | null) ?? null;
}

/**
 * Pré-carrega todos os UUIDs em uma única query.
 * Idealmente chamada uma vez no boot do admin shell.
 */
export async function prefetchTemplateIds(): Promise<void> {
  const slugs = Object.values(WHATSAPP_TEMPLATE_SLUGS);
  const { data } = await supabase
    .from('whatsapp_templates')
    .select('id, name')
    .in('name', slugs)
    .eq('is_active', true);

  ((data as Array<{ id: string; name: string }> | null) ?? []).forEach((row) => {
    idCache.set(row.name, row.id);
  });
}
