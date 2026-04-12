-- Sprint 4: Dynamic Content — seed content settings
-- Extracts hardcoded arrays from Home + segment pages into system_settings

INSERT INTO system_settings (category, key, value) VALUES

-- ── Home: Features (Por que escolher) ──
('content', 'home_features', '[
  {
    "icon": "GraduationCap",
    "title": "Excelência Acadêmica",
    "desc": "Educação de qualidade com resultados comprovados em vestibulares e ENEM",
    "stat": "90%+",
    "statLabel": "aprovação em vestibulares"
  },
  {
    "icon": "Heart",
    "title": "Valores Cristãos",
    "desc": "Formação integral baseada em princípios éticos e morais",
    "stat": "20+",
    "statLabel": "anos de tradição"
  },
  {
    "icon": "Lightbulb",
    "title": "Metodologia Inovadora",
    "desc": "Aprendizagem ativa com tecnologia integrada ao ensino",
    "stat": "100%",
    "statLabel": "laboratórios modernos"
  },
  {
    "icon": "Trophy",
    "title": "Tradição e Qualidade",
    "desc": "Mais de 20 anos de história na educação de Caruaru",
    "stat": "920+",
    "statLabel": "média ENEM"
  }
]'::jsonb),

-- ── Home: Infrastructure ──
('content', 'home_infrastructure', '[
  {
    "icon": "Building",
    "title": "Infraestrutura Completa",
    "items": ["Salas climatizadas", "Quadra poliesportiva", "Biblioteca moderna"]
  },
  {
    "icon": "Palette",
    "title": "Atividades Extras",
    "items": ["Robótica educacional", "Práticas esportivas", "Clube de ciências"]
  },
  {
    "icon": "HeartHandshake",
    "title": "Acompanhamento Individual",
    "items": ["Orientação pedagógica", "Suporte psicológico", "Reforço escolar"]
  }
]'::jsonb),

-- ── Home: Hero Stats ──
('content', 'home_stats', '[
  { "value": "920+", "label": "ENEM" },
  { "value": "20+",  "label": "Anos de história" },
  { "value": "90%+", "label": "Aprovação vestibular" }
]'::jsonb),

-- ── Educação Infantil ──
('content', 'segment_educacao_infantil', '{
  "pillars": [
    {
      "icon": "Heart",
      "title": "Afetividade",
      "desc": "Construímos vínculos afetivos que proporcionam segurança e confiança para o desenvolvimento.",
      "stat": "100%",
      "statLabel": "ambiente acolhedor"
    },
    {
      "icon": "Brain",
      "title": "Cognição",
      "desc": "Estimulamos a curiosidade e o pensamento crítico através de experiências significativas.",
      "stat": "~20",
      "statLabel": "alunos por turma"
    },
    {
      "icon": "Users",
      "title": "Socialização",
      "desc": "Desenvolvemos habilidades sociais e emocionais através da interação e cooperação.",
      "stat": "20+",
      "statLabel": "anos de experiência"
    },
    {
      "icon": "Plane",
      "title": "Valores",
      "desc": "Cultivamos valores cristãos e éticos que formam o caráter e a cidadania.",
      "stat": "100%",
      "statLabel": "professores qualificados"
    }
  ],
  "activities": [
    { "icon": "Music",   "title": "Musicalização",        "desc": "Desenvolvimento da sensibilidade musical e expressão corporal" },
    { "icon": "Book",    "title": "Contação de Histórias", "desc": "Estímulo à imaginação e desenvolvimento da linguagem" },
    { "icon": "Palette", "title": "Artes",                 "desc": "Exploração de diferentes materiais e técnicas artísticas" },
    { "icon": "Puzzle",  "title": "Jogos Pedagógicos",     "desc": "Desenvolvimento do raciocínio lógico e coordenação motora" }
  ],
  "campos": [
    {
      "img": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000",
      "title": "O Eu, o Outro e o Nós",
      "desc": "Desenvolvimento da identidade e das relações sociais"
    },
    {
      "img": "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&q=80&w=1000",
      "title": "Corpo, Gestos e Movimentos",
      "desc": "Expressão corporal e desenvolvimento motor"
    },
    {
      "img": "https://images.unsplash.com/photo-1555619662-99b91fcec542?auto=format&fit=crop&q=80&w=1000",
      "title": "Traços, Sons, Cores e Formas",
      "desc": "Desenvolvimento artístico e sensorial"
    }
  ]
}'::jsonb),

