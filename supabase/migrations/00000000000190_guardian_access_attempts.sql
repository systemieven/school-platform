-- ============================================================================
-- 00000000000190_guardian_access_attempts.sql
--
-- Rate-limit + auditoria do fluxo de "primeiro acesso / esqueci a senha" do
-- portal do responsável. Cada chamada à edge function `guardian-request-access`
-- grava 1 linha aqui (independente do resultado) para:
--   1) limitar abuso (ver constantes na edge function);
--   2) permitir o admin auditar tentativas suspeitas (CPF inexistente,
--      telefone divergente, etc).
--
-- Sem RLS pública — só service_role grava/lê. Admin lê via consulta direta
-- com service-role caso precise debugar; UI dedicada fica para depois.
-- ============================================================================

CREATE TABLE IF NOT EXISTS guardian_access_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf         TEXT NOT NULL,                 -- CPF normalizado (somente dígitos)
  phone       TEXT,                          -- telefone fornecido (formato como veio)
  ip_address  TEXT,                          -- IP do cliente (X-Forwarded-For 1ª entrada)
  user_agent  TEXT,                          -- UA truncado em 255 chars
  result      TEXT NOT NULL CHECK (result IN (
                'sent',                      -- senha provisória enviada com sucesso
                'cpf_not_found',             -- CPF não existe em student_guardians
                'phone_mismatch',            -- CPF existe mas telefone não bate
                'no_whatsapp',               -- número válido mas não tem WhatsApp
                'rate_limited',              -- bloqueado por excesso de tentativas
                'whatsapp_send_failed',      -- erro técnico no envio
                'invalid_input',             -- payload mal-formatado
                'wa_not_configured'          -- credenciais UazAPI ausentes
              )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_access_attempts_cpf_created
  ON guardian_access_attempts(cpf, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_access_attempts_ip_created
  ON guardian_access_attempts(ip_address, created_at DESC);

ALTER TABLE guardian_access_attempts ENABLE ROW LEVEL SECURITY;

-- Sem policies — service_role bypass é o único acesso. Admin pode ler via
-- query direta no painel SQL se precisar investigar.
COMMENT ON TABLE guardian_access_attempts IS
  'Auditoria/rate-limit do fluxo público de primeiro acesso do portal do responsável (edge function guardian-request-access).';

-- Audit
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'security',
    'Aplicada migration 190 (guardian_access_attempts: rate-limit do primeiro acesso do responsável)',
    jsonb_build_object('migration', '00000000000190_guardian_access_attempts')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
