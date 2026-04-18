-- ============================================================================
-- 00000000000191_teacher_access_attempts.sql
--
-- Espelha a migration 190 (`guardian_access_attempts`) para o portal do
-- professor (/professor). Cada chamada à edge function
-- `professor-request-access` (fluxo "esqueci minha senha" auto-servico,
-- analogo ao do responsavel) grava 1 linha aqui — independente do
-- resultado — para:
--   1) limitar abuso (3 envios bem-sucedidos/email/h, 10 tentativas/IP/10min);
--   2) auditoria (admin pode debugar via consulta direta com service_role).
--
-- Sem RLS publica — service_role bypass e o unico acesso.
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_access_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,                 -- email normalizado (lowercase)
  ip_address  TEXT,                          -- IP do cliente (X-Forwarded-For 1ª entrada)
  user_agent  TEXT,                          -- UA truncado em 255 chars
  result      TEXT NOT NULL CHECK (result IN (
                'sent',                      -- senha provisória enviada com sucesso
                'email_not_found',           -- email não corresponde a nenhum profile teacher ativo
                'no_phone',                  -- profile sem phone cadastrado
                'no_whatsapp',               -- número válido mas não tem WhatsApp
                'rate_limited',              -- bloqueado por excesso de tentativas
                'whatsapp_send_failed',      -- erro técnico no envio
                'invalid_input',             -- payload mal-formatado
                'wa_not_configured'          -- credenciais UazAPI ausentes
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_access_attempts_email_created
  ON teacher_access_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_access_attempts_ip_created
  ON teacher_access_attempts(ip_address, created_at DESC);

ALTER TABLE teacher_access_attempts ENABLE ROW LEVEL SECURITY;

-- Sem policies — service_role bypass é o único acesso.
COMMENT ON TABLE teacher_access_attempts IS
  'Auditoria/rate-limit do fluxo público "esqueci minha senha" do portal do professor (edge function professor-request-access).';

-- Audit
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'security',
    'Aplicada migration 191 (teacher_access_attempts: rate-limit do esqueci-a-senha do professor)',
    jsonb_build_object('migration', '00000000000191_teacher_access_attempts')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
