-- Migration 64: Fix missing variables on academico and financeiro WhatsApp categories
-- Migration 52 seeded 'academico' without the variables column.
-- 'financeiro' may have been created via the UI without variables.
-- This migration ensures both categories have the correct variable lists.

-- Fix academico category
UPDATE whatsapp_template_categories
SET
  variables  = ARRAY[
    'aluno_nome', 'disciplina', 'nota', 'media_minima',
    'percentual_faltas', 'percentual_maximo',
    'resultado', 'ano_letivo',
    'atividade_titulo', 'data_entrega'
  ],
  updated_at = now()
WHERE slug = 'academico';

-- Upsert financeiro category (may already exist from UI creation)
INSERT INTO whatsapp_template_categories (slug, label, color, variables, sort_order)
VALUES (
  'financeiro',
  'Financeiro',
  'green',
  ARRAY[
    'guardian_name', 'student_name',
    'due_date', 'amount', 'reference_month', 'payment_link',
    'total_due', 'paid_amount', 'paid_at',
    'school_name', 'school_phone'
  ],
  80
)
ON CONFLICT (slug) DO UPDATE
  SET variables  = ARRAY[
        'guardian_name', 'student_name',
        'due_date', 'amount', 'reference_month', 'payment_link',
        'total_due', 'paid_amount', 'paid_at',
        'school_name', 'school_phone'
      ],
      updated_at = now();
