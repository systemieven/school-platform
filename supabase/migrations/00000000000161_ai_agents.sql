-- Migration 161: ai_agents — Sprint 13: IA multi-provider (Anthropic + OpenAI)
--
-- Tabela de agentes configuráveis. Cada agente encapsula um prompt system + template
-- de user prompt + provider + modelo. O orchestrator carrega por `slug` e dispatcha
-- para o worker correspondente ao provider.
--
-- Templating: `user_prompt_template` suporta `{{var}}` substituído em runtime com os
-- valores de `context` passados ao orchestrator.

CREATE TABLE IF NOT EXISTS ai_agents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT,
  provider              TEXT NOT NULL DEFAULT 'anthropic'
                          CHECK (provider IN ('anthropic', 'openai')),
  model                 TEXT NOT NULL,
  system_prompt         TEXT NOT NULL DEFAULT '',
  user_prompt_template  TEXT NOT NULL DEFAULT '',
  temperature           NUMERIC(3,2) NOT NULL DEFAULT 0.2
                          CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens            INT NOT NULL DEFAULT 1024
                          CHECK (max_tokens > 0 AND max_tokens <= 16384),
  enabled               BOOLEAN NOT NULL DEFAULT true,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agents_admin_all" ON ai_agents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin','admin')));

CREATE OR REPLACE FUNCTION set_ai_agents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION set_ai_agents_updated_at();

-- Seed inicial: 4 agentes previstos no roadmap
INSERT INTO ai_agents (slug, name, description, provider, model, system_prompt, user_prompt_template, temperature, max_tokens)
VALUES
  (
    'op1_mapping',
    'Mapeamento de CSV (OP-1)',
    'Sugere o mapeamento de colunas CSV para campos do destino durante importação em massa.',
    'anthropic',
    'claude-sonnet-4-6',
    'Você é um especialista em mapeamento de dados. Receberá os cabeçalhos e algumas linhas de amostra de um CSV, junto com a lista de campos de destino. Responda APENAS com um JSON válido no formato: {"mapping": {"coluna_csv": "campo_destino" | null}, "confidence": 0.0-1.0}. Use null quando não houver campo correspondente claro.',
    'Cabeçalhos CSV: {{headers}}\n\nAmostra (3 linhas): {{sample_rows}}\n\nCampos de destino disponíveis: {{target_fields}}\n\nProduza o mapeamento em JSON.',
    0.0,
    1024
  ),
  (
    'attendance_triage',
    'Triagem de Atendimentos',
    'Analisa descrição do atendimento e sugere categoria, prioridade e próximas ações.',
    'anthropic',
    'claude-sonnet-4-6',
    'Você é um triador de atendimentos em uma escola. Receberá a descrição de um atendimento e o motivo da visita. Responda APENAS com JSON no formato: {"categoria_sugerida": string, "prioridade": "baixa"|"media"|"alta", "acoes_rapidas": string[]}. As ações devem ser concretas e numeradas em no máximo 3 itens.',
    'Motivo da visita: {{visit_reason}}\n\nDescrição: {{description}}\n\nHistórico (opcional): {{history}}\n\nResponda em JSON.',
    0.3,
    512
  ),
  (
    'discount_suggestion',
    'Sugestão de Desconto',
    'Sugere valor de desconto para parcela com base no histórico do aluno e políticas aplicáveis.',
    'anthropic',
    'claude-sonnet-4-6',
    'Você é um analista financeiro escolar. Receberá histórico de pagamento do aluno, o valor da parcela e os descontos aplicáveis pela política. Responda APENAS com JSON: {"valor_sugerido": number, "percentual_sugerido": number, "justificativa": string}. Seja conservador: nunca ultrapasse o desconto máximo permitido.',
    'Valor da parcela: {{installment_value}}\n\nHistórico de pagamento: {{payment_history}}\n\nDescontos aplicáveis: {{applicable_discounts}}\n\nProduza a sugestão em JSON.',
    0.2,
    512
  ),
  (
    'dashboard_insights',
    'Insights do Dashboard',
    'Gera 3 bullets diários com insights sobre a saúde operacional da escola.',
    'anthropic',
    'claude-sonnet-4-6',
    'Você é um analista de BI escolar. Receberá métricas operacionais resumidas (financeiro, frequência, atendimentos). Responda APENAS com JSON: {"insights": string[]} com exatamente 3 bullets curtos (≤120 chars cada), em português, destacando tendências ou anomalias que merecem atenção.',
    'Métricas do dia {{date}}:\n\n{{metrics_summary}}\n\nGere 3 insights em JSON.',
    0.5,
    512
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 161 (ai_agents + seed 4 agentes)');