-- ── Ensino Fundamental I ──
('content', 'segment_fundamental1', '{
  "pillars": [
    {
      "icon": "BookOpen",
      "title": "Aprendizagem Ativa",
      "desc": "Metodologias inovadoras que estimulam o protagonismo e a curiosidade do aluno.",
      "stat": "90%+",
      "statLabel": "aprovação vestibular"
    },
    {
      "icon": "Target",
      "title": "Objetivos Claros",
      "desc": "Metas de aprendizagem definidas e acompanhamento personalizado de cada aluno.",
      "stat": "~20",
      "statLabel": "alunos por turma"
    },
    {
      "icon": "Users",
      "title": "Valores Cristãos",
      "desc": "Formação integral baseada em princípios éticos, morais e no respeito ao próximo.",
      "stat": "20+",
      "statLabel": "anos de tradição"
    },
    {
      "icon": "Lightbulb",
      "title": "Criatividade",
      "desc": "Estímulo ao pensamento criativo e à resolução de problemas de forma inovadora.",
      "stat": "100%",
      "statLabel": "prof. especializados"
    }
  ],
  "differentials": [
    {
      "icon": "Star",
      "title": "Programa Acadêmico",
      "items": ["Material didático de excelência", "Projetos interdisciplinares", "Acompanhamento personalizado"]
    },
    {
      "icon": "Award",
      "title": "Atividades Complementares",
      "items": ["Oficinas de tecnologia", "Práticas esportivas", "Iniciação científica"]
    }
  ]
}'::jsonb),

-- ── Ensino Fundamental II ──
('content', 'segment_fundamental2', '{
  "pillars": [
    {
      "icon": "Brain",
      "title": "Pensamento Crítico",
      "desc": "Desenvolvimento do raciocínio lógico e análise crítica para resolver problemas reais.",
      "stat": "90%+",
      "statLabel": "aprovação vestibulares"
    },
    {
      "icon": "Rocket",
      "title": "Inovação",
      "desc": "Tecnologia integrada ao processo de aprendizagem de forma natural e criativa.",
      "stat": "100%",
      "statLabel": "laboratórios modernos"
    },
    {
      "icon": "Users",
      "title": "Protagonismo",
      "desc": "Desenvolvimento da autonomia e liderança com projetos que estimulam o protagonismo juvenil.",
      "stat": "~20",
      "statLabel": "alunos por turma"
    },
    {
      "icon": "Target",
      "title": "Preparação",
      "desc": "Base sólida para o Ensino Médio e os grandes desafios que estão por vir.",
      "stat": "20+",
      "statLabel": "anos de tradição"
    }
  ],
  "programa": [
    {
      "icon": "Star",
      "title": "Base Curricular",
      "items": ["Português e Literatura", "Matemática", "Ciências", "História e Geografia"]
    },
    {
      "icon": "Award",
      "title": "Disciplinas Complementares",
      "items": ["Inglês Avançado", "Educação Tecnológica", "Iniciação Científica", "Educação Física"]
    },
    {
      "icon": "Lightbulb",
      "title": "Projetos Especiais",
      "items": ["Feira de Ciências", "Olimpíadas do Conhecimento", "Projetos Interdisciplinares", "Clube de Robótica"]
    }
  ],
  "activities": [
    {
      "img": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1000",
      "title": "Laboratório de Ciências",
      "desc": "Experimentos práticos e descobertas científicas"
    },
    {
      "img": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000",
      "title": "Práticas Esportivas",
      "desc": "Desenvolvimento físico e trabalho em equipe"
    },
    {
      "img": "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=1000",
      "title": "Tecnologia e Inovação",
      "desc": "Programação, robótica e pensamento computacional"
    }
  ]
}'::jsonb),

-- ── Ensino Médio ──
('content', 'segment_ensino_medio', '{
  "pillars": [
    {
      "icon": "Trophy",
      "title": "Excelência",
      "desc": "Alto índice de aprovação em vestibulares das universidades mais concorridas do Brasil.",
      "stat": "90%+",
      "statLabel": "aprovação vestibulares"
    },
    {
      "icon": "Brain",
      "title": "Metodologia",
      "desc": "Aprendizagem ativa e personalizada que respeita o ritmo de cada estudante.",
      "stat": "920+",
      "statLabel": "média ENEM"
    },
    {
      "icon": "Target",
      "title": "Foco",
      "desc": "Preparação específica e estruturada para o ENEM com simulados e análise de desempenho.",
      "stat": "100+",
      "statLabel": "aprovações em federais"
    },
    {
      "icon": "Users",
      "title": "Mentoria",
      "desc": "Orientação vocacional e acadêmica para ajudar cada aluno a encontrar seu caminho.",
      "stat": "20+",
      "statLabel": "anos de tradição"
    }
  ],
  "programa": [
    {
      "icon": "Star",
      "title": "Base Curricular",
      "items": ["Linguagens e suas Tecnologias", "Matemática e suas Tecnologias", "Ciências da Natureza", "Ciências Humanas"]
    },
    {
      "icon": "Award",
      "title": "Preparação ENEM",
      "items": ["Simulados periódicos", "Resolução de questões", "Redação semanal", "Monitorias extras"]
    },
    {
      "icon": "Rocket",
      "title": "Diferenciais",
      "items": ["Orientação vocacional", "Mentoria acadêmica", "Projetos de pesquisa", "Laboratórios avançados"]
    }
  ]
}'::jsonb)

ON CONFLICT (category, key) DO NOTHING;

-- Update RLS policy to allow anon read of 'content' category
DROP POLICY IF EXISTS "Anon can read public settings" ON system_settings;
CREATE POLICY "Anon can read public settings" ON system_settings
  FOR SELECT
  USING (category = ANY (ARRAY['contact', 'visit', 'enrollment', 'general', 'branding', 'appearance', 'navigation', 'content']));
