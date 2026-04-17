-- ============================================================================
-- 00000000000147_fix_module_text_accents.sql
--
-- Corrige labels e descrições da tabela `modules` que foram semeadas sem
-- acentuação (cedilha, til, acento agudo/circunflexo) e abreviações
-- inconsistentes ("Config ..." vs "Configurações ...").
--
-- Só UPDATEs de texto — idempotente; re-rodar não altera nada além do que
-- já está em forma correta.
-- ============================================================================

-- ── Labels ──────────────────────────────────────────────────────────────────
UPDATE modules SET label = 'Parcelas / Cobranças'                WHERE key = 'financial-installments';
UPDATE modules SET label = 'Relatórios Financeiros'              WHERE key = 'financial-reports';
UPDATE modules SET label = 'Portal do Responsável'               WHERE key = 'guardian-portal';
UPDATE modules SET label = 'Ocorrências'                         WHERE key = 'occurrences';
UPDATE modules SET label = 'Autorizações de Atividade'           WHERE key = 'activity-auth';
UPDATE modules SET label = 'Diário de Classe'                    WHERE key = 'teacher-diary';
UPDATE modules SET label = 'Elaboração de Provas'                WHERE key = 'teacher-exams';
UPDATE modules SET label = 'Diário (Leitura Admin)'              WHERE key = 'teacher-portal-admin';
UPDATE modules SET label = 'Declarações'                         WHERE key = 'secretaria-declaracoes';
UPDATE modules SET label = 'Fichas de Saúde'                     WHERE key = 'secretaria-saude';
UPDATE modules SET label = 'Rematrícula'                         WHERE key = 'secretaria-rematricula';
UPDATE modules SET label = 'Transferências'                      WHERE key = 'secretaria-transferencias';

-- Padronizar "Config ..." para "Configurações ..." onde cabe
UPDATE modules SET label = 'Configurações NFS-e'                 WHERE key = 'nfse-config';
UPDATE modules SET label = 'Configurações da Loja'               WHERE key = 'store-settings';
UPDATE modules SET label = 'Configurações Fiscais'               WHERE key = 'store-fiscal-config';

-- ── Descriptions ────────────────────────────────────────────────────────────
UPDATE modules SET description = 'Dashboard financeiro com métricas de receita e inadimplência'
  WHERE key = 'financial';
UPDATE modules SET description = 'Gestão de parcelas, baixa manual, negociação de dívida'
  WHERE key = 'financial-installments';
UPDATE modules SET description = 'Extrato, fluxo de caixa, inadimplência, projeção'
  WHERE key = 'financial-reports';
UPDATE modules SET description = 'Configuração de provedores de pagamento (Asaas, Efi, etc.)'
  WHERE key = 'payment-gateways';
UPDATE modules SET description = 'Bolsas de estudo com validade e aprovação'
  WHERE key = 'financial-scholarships';
UPDATE modules SET description = 'Acesso e gestão do portal do responsável'
  WHERE key = 'guardian-portal';
UPDATE modules SET description = 'Bilhetes e ocorrências de alunos'
  WHERE key = 'occurrences';
UPDATE modules SET description = 'Autorizações de atividades e passeios'
  WHERE key = 'activity-auth';
UPDATE modules SET description = 'Registro de aulas, presença e conteúdo'
  WHERE key = 'teacher-diary';
UPDATE modules SET description = 'Lançamento de atividades e notas'
  WHERE key = 'teacher-activities';
UPDATE modules SET description = 'Criação e gestão de planos de aula'
  WHERE key = 'teacher-lesson-plans';
UPDATE modules SET description = 'Criador de provas com questões'
  WHERE key = 'teacher-exams';
UPDATE modules SET description = 'Diário de todas as turmas — leitura'
  WHERE key = 'teacher-portal-admin';
UPDATE modules SET description = 'Templates e solicitações de declaração'
  WHERE key = 'secretaria-declaracoes';
UPDATE modules SET description = 'Fichas de saúde dos alunos'
  WHERE key = 'secretaria-saude';
UPDATE modules SET description = 'Campanhas e processos de rematrícula'
  WHERE key = 'secretaria-rematricula';
UPDATE modules SET description = 'Transferências e movimentações'
  WHERE key = 'secretaria-transferencias';

-- ── Audit ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  INSERT INTO audit_logs (user_id, user_name, user_role, action, module, description, new_data)
  VALUES (
    NULL, 'system', 'super_admin', 'migration', 'permissions',
    'Aplicada migration 147 (corrige acentuação e abreviações em modules.label/description)',
    jsonb_build_object('migration', '00000000000147_fix_module_text_accents')
  );
EXCEPTION WHEN OTHERS THEN NULL;
END$$;
