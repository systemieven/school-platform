-- CPF passa a ser a chave natural do candidato.
--
-- `candidates.cpf` já é UNIQUE desde a migration 205 (candidates_cpf_key).
-- Aqui removemos a UNIQUE de `email`: um mesmo CPF pode atualizar o email ao
-- longo do tempo, e a chave humana de negócio é o documento fiscal.
--
-- O edge function `careers-intake` e o hook `upsertCandidateByCpf` agora
-- fazem lookup por CPF. Validação de CPF (checksum) é feita em
-- `src/lib/cpf.ts` (client) e `_shared/cpf.ts` (edge function).
--
-- CPF permanece NULLable no DB pra não quebrar candidatos legados — a
-- obrigatoriedade é enforçada na aplicação. Uma futura migration pode
-- adicionar NOT NULL depois que todos os registros forem backfillados.

ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_email_key;

-- idx_candidates_email segue existindo pra busca.

DO $$ BEGIN
  RAISE NOTICE 'Aplicada migration 221 (CPF como chave natural; email não-único)';
END $$;
