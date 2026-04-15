-- Migration 81: Permissoes para Portal do Professor (Fase 10.P)

-- ── Modulos do Portal do Professor ──────────────────────────────────────────
INSERT INTO modules (module_key, label, description, is_active, position)
VALUES
  ('teacher-diary',        'Diario de Classe',          'Registro de aulas, presenca e conteudo',   true, 50),
  ('teacher-activities',   'Atividades e Notas',        'Lancamento de atividades e notas',         true, 51),
  ('teacher-lesson-plans', 'Planos de Aula',            'Criacao e gestao de planos de aula',       true, 52),
  ('teacher-exams',        'Elaboracao de Provas',      'Criador de provas com questoes',           true, 53),
  ('teacher-portal-admin', 'Diario (Leitura Admin)',    'Diario de todas as turmas — leitura',      true, 54)
ON CONFLICT (module_key) DO NOTHING;

-- ── Permissoes por role ───────────────────────────────────────────────────────
INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete)
VALUES
  -- teacher-diary: professor CRUD proprias entradas; coord/admin leitura
  ('super_admin',  'teacher-diary',        true, true, true, true),
  ('admin',        'teacher-diary',        true, true, true, true),
  ('coordinator',  'teacher-diary',        true, false, false, false),
  ('teacher',      'teacher-diary',        true, true, true, true),
  -- teacher-activities
  ('super_admin',  'teacher-activities',   true, true, true, true),
  ('admin',        'teacher-activities',   true, true, true, true),
  ('coordinator',  'teacher-activities',   true, false, false, false),
  ('teacher',      'teacher-activities',   true, true, true, true),
  -- teacher-lesson-plans
  ('super_admin',  'teacher-lesson-plans', true, true, true, true),
  ('admin',        'teacher-lesson-plans', true, true, true, true),
  ('coordinator',  'teacher-lesson-plans', true, false, false, false),
  ('teacher',      'teacher-lesson-plans', true, true, true, true),
  -- teacher-exams
  ('super_admin',  'teacher-exams',        true, true, true, true),
  ('admin',        'teacher-exams',        true, true, true, true),
  ('coordinator',  'teacher-exams',        true, false, false, false),
  ('teacher',      'teacher-exams',        true, true, true, true),
  -- teacher-portal-admin (leitura do diario de todas as turmas)
  ('super_admin',  'teacher-portal-admin', true, false, false, false),
  ('admin',        'teacher-portal-admin', true, false, false, false),
  ('coordinator',  'teacher-portal-admin', true, false, false, false)
ON CONFLICT (role, module_key) DO NOTHING;
