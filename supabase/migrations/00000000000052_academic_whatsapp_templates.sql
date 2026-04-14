-- Migration 52: Seed WhatsApp template category + templates for Acadêmico
-- Fase 9 — Academico Completo (templates)

-- Seed academico category
INSERT INTO whatsapp_template_categories (slug, label, color, sort_order)
VALUES ('academico', 'Acadêmico', '#1e3a5f', 70)
ON CONFLICT (slug) DO NOTHING;

-- Seed 5 template stubs
INSERT INTO whatsapp_templates (category, name, message_type, content, variables)
VALUES
  ('academico', 'Nota Abaixo da Média', 'text',
   '{"body":"Olá! Informamos que {{aluno_nome}} obteve nota {{nota}} em {{disciplina}}, abaixo da média mínima de {{media_minima}}."}',
   ARRAY['aluno_nome','disciplina','nota','media_minima']),
  ('academico', 'Alerta de Faltas', 'text',
   '{"body":"Olá! {{aluno_nome}} atingiu {{percentual_faltas}}% de faltas em {{disciplina}}. O limite máximo é {{percentual_maximo}}%."}',
   ARRAY['aluno_nome','disciplina','percentual_faltas','percentual_maximo']),
  ('academico', 'Resultado Final', 'text',
   '{"body":"Olá! O resultado final de {{aluno_nome}} para o ano letivo {{ano_letivo}} está disponível: {{resultado}}."}',
   ARRAY['aluno_nome','resultado','ano_letivo']),
  ('academico', 'Nova Atividade', 'text',
   '{"body":"Olá! Uma nova atividade de {{disciplina}} foi criada: \"{{atividade_titulo}}\". Data de entrega: {{data_entrega}}."}',
   ARRAY['aluno_nome','disciplina','atividade_titulo','data_entrega']),
  ('academico', 'Prazo de Atividade', 'text',
   '{"body":"Olá! A atividade \"{{atividade_titulo}}\" de {{disciplina}} vence em 2 dias ({{data_entrega}}). Não esqueça!"}',
   ARRAY['aluno_nome','disciplina','atividade_titulo','data_entrega'])
ON CONFLICT DO NOTHING;
