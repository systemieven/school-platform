-- ── Appearance settings migration ────────────────────────────────────────────
-- 1. Update RLS policy to allow anon reads for 'appearance' category
-- 2. Seed 8 default appearance rows

-- Drop and recreate the RLS policy to include 'appearance'
DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;

CREATE POLICY "Anon can read public settings"
  ON system_settings
  FOR SELECT
  TO anon
  USING (category IN ('contact', 'visit', 'enrollment', 'general', 'appearance'));

-- Seed appearance rows
INSERT INTO system_settings (category, key, value) VALUES
(
  'appearance',
  'home',
  '{"badge":"Matrículas 2026 abertas","title":"Educação que Transforma Vidas","highlight":"Transforma","subtitle":"Há mais de 20 anos formando cidadãos com excelência acadêmica e valores cristãos em Caruaru.","video_url":"https://s3.ibotcloud.com.br/colegiobatista/imagens/site/video-inicio.mp4","segments":[{"image":"https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=1000","description":"Desenvolvimento integral da criança"},{"image":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000","description":"Base sólida para o futuro"},{"image":"https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1000","description":"Desenvolvimento do pensamento crítico"},{"image":"https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000","description":"Preparação para o futuro"}]}'::jsonb
),
(
  'appearance',
  'educacao_infantil',
  '{"badge":"Educação Infantil · 2 a 5 anos","title":"Educação que Encanta e Transforma","highlight":"Encanta","subtitle":"Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho. Aqui, cada criança é única e especial.","image":"https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070"}'::jsonb
),
(
  'appearance',
  'fundamental_1',
  '{"badge":"Fundamental I · 1º ao 5º ano","title":"Construindo as Bases do Futuro","highlight":"Bases","subtitle":"Bases sólidas para o futuro através de uma educação integral, inovadora e com valores cristãos.","image":"https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070"}'::jsonb
),
(
  'appearance',
  'fundamental_2',
  '{"badge":"Fundamental II · 6º ao 9º ano","title":"Construindo o Futuro de cada jovem","highlight":"Futuro","subtitle":"Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos que duram para toda a vida.","image":"https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070"}'::jsonb
),
(
  'appearance',
  'ensino_medio',
  '{"badge":"Ensino Médio · 1º a 3º ano","title":"Sua rota para o Sucesso","highlight":"Sucesso","subtitle":"Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares das melhores universidades do país.","image":"https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070"}'::jsonb
),
(
  'appearance',
  'contato',
  '{"badge":"Fale conosco","title":"Entre em Contato","highlight":"Contato","subtitle":"Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.","image":"https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=2070","phone":"(81) 3721-4787","address":"Rua Marcílio Dias, 99 | São Francisco, Caruaru/PE","hours":"Segunda a Sexta: 7h às 17h"}'::jsonb
),
(
  'appearance',
  'visita',
  '{"badge":"Visita presencial","title":"Agende sua Visita","highlight":"Visita","subtitle":"Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que o Colégio Batista tem a oferecer.","image":"https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070"}'::jsonb
),
(
  'appearance',
  'matricula',
  '{"badge":"Matrículas 2026 abertas","title":"Matricule seu Filho","highlight":"Filho","subtitle":"Garanta a vaga do seu filho em uma das melhores escolas de Caruaru. O processo é simples e feito pelo responsável legal do candidato.","image":"https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2070"}'::jsonb
)
ON CONFLICT (category, key) DO NOTHING;
