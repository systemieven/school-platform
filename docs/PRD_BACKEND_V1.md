# PRD — Sistema de Gestao do Colegio Batista em Caruaru

> **Versao**: 1.0
> **Data**: 07 de abril de 2026
> **Autor**: IA (Claude) + Iftael (Product Owner)
> **Status**: Rascunho para validacao

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura e Stack](#2-arquitetura-e-stack)
3. [Sistema de Autenticacao e Roles](#3-sistema-de-autenticacao-e-roles)
4. [Sequencia de Desenvolvimento](#4-sequencia-de-desenvolvimento)
5. [FASE 1 — Fundacao](#fase-1--fundacao)
6. [FASE 2 — Modulos Urgentes](#fase-2--modulos-urgentes)
7. [FASE 3 — Comunicacao e WhatsApp](#fase-3--comunicacao-e-whatsapp)
8. [FASE 4 — Qualificacao e Inteligencia](#fase-4--qualificacao-e-inteligencia)
9. [FASE 5 — Portal Educacional](#fase-5--portal-educacional)
10. [FASE 6 — Governanca e Escala](#fase-6--governanca-e-escala)
11. [Integracao Frontend-Backend](#7-integracao-frontend-backend)
12. [Requisitos Nao Funcionais](#8-requisitos-nao-funcionais)
13. [Apendices](#apendices)

---

## 1. Visao Geral

### 1.1 Contexto

O Colegio Batista em Caruaru possui um site institucional (React SPA) em producao com formularios de pre-matricula, contato e agendamento de visitas. Os dados sao armazenados no Supabase, mas nao existe interface de gestao — os registros ficam acessiveis apenas pelo Supabase Dashboard.

### 1.2 Objetivo

Desenvolver um **painel administrativo (backend/admin panel)** que permita a equipe do colegio:
- Gerenciar pre-matriculas, contatos e agendamentos recebidos do site
- Qualificar leads e acompanhar o funil de conversao
- Enviar comunicacoes por WhatsApp (via Uazapi) e e-mail
- Configurar dinamicamente os formularios do site (motivos, campos, documentos)
- Gerenciar o ciclo completo: lead → pre-matricula → aluno confirmado → portal

### 1.3 Usuarios do Sistema

| Role | Descricao | Criado por |
|------|-----------|------------|
| **Super Admin** | Acesso total, gerencia admins | Setup inicial |
| **Admin** | Gerencia modulos operacionais e demais roles | Super Admin |
| **Coordenador** | Gestao de segmento escolar (turmas, professores, alunos) | Admin |
| **Professor** | Gestao de turmas e materiais de aula | Coordenador |
| **Aluno** | Acesso ao portal do aluno (apos confirmacao de matricula) | Conversao de pre-matricula |
| **User** | Acesso customizado conforme permissoes | Admin |

---

## 2. Arquitetura e Stack

### 2.1 Stack Recomendada

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend Admin | React 18 + TypeScript + Vite | Mesmo stack do site, reaproveitamento de design system |
| UI Kit | Tailwind CSS 3 + componentes proprios | Consistencia visual com o site |
| Estado | Zustand ou React Query | Leve, performatico |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions + Realtime) | Ja em uso, evita duplicacao |
| Auth | Supabase Auth (email/senha + 2FA via Uazapi) | Nativo, integrado |
| WhatsApp API | Uazapi (self-hosted ou cloud) | Requisito do cliente |
| Storage | Supabase Storage | Ja configurado para documentos |
| Deploy | Vercel / Cloudflare Pages | CI/CD com GitHub |

### 2.2 Principios Arquiteturais

- **Modular**: cada modulo e independente, pode ser habilitado/desabilitado
- **Config-driven**: formularios do site leem configuracoes do banco em tempo real
- **Event-driven**: mudancas de status disparam gatilhos (notificacoes, templates)
- **Least-privilege**: RLS no Supabase, permissoes granulares por role
- **DRY / KISS / SOLID**: codigo limpo, reutilizavel, testavel

### 2.3 Banco de Dados Existente

```
enrollments              — Pre-matriculas (responsavel + aluno + pais)
enrollment_documents     — Documentos anexados
contact_requests         — Solicitacoes de contato
visit_appointments       — Agendamentos de visitas
visit_blocked_dates      — Datas bloqueadas
visit_settings           — Configuracoes de visita (motivos seed)
testimonials             — Depoimentos de pais
consent_records          — Registros LGPD (IP, user-agent, timestamp)
```

---

## 3. Sistema de Autenticacao e Roles

### 3.1 Autenticacao

- Login por **e-mail + senha** (Supabase Auth)
- **2FA opcional via WhatsApp** (codigo enviado pela Uazapi)
- **Recuperacao de senha** por e-mail
- **Alunos**: login inicial por numero de matricula + CPF do responsavel (senha temporaria), com obrigatoriedade de troca no primeiro acesso
- Sessoes com **token JWT** e refresh automatico
- **Politicas de senha** configuraveis: complexidade, expiracao, historico

### 3.2 Hierarquia de Roles (Fase Inicial)

```
Super Admin
  └── Admin
        ├── Coordenador (por segmento)
        │     ├── Professor
        │     └── Aluno
        └── User (permissoes customizadas)
```

**Fase Inicial**: todas as roles tem acesso aos modulos operacionais (agendamento, contato, pre-matricula). As restricoes granulares sao implementadas na Fase 6.

### 3.3 Gestao de Usuarios

- Super Admin pode: criar/editar/remover Admins
- Admin pode: criar/editar/remover Coordenadores, Professores, Alunos e Users
- Coordenador pode: criar/editar/remover Professores e Alunos do seu segmento
- Professor/Aluno/User: sem permissao de gestao de usuarios (exceto perfil proprio)

---

## 4. Sequencia de Desenvolvimento

```
FASE 1 — Fundacao (Semanas 1-3)
  ├── F1.1  Auth + Roles + Layout Admin
  ├── F1.2  Modulo de Configuracoes (base)
  └── F1.3  Integracao Uazapi (conexao + health check)

FASE 2 — Modulos Urgentes (Semanas 4-8)
  ├── F2.1  Gestao de Agendamentos
  ├── F2.2  Gestao de Pre-Matriculas
  └── F2.3  Gestao de Contatos

FASE 3 — Comunicacao e WhatsApp (Semanas 9-11)
  ├── F3.1  Templates de WhatsApp
  ├── F3.2  Modulo de Notificacoes (externas)
  └── F3.3  Modulo de Notificacoes Internas

FASE 4 — Qualificacao e Inteligencia (Semanas 12-14)
  ├── F4.1  Qualificacao de Leads (Kanban)
  ├── F4.2  Dashboard e Analytics
  └── F4.3  Relatorios e Exportacao

FASE 5 — Portal Educacional (Semanas 15-20)
  ├── F5.1  Gestao de Segmentos, Turmas e Matriculas Confirmadas
  ├── F5.2  Area do Professor
  ├── F5.3  Portal do Aluno
  ├── F5.4  Biblioteca Virtual
  ├── F5.5  Comunicados
  └── F5.6  Eventos

FASE 6 — Governanca e Escala (Semanas 21-24)
  ├── F6.1  Permissoes Granulares (fine-grained)
  ├── F6.2  Gerenciamento de Modulos (on/off)
  ├── F6.3  Logs e Auditoria
  └── F6.4  Documentacao Tecnica e Onboarding
```

---

## FASE 1 — Fundacao

### F1.1 Auth + Roles + Layout Admin

**Dependencias**: Nenhuma
**Prioridade**: Bloqueante

#### Escopo

- Tela de login (e-mail + senha) com design system do colegio
- Tabela `profiles` vinculada a `auth.users` com campo `role`
- Middleware de protecao de rotas por role
- Layout admin: sidebar colapsavel, header com avatar/role/notificacoes, breadcrumb
- Pagina de perfil do usuario (editar nome, avatar, senha)
- CRUD de usuarios (Super Admin → Admin, Admin → demais)

#### Tabelas Novas

```sql
profiles (
  id UUID PK REFERENCES auth.users,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Endpoints/Funcoes

- `POST /auth/signup` — registro (apenas por admin/super_admin)
- `POST /auth/login` — login
- `POST /auth/2fa/send` — enviar codigo 2FA via Uazapi
- `POST /auth/2fa/verify` — verificar codigo 2FA
- Edge Function: `on_user_created` — trigger para criar profile

---

### F1.2 Modulo de Configuracoes (Base)

**Dependencias**: F1.1
**Prioridade**: Bloqueante

#### Escopo

Tabela `system_settings` key-value para configuracoes globais, com interface CRUD agrupada por categoria.

#### Categorias Iniciais

| Categoria | Chaves | Tipo |
|-----------|--------|------|
| `general` | school_name, cnpj, address, phone, email, logo_url | text |
| `uazapi` | instance_url, api_token, webhook_url, connected | text/bool |
| `enrollment` | min_age, require_parents_data, require_documents, required_docs_list | json |
| `contact` | required_fields, contact_reasons (array com label, icon, requires_message, is_lead) | json |
| `visit` | reasons (array com key, label, duration, interval, max_per_day), blocked_weekdays, lunch_start, lunch_end | json |

#### Integracao Frontend

As configuracoes dos modulos `contact`, `visit` e `enrollment` sao lidas pelo site em tempo real. Ao alterar "motivos de contato" no admin, o formulario do site reflete imediatamente.

#### Tabela Nova

```sql
system_settings (
  id UUID PK DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, key)
);
```

---

### F1.3 Integracao Uazapi (Conexao)

**Dependencias**: F1.2
**Prioridade**: Alta

#### Escopo

- Tela de configuracao: URL da instancia + token da API
- Teste de conexao (health check) com feedback visual
- Configuracao de webhook para receber status de mensagens
- Funcao utilitaria `sendWhatsApp(phone, type, payload)` reutilizavel

#### API Uazapi — Endpoints Utilizados

| Funcionalidade | Metodo | Endpoint (base) | Descricao |
|---------------|--------|-----------------|-----------|
| Enviar texto | POST | `/sendText` | Mensagem simples |
| Enviar midia | POST | `/sendMedia` | Imagem, audio, video, documento |
| Enviar botoes | POST | `/sendButtons` | Mensagem com botoes interativos |
| Enviar lista | POST | `/sendList` | Menu com opcoes selecionaveis |
| Status instancia | GET | `/status` | Health check da conexao |
| Webhook config | POST | `/webhook` | Configurar URL de callback |
| Verificar numero | POST | `/checkNumber` | Validar se numero tem WhatsApp |

**Autenticacao**: Header `Authorization: Bearer {token}` em todas as requisicoes.

#### Edge Function

```
uazapi-proxy (Edge Function)
  - Recebe requisicoes do admin
  - Adiciona token (nunca exposto no client)
  - Encaminha para a instancia Uazapi
  - Retorna resposta ao admin
```

---

## FASE 2 — Modulos Urgentes

### F2.1 Gestao de Agendamentos

**Dependencias**: F1.1, F1.2
**Prioridade**: Urgente

#### Escopo

##### Listagem
- Tabela paginada com filtros: data, status, motivo, busca por nome/telefone
- Status com badges coloridos: `pending` (amarelo), `confirmed` (verde), `completed` (azul), `cancelled` (vermelho), `no_show` (cinza)
- Acoes em lote: confirmar, cancelar

##### Detalhes/Edicao
- Visualizacao completa do agendamento
- Edicao de: motivo, data, hora, acompanhantes, status
- Historico de alteracoes (audit log)
- Botao "Enviar confirmacao via WhatsApp" (template)
- Botao "Enviar lembrete via WhatsApp" (template)

##### Criacao Manual
- Formulario identico ao do site, para uso interno (reserva de slots)
- Marca como `internal` na origem

##### Calendario Visual
- Visao semanal/mensal dos agendamentos
- Drag-and-drop para reagendamento
- Indicador visual de lotacao por dia/horario

##### Configuracoes (em F1.2)

| Config | Descricao |
|--------|-----------|
| Motivos da visita | Array: `{ key, label, icon, duration_minutes, interval_minutes, max_per_day }` |
| Horario de atendimento | `start_hour`, `end_hour`, `lunch_start`, `lunch_end` |
| Dias bloqueados fixos | Feriados recorrentes (ex: 25/12, 01/01) |
| Dias bloqueados variaveis | Feriados moveis, recesso, datas especificas |
| Indisponibilidades | Periodos de indisponibilidade (ferias, reformas) |
| Max visitas/dia | Global e por motivo |
| Antecedencia minima | Horas minimas antes do horario para permitir agendamento |
| Antecedencia maxima | Dias maximos no futuro para permitir agendamento |

**Impacto no Frontend**: O site le `visit_settings` para calcular slots disponiveis. O admin atualiza `visit_settings` e o site reflete automaticamente. Duracao e intervalo passam a ser por motivo (ex: "Conhecer estrutura" = 60min + 15min intervalo; "Entrega de documentos" = 30min + 5min).

#### Tabelas Alteradas

```sql
-- Adicionar campos ao visit_appointments
ALTER TABLE visit_appointments ADD COLUMN
  origin TEXT DEFAULT 'website',          -- 'website' | 'internal'
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles(id),
  cancel_reason TEXT,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  confirmation_sent BOOLEAN DEFAULT false;
```

---

### F2.2 Gestao de Pre-Matriculas

**Dependencias**: F1.1, F1.2, F2.1 (integracao agendamento)
**Prioridade**: Urgente

#### Escopo

##### Listagem
- Tabela paginada com filtros: status, segmento, data, busca
- Status pipeline: `new` → `under_review` → `docs_pending` → `docs_received` → `interview_scheduled` → `approved` → `confirmed` → `archived`
- Cada status tem cor, label e pode ter observacao obrigatoria
- Tags para qualificacao rapida

##### Detalhes/Edicao
- Dados completos do responsavel, aluno e pais (readonly com opcao de edicao)
- Visualizacao de documentos anexados (preview inline)
- Checklist de verificacao de dados (toggles por campo)
- Checklist de documentos recebidos vs. necessarios
- Timeline de historico (mudancas de status, mensagens enviadas, notas)
- Campo de observacoes internas por status
- Botoes de acao: mudar status, enviar WhatsApp, agendar entrevista/entrega de docs

##### Integracao com Agendamento
- Botao "Agendar entrega de documentos" → cria agendamento pre-preenchido
- Botao "Agendar entrevista" → cria agendamento com motivo especifico
- Link bidirecional entre pre-matricula e agendamento

##### Conversao
- Ao confirmar matricula: gera numero de matricula unico, cria registro de aluno, envia mensagem de boas-vindas
- Ao arquivar: solicita motivo obrigatorio, envia mensagem de feedback (opcional)

##### Criacao Manual
- Formulario para pre-matricula inserida presencialmente
- Campos identicos ao site + campo "origem" (presencial/telefone/indicacao)

##### Configuracoes (em F1.2)

| Config | Descricao |
|--------|-----------|
| Idade minima | Idade minima da crianca para matricula |
| Dados obrigatorios | Campos required no formulario (aplicacao imediata no frontend) |
| Exigir dados dos pais | Se pai/mae sao obrigatorios ou apenas responsavel |
| Exigir documentos | Se upload de docs e obrigatorio |
| Lista de documentos | Array de docs necessarios com label e obrigatoriedade |
| Status pipeline | Array customizavel de status com cor, label, requer_observacao |
| Numero de matricula | Formato e sequencia (ex: `2026-0001`) |
| Mensagens automaticas | Template por status (integracao F3.1) |

**Impacto no Frontend**: O formulario de matricula do site le as configuracoes para determinar campos obrigatorios, lista de documentos e se pais sao exigidos.

---

### F2.3 Gestao de Contatos

**Dependencias**: F1.1, F1.2
**Prioridade**: Urgente

#### Escopo

##### Listagem
- Tabela paginada com filtros: status, motivo, data, tags, busca
- Status: `new` → `first_contact` → `follow_up` → `resolved` → `archived`
- Tags automaticas por motivo (ex: matricula → tag "lead")
- Indicador de contatos sem resposta (aging)

##### Detalhes
- Dados do contato (readonly — nao editavel, exceto tags/status/notas)
- Timeline de interacoes: primeiro contato, follow-ups, mensagens enviadas
- Campo de resultado do contato: sucesso, sem resposta, reagendado
- Campo de proximo contato (data) com trigger para notificacao
- Canal utilizado (preferencial vs. real)

##### Qualificacao de Lead
- Se motivo envolve interesse em matricula → flag `is_lead = true`
- Opcao de converter contato em pre-matricula (pre-preenche dados)
- Opcao de agendar visita (pre-preenche dados)

##### Configuracoes (em F1.2)

| Config | Descricao |
|--------|-----------|
| Motivos de contato | Array: `{ key, label, icon, requires_message, is_lead_trigger }` |
| Campos obrigatorios | Quais campos sao required no formulario do site |
| Status pipeline | Array customizavel de status com cor e label |
| Mensagens por motivo | Template de resposta por tipo de contato |
| SLA de resposta | Tempo maximo para primeiro contato (gera alerta) |

**Impacto no Frontend**: O formulario de contato le `contact_reasons` para renderizar botoes de motivo. Se um motivo tem `requires_message: true`, o campo de observacoes fica obrigatorio. Se `is_lead_trigger: true`, a secao "Sobre sua familia" aparece.

---

## FASE 3 — Comunicacao e WhatsApp

### F3.1 Templates de WhatsApp

**Dependencias**: F1.3 (Uazapi conectado)
**Prioridade**: Urgente (para funcionamento dos modulos da Fase 2)

#### Escopo

##### Editor de Templates
- Interface visual para criacao de templates
- Tipos suportados: texto, midia (imagem/video/documento), botoes, lista de menu
- Campos dinamicos com sintaxe `{{variavel}}` (ex: `{{visitor_name}}`, `{{appointment_date}}`)
- Preview em tempo real do template renderizado
- Categorias: agendamento, matricula, contato, geral, boas-vindas

##### Variaveis Disponiveis por Modulo

| Modulo | Variaveis |
|--------|-----------|
| Agendamento | `visitor_name`, `visitor_phone`, `appointment_date`, `appointment_time`, `visit_reason`, `companions_count` |
| Pre-Matricula | `guardian_name`, `student_name`, `enrollment_status`, `enrollment_number`, `pending_docs` |
| Contato | `contact_name`, `contact_phone`, `contact_reason`, `contact_status` |
| Geral | `school_name`, `school_phone`, `school_address`, `current_date` |

##### Gatilhos Automaticos
- Configuracao de template por evento: `on_status_change`, `on_create`, `on_reminder`
- Delay configuravel (ex: lembrete 24h antes da visita)
- Condicoes: "enviar apenas se status = X" ou "enviar apenas para motivo = Y"

##### Tabela Nova

```sql
whatsapp_templates (
  id UUID PK DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'text' | 'media' | 'buttons' | 'list'
  content JSONB NOT NULL,     -- { body, media_url, buttons[], list_sections[] }
  variables TEXT[],           -- ['visitor_name', 'appointment_date']
  trigger_event TEXT,         -- 'on_create' | 'on_status_change' | 'on_reminder' | null (manual)
  trigger_conditions JSONB,  -- { status: 'confirmed', module: 'visit' }
  trigger_delay_minutes INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

whatsapp_message_log (
  id UUID PK DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES whatsapp_templates(id),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  rendered_content JSONB NOT NULL,
  status TEXT DEFAULT 'queued', -- 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  sent_by UUID REFERENCES profiles(id),
  related_module TEXT,
  related_record_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### F3.2 Modulo de Notificacoes Externas

**Dependencias**: F3.1
**Prioridade**: Alta

#### Escopo

- Central de envio para WhatsApp e e-mail
- Fila de mensagens com status: queued → sent → delivered → read → failed
- Retry automatico para falhas (max 3 tentativas)
- Agendamento de envio (ex: lembrete 24h antes)
- Log completo de todas as mensagens enviadas
- Dashboard de metricas: taxa de entrega, leitura, falhas

##### Gatilhos Configurados por Modulo

| Evento | Modulo | Acao Padrao |
|--------|--------|------------|
| Novo agendamento | Agendamento | Enviar confirmacao |
| Agendamento confirmado | Agendamento | Enviar detalhes |
| 24h antes da visita | Agendamento | Enviar lembrete |
| Agendamento cancelado | Agendamento | Enviar aviso |
| Nova pre-matricula | Pre-Matricula | Enviar boas-vindas |
| Status alterado | Pre-Matricula | Enviar update |
| Docs pendentes | Pre-Matricula | Solicitar documentos |
| Matricula confirmada | Pre-Matricula | Enviar dados de acesso |
| Novo contato | Contato | Enviar confirmacao de recebimento |

---

### F3.3 Modulo de Notificacoes Internas

**Dependencias**: F1.1
**Prioridade**: Media (pode ser desenvolvido em paralelo com Fase 2)

#### Escopo

- Sistema de notificacoes in-app (bell icon no header)
- Badge com contador de nao lidas
- Tipos: novo agendamento, nova matricula, novo contato, mudanca de status, alerta SLA
- Notificacoes em tempo real via Supabase Realtime
- Preferencias por usuario: sons, horario de silencio, tipos habilitados
- Mark as read individual e em lote

##### Tabelas Novas

```sql
notifications (
  id UUID PK DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                   -- deep link para o registro
  related_module TEXT,
  related_record_id UUID,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

notification_preferences (
  user_id UUID PK REFERENCES profiles(id),
  enabled_types TEXT[] DEFAULT '{}',
  sound_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## FASE 4 — Qualificacao e Inteligencia

### F4.1 Qualificacao de Leads (Kanban)

**Dependencias**: F2.2, F2.3
**Prioridade**: Alta

#### Escopo

- Board Kanban com colunas customizaveis (etapas do funil)
- Etapas padrao: `Novo Lead` → `Primeiro Contato` → `Interesse Confirmado` → `Visita Agendada` → `Visita Realizada` → `Docs Entregues` → `Matricula Confirmada` → `Perdido`
- Drag-and-drop entre etapas com trigger de acoes automaticas
- Cards com info resumida: nome, telefone, motivo, dias no estagio, prioridade
- Filtros: segmento, origem, responsavel, data
- Ao mover card: opcao de adicionar nota, agendar follow-up, enviar template
- Conversao automatica: lead → pre-matricula quando avanca para "Docs Entregues"
- Metricas do funil: taxa de conversao por etapa, tempo medio por etapa

##### Tabelas Novas

```sql
leads (
  id UUID PK DEFAULT gen_random_uuid(),
  source_module TEXT NOT NULL, -- 'contact' | 'enrollment' | 'manual'
  source_record_id UUID,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  stage TEXT NOT NULL DEFAULT 'new_lead',
  priority TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
  assigned_to UUID REFERENCES profiles(id),
  segment_interest TEXT,
  tags TEXT[] DEFAULT '{}',
  score INT DEFAULT 0,
  next_contact_date TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

lead_stages (
  id UUID PK DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  position INT NOT NULL,
  auto_actions JSONB, -- { send_template: 'uuid', create_notification: true }
  is_active BOOLEAN DEFAULT true
);

lead_activities (
  id UUID PK DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  type TEXT NOT NULL, -- 'stage_change' | 'note' | 'call' | 'whatsapp' | 'email' | 'meeting'
  description TEXT,
  from_stage TEXT,
  to_stage TEXT,
  performed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### F4.2 Dashboard e Analytics

**Dependencias**: F2.1, F2.2, F2.3
**Prioridade**: Media

#### Escopo

- Dashboard principal com widgets configuraveis
- Periodo selecionavel (hoje, 7d, 30d, customizado)
- Comparacao com periodo anterior (% variacao)

##### Widgets

| Widget | Dados | Visualizacao |
|--------|-------|-------------|
| Pre-matriculas | Total, por status, por segmento | Cards + bar chart |
| Agendamentos | Total, confirmados, no-show rate | Cards + calendar heatmap |
| Contatos | Total, por motivo, SLA compliance | Cards + pie chart |
| Funil de leads | Conversao por etapa | Funnel chart |
| Mensagens WhatsApp | Enviadas, entregues, lidas, falhas | Line chart |
| Top motivos de contato | Ranking de motivos | Horizontal bar |
| Proximos agendamentos | Lista dos proximos 5 | Timeline |
| Contatos pendentes | Sem resposta ha +48h | Alert list |

---

### F4.3 Relatorios e Exportacao

**Dependencias**: F4.2
**Prioridade**: Media

#### Escopo

- Gerador de relatorios por modulo (pre-matricula, contato, agendamento, leads)
- Filtros: periodo, status, motivo, segmento, responsavel
- Colunas selecionaveis
- Ordenacao e agrupamento
- Exportacao: PDF, Excel (XLSX), CSV
- Relatorios agendados (mensal/trimestral) enviados por e-mail
- Relatorios predefinidos: conversao mensal, origem de leads, taxa de no-show

---

## FASE 5 — Portal Educacional

### F5.1 Gestao de Segmentos, Turmas e Matriculas Confirmadas

**Dependencias**: F2.2 (pre-matricula → aluno confirmado)
**Prioridade**: Media

#### Escopo

- CRUD de segmentos escolares (Educacao Infantil, Fund. I, Fund. II, Medio)
- CRUD de turmas por segmento (ex: "3o Ano A", "5o Ano B")
- Atribuicao de coordenadores por segmento
- Atribuicao de professores por turma
- Conversao de pre-matricula em aluno: gera numero de matricula, vincula a turma
- Ficha do aluno: dados pessoais, responsaveis, turma, historico de status

##### Tabelas Novas

```sql
school_segments (
  id UUID PK DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  coordinator_ids UUID[] DEFAULT '{}',
  position INT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

school_classes (
  id UUID PK DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES school_segments(id),
  name TEXT NOT NULL,
  year INT NOT NULL,
  shift TEXT, -- 'morning' | 'afternoon' | 'full'
  max_students INT,
  teacher_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true
);

students (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  enrollment_number TEXT NOT NULL UNIQUE,
  enrollment_id UUID REFERENCES enrollments(id),
  class_id UUID REFERENCES school_classes(id),
  full_name TEXT NOT NULL,
  birth_date DATE,
  cpf TEXT,
  guardian_name TEXT NOT NULL,
  guardian_phone TEXT NOT NULL,
  guardian_email TEXT,
  status TEXT DEFAULT 'active', -- 'active' | 'transferred' | 'graduated' | 'inactive'
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### F5.2 Area do Professor

**Dependencias**: F5.1
**Prioridade**: Baixa

#### Escopo

- Dashboard do professor: minhas turmas, proximas aulas, comunicados
- Gestao de turmas atribuidas: lista de alunos, frequencia
- Upload de materiais de aula (documentos, links, videos)
- Criacao de atividades com data de entrega
- Lancamento de notas por atividade/avaliacao
- Visualizacao de comunicados do coordenador/admin

---

### F5.3 Portal do Aluno

**Dependencias**: F5.1, F5.2
**Prioridade**: Baixa

#### Escopo

- Login: numero de matricula + CPF responsavel (primeiro acesso) → criar senha
- Dashboard: proximas atividades, notas recentes, comunicados
- Materiais de aula da turma (por disciplina)
- Atividades com status (pendente/entregue/corrigida)
- Boletim de notas (por periodo/bimestre)
- Comunicados da escola/turma
- Perfil com dados pessoais (readonly para aluno)

---

### F5.4 Biblioteca Virtual

**Dependencias**: F5.1
**Prioridade**: Baixa

#### Escopo

- Catalogo de recursos: livros, artigos, videos, links
- Categorias por disciplina e nivel de ensino
- Busca com filtros
- Visualizacao em grid/lista
- Controle de acesso por segmento/turma
- Sugestoes do professor para turmas especificas

---

### F5.5 Comunicados

**Dependencias**: F5.1, F3.1
**Prioridade**: Baixa

#### Escopo

- Criacao de comunicados com titulo, corpo rich-text, anexos
- Publico-alvo: todos, segmento, turma, ou usuarios especificos
- Canais: in-app + WhatsApp (template) + e-mail
- Agendamento de publicacao
- Confirmacao de leitura
- Historico de comunicados

---

### F5.6 Eventos

**Dependencias**: F5.5
**Prioridade**: Baixa

#### Escopo

- Calendario de eventos da escola
- Criacao com titulo, descricao, data/hora, local, publico-alvo
- Confirmacao de presenca (RSVP)
- Envio de lembretes via WhatsApp
- Exibicao na area do professor e portal do aluno
- Integracao com calendario do site institucional

---

## FASE 6 — Governanca e Escala

### F6.1 Permissoes Granulares (Fine-Grained)

**Dependencias**: Todas as fases anteriores
**Prioridade**: Importante (ultima feature)

#### Conceito

Inspirado no modelo de [Fine-Grained Personal Access Tokens do GitHub](https://github.blog/security/application-security/introducing-fine-grained-personal-access-tokens-for-github), implementar um sistema de permissoes em tres camadas:

1. **Resource targeting** — qual modulo/segmento/turma
2. **Permission specification** — qual acao (view, create, edit, delete, export)
3. **Approval governance** — quem autoriza (hierarquia de roles)

#### Modelo de Permissoes

```
Permissao = Modulo + Recurso + Acao + Escopo

Exemplo:
  appointments.view.all          — Ver todos os agendamentos
  appointments.edit.own          — Editar apenas os proprios
  enrollments.view.segment:ei    — Ver matriculas da Ed. Infantil
  students.view.class:3a         — Ver alunos da turma 3A
  templates.create               — Criar templates de WhatsApp
  settings.edit.visit            — Editar configuracoes de visita
```

##### Niveis de Acao (por recurso)

| Acao | Descricao |
|------|-----------|
| `none` | Sem acesso |
| `view` | Apenas visualizar |
| `create` | Criar novos registros |
| `edit` | Editar registros existentes |
| `delete` | Remover registros |
| `export` | Exportar dados |
| `manage` | Acesso total (inclui todas acima) |

##### Interface

- Tela de edicao de permissoes por role (grid modulo x acao)
- Override por usuario individual (excecoes)
- Preview: "O que o usuario X pode fazer?" → lista de permissoes efetivas
- Audit log: quem alterou qual permissao, quando

##### Tabelas Novas

```sql
role_permissions (
  id UUID PK DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  resource TEXT DEFAULT '*',
  actions TEXT[] NOT NULL,
  scope JSONB, -- { segment_id: 'uuid' } ou { class_id: 'uuid' } ou null (all)
  created_at TIMESTAMPTZ DEFAULT now()
);

user_permission_overrides (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  module TEXT NOT NULL,
  resource TEXT DEFAULT '*',
  actions TEXT[] NOT NULL,
  scope JSONB,
  is_grant BOOLEAN DEFAULT true, -- true = conceder, false = revogar
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### F6.2 Gerenciamento de Modulos

**Dependencias**: F6.1
**Prioridade**: Media

#### Escopo

- Interface para habilitar/desabilitar modulos do sistema
- Mapa de dependencias entre modulos (ex: Templates depende de Uazapi)
- Ao desabilitar: ocultar menu, bloquear rotas, manter dados
- Ao reabilitar: restaurar acesso sem perda de dados
- Indicador visual de modulos ativos/inativos

---

### F6.3 Logs e Auditoria

**Dependencias**: F1.1
**Prioridade**: Media (pode ser desenvolvido incrementalmente)

#### Escopo

- Log de todas as acoes CRUD no sistema
- Campos: usuario, acao, modulo, registro, dados anteriores, dados novos, IP, timestamp
- Interface de consulta com filtros
- Retencao configuravel (30d, 90d, 1y)
- Exportacao de logs

##### Tabela Nova

```sql
audit_logs (
  id UUID PK DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- 'create' | 'update' | 'delete' | 'login' | 'export'
  module TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs (user_id);
CREATE INDEX idx_audit_module ON audit_logs (module);
CREATE INDEX idx_audit_date ON audit_logs (created_at DESC);
```

---

### F6.4 Documentacao Tecnica

**Dependencias**: Todas
**Prioridade**: Continua

- API documentation (auto-gerada a partir dos tipos TypeScript)
- Guia de onboarding para novos desenvolvedores
- Runbook operacional (deploy, rollback, monitoramento)
- Manual do usuario para cada modulo

---

## 7. Integracao Frontend-Backend

### Config-Driven Frontend

O site institucional deve ler configuracoes do admin em tempo real. Fluxo:

```
Admin altera config → system_settings atualizado →
Site le system_settings via Supabase → Formulario reflete mudanca
```

### Endpoints de Configuracao para o Site

| Config | Usado por | Impacto no Frontend |
|--------|-----------|-------------------|
| `visit.reasons` | AgendarVisita.tsx | Motivos, duracao, intervalo por motivo |
| `visit.schedule` | AgendarVisita.tsx | Horarios, almoco, antecedencia |
| `visit.blocked_dates` | AgendarVisita.tsx | Feriados e indisponibilidades |
| `contact.reasons` | Contato.tsx | Botoes de motivo, requires_message, is_lead |
| `contact.required_fields` | Contato.tsx | Campos obrigatorios |
| `enrollment.required_docs` | Matricula.tsx | Lista de documentos |
| `enrollment.require_parents` | Matricula.tsx | Se exibe secao pai/mae |
| `enrollment.min_age` | Matricula.tsx | Validacao de idade |

---

## 8. Requisitos Nao Funcionais

### Performance
- Tempo de resposta < 200ms para consultas paginadas
- Paginacao server-side para listagens (50 items/page)
- Realtime para notificacoes (Supabase channels)

### Seguranca
- RLS em todas as tabelas
- Edge Functions para operacoes sensiveis (Uazapi proxy, 2FA)
- Mascaramento de dados sensiveis (CPF, telefone parcial) para roles restritas
- Rate limiting em endpoints publicos
- CSRF/XSS protection
- Audit log completo

### Escalabilidade
- Arquitetura modular (modulos independentes)
- Supabase auto-scaling para DB e Storage
- CDN para assets estaticos
- Lazy loading de modulos no frontend admin

### UX/UI
- Design system consistente com o site (navy, gold, Playfair, Inter)
- Responsivo (desktop-first para admin, mas funcional em tablet)
- Loading states, empty states, error states em todos os componentes
- Confirmacao para acoes destrutivas
- Undo para acoes reversiveis (soft delete)
- Keyboard shortcuts para acoes frequentes

### Observabilidade
- Health check endpoint
- Metricas de uso por modulo
- Alertas para falhas de integracao (Uazapi down, Supabase errors)

---

## Apendices

### A. Glossario

| Termo | Definicao |
|-------|----------|
| Lead | Contato com potencial interesse em matricula |
| Pre-matricula | Inscricao formal enviada pelo site ou presencialmente |
| Aluno confirmado | Pre-matricula aprovada com numero de matricula |
| Template | Modelo de mensagem WhatsApp com variaveis dinamicas |
| Gatilho | Evento que dispara acao automatica (notificacao, template) |
| Slot | Horario disponivel para agendamento de visita |

### B. Integracao Uazapi

**Documentacao**: https://docs.uazapi.com
**Autenticacao**: Bearer token no header `Authorization`
**Formato**: JSON em todas as requisicoes/respostas

Funcionalidades utilizadas:
- Envio de mensagens (texto, midia, botoes, listas)
- Verificacao de numero (checkNumber)
- Webhook para status de entrega
- Codigo de verificacao para 2FA

### C. Tabelas Supabase Existentes (Frontend v1)

Referencia completa no arquivo `context_frontend_v1.md` na memoria do projeto.

### D. Repositorio

- **GitHub**: `systemieven/batista-site`
- **Branch principal**: `main`
- **App admin**: sera hospedado em rota `/admin` ou subdominio `admin.colegiobatistacaruaru.com.br`
