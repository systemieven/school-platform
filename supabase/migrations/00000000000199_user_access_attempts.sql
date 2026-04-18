-- Migration 199 — user_access_attempts
--
-- Tabela de auditoria do novo fluxo `user-request-access` (esqueci minha
-- senha generalizado para admin/coordinator/teacher/user via /admin/login).
--
-- Substitui `teacher_access_attempts` (migration 191) — a antiga fica
-- preservada como histórico read-only, nenhum código novo escreve nela.
--
-- Coluna extra `attempted_role` captura qual role foi encontrada no
-- lookup (útil pra auditar tentativas bloqueadas via result='blocked_role'
-- quando o email pertence a super_admin).

CREATE TABLE IF NOT EXISTS user_access_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT NOT NULL,
  attempted_role TEXT,
  ip_address     TEXT,
  user_agent     TEXT,
  result         TEXT NOT NULL
                 CHECK (result IN (
                   'sent',
                   'email_not_found',
                   'no_phone',
                   'no_whatsapp',
                   'rate_limited',
                   'whatsapp_send_failed',
                   'invalid_input',
                   'wa_not_configured',
                   'blocked_role'
                 )),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_access_attempts_email_idx
  ON user_access_attempts (email, created_at DESC);
CREATE INDEX IF NOT EXISTS user_access_attempts_ip_idx
  ON user_access_attempts (ip_address, created_at DESC);

-- RLS: só service_role (edge function) escreve/lê. Sem policies para
-- clientes autenticados — service_role bypassa RLS por padrão.
ALTER TABLE user_access_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_access_attempts IS
  'Auditoria do fluxo user-request-access (forgot password via WhatsApp para admin/coord/teacher/user). Substitui teacher_access_attempts.';
COMMENT ON COLUMN user_access_attempts.attempted_role IS
  'Role do profile encontrado no lookup (null se email não existe; super_admin quando bloqueado com result=blocked_role).';
