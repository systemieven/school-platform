-- 174: ai_insights — caixa de entrada do assistente IA (Sprint 13.IA.v2)
-- Tabela central para agentes proativos. Cada linha é um achado do agente
-- disponibilizado para um público (audience) e opcionalmente para um
-- destinatário específico (recipient_id). Hook client assina via Realtime
-- para mostrar no <AiInsightsInbox/>.

CREATE TABLE IF NOT EXISTS ai_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug          TEXT NOT NULL REFERENCES ai_agents(slug) ON DELETE CASCADE,
  severity            TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','dismissed','resolved')),
  audience            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recipient_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  related_module      TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id   UUID,
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions             JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_hash        TEXT NOT NULL,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at             TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ
);

-- Dedup: não cria insight duplicado em status 'new' para mesmo context_hash/agent
CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_dedup
  ON ai_insights(agent_slug, context_hash) WHERE status = 'new';

CREATE INDEX IF NOT EXISTS ai_insights_audience_gin
  ON ai_insights USING gin(audience);

CREATE INDEX IF NOT EXISTS ai_insights_recipient
  ON ai_insights(recipient_id) WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_insights_status_severity
  ON ai_insights(status, severity, created_at DESC);

CREATE OR REPLACE FUNCTION set_ai_insights_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ai_insights_updated_at ON ai_insights;
CREATE TRIGGER trg_ai_insights_updated_at
  BEFORE UPDATE ON ai_insights
  FOR EACH ROW EXECUTE FUNCTION set_ai_insights_updated_at();

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- Admin/super_admin/coordinator: SELECT e UPDATE tudo
CREATE POLICY "ai_insights_admin_all" ON ai_insights
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin','admin','coordinator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin','admin','coordinator')
    )
  );

-- Professor: SELECT quando audience contém 'teacher'
CREATE POLICY "ai_insights_teacher_select" ON ai_insights
  FOR SELECT TO authenticated
  USING (
    audience && ARRAY['teacher']
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "ai_insights_teacher_update" ON ai_insights
  FOR UPDATE TO authenticated
  USING (
    audience && ARRAY['teacher']
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

-- Guardian/student: só os próprios via recipient_id
CREATE POLICY "ai_insights_recipient_select" ON ai_insights
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "ai_insights_recipient_update" ON ai_insights
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());

-- INSERT apenas via service_role (edge functions) — nenhuma policy de INSERT

-- Realtime: adicionar tabela à publication
ALTER PUBLICATION supabase_realtime ADD TABLE ai_insights;

INSERT INTO audit_logs (action, module, description)
VALUES ('system.migration', 'ai', 'Aplicada migration 174 (ai_insights)');
