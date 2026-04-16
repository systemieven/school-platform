-- Migration 87: Corrigir lacunas no cadastro de módulos
--
-- Migrations 076, 081 e 086 usaram a coluna errada (module_key em vez de key)
-- no INSERT INTO modules, portanto esses módulos nunca foram inseridos.
-- Esta migration re-insere os módulos faltantes com o nome de coluna correto
-- e adiciona o módulo 'academico' que existia apenas no frontend.

-- ── Módulos do Portal do Responsável (migration 076 corrigida) ───────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('guardian-portal', 'Portal do Responsável', 'Acesso e gestão do portal do responsável', 'Users', 'portais', 40, TRUE, ARRAY[]::TEXT[]),
  ('occurrences',     'Ocorrências',           'Bilhetes e ocorrências de alunos',          'AlertCircle', 'escola', 41, TRUE, ARRAY[]::TEXT[]),
  ('activity-auth',   'Autorizações de Atividade', 'Autorizações de atividades e passeios', 'ClipboardCheck', 'escola', 42, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO NOTHING;

-- role_permissions para guardian-portal / occurrences / activity-auth
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'guardian-portal', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'guardian-portal', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'guardian-portal', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('super_admin', 'occurrences', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'occurrences', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'occurrences', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('teacher',     'occurrences', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('super_admin', 'activity-auth', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('admin',       'activity-auth', TRUE, TRUE, TRUE, TRUE, FALSE),
  ('coordinator', 'activity-auth', TRUE, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── Módulos do Portal do Professor (migration 081 corrigida) ─────────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('teacher-diary',        'Diário de Classe',       'Registro de aulas, presença e conteúdo', 'BookOpenCheck', 'portais', 50, TRUE, ARRAY[]::TEXT[]),
  ('teacher-activities',   'Atividades e Notas',     'Lançamento de atividades e notas',        'ClipboardList', 'portais', 51, TRUE, ARRAY[]::TEXT[]),
  ('teacher-lesson-plans', 'Planos de Aula',         'Criação e gestão de planos de aula',      'FileEdit',      'portais', 52, TRUE, ARRAY[]::TEXT[]),
  ('teacher-exams',        'Elaboração de Provas',   'Criador de provas com questões',          'FileQuestion',  'portais', 53, TRUE, ARRAY[]::TEXT[]),
  ('teacher-portal-admin', 'Diário (Leitura Admin)', 'Diário de todas as turmas — leitura',     'Eye',           'portais', 54, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'teacher-diary',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'teacher-diary',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'teacher-diary',        TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'teacher-diary',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('super_admin', 'teacher-activities',   TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'teacher-activities',   TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'teacher-activities',   TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'teacher-activities',   TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('super_admin', 'teacher-lesson-plans', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'teacher-lesson-plans', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'teacher-lesson-plans', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'teacher-lesson-plans', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('super_admin', 'teacher-exams',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'teacher-exams',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'teacher-exams',        TRUE, FALSE, FALSE, FALSE, FALSE),
  ('teacher',     'teacher-exams',        TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('super_admin', 'teacher-portal-admin', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('admin',       'teacher-portal-admin', TRUE, FALSE, FALSE, FALSE, FALSE),
  ('coordinator', 'teacher-portal-admin', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── Módulos Secretaria Digital (migration 086 corrigida) ────────────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('secretaria-declaracoes',   'Declarações',     'Templates e solicitações de declaração', 'FileText',    'secretaria', 60, TRUE, ARRAY[]::TEXT[]),
  ('secretaria-saude',         'Fichas de Saúde', 'Fichas de saúde dos alunos',             'Heart',       'secretaria', 61, TRUE, ARRAY[]::TEXT[]),
  ('secretaria-rematricula',   'Rematrícula',     'Campanhas e processos de rematrícula',   'RefreshCw',   'secretaria', 62, TRUE, ARRAY[]::TEXT[]),
  ('secretaria-transferencias','Transferências',  'Transferências e movimentações',          'ArrowLeftRight', 'secretaria', 63, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'secretaria-declaracoes',    TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'secretaria-declaracoes',    TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'secretaria-declaracoes',    TRUE, TRUE,  FALSE, FALSE, FALSE),
  ('super_admin', 'secretaria-saude',          TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'secretaria-saude',          TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'secretaria-saude',          TRUE, TRUE,  TRUE,  FALSE, FALSE),
  ('super_admin', 'secretaria-rematricula',    TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'secretaria-rematricula',    TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'secretaria-rematricula',    TRUE, FALSE, FALSE, FALSE, FALSE),
  ('super_admin', 'secretaria-transferencias', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'secretaria-transferencias', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'secretaria-transferencias', TRUE, TRUE,  FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;

-- ── Módulo Acadêmico (novo — usado em /admin/academico) ─────────────────────
INSERT INTO modules (key, label, description, icon, "group", position, is_active, depends_on)
VALUES
  ('academico', 'Acadêmico', 'Disciplinas, grade horária, calendário letivo, boletim e resultados', 'BookOpenCheck', 'academico', 35, TRUE, ARRAY[]::TEXT[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES
  ('super_admin', 'academico', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',       'academico', TRUE, TRUE,  TRUE,  TRUE,  FALSE),
  ('coordinator', 'academico', TRUE, TRUE,  TRUE,  FALSE, FALSE),
  ('teacher',     'academico', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, module_key) DO NOTHING;
