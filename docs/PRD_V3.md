# PRD v3 — Plataforma Escolar (school-platform)

> **Versao**: 3.0
> **Data**: 13 de abril de 2026
> **Status**: Documento unificado — estado atual + roadmap completo ate v1
> **Arquitetura**: Multi-tenant via upstream/client repos

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura e Stack](#2-arquitetura-e-stack)
3. [Sistema de Autenticacao e Roles](#3-sistema-de-autenticacao-e-roles)
4. [Modulos Implementados (Fases 1-7)](#4-modulos-implementados-fases-1-7)
5. [Painel de Configuracoes](#5-painel-de-configuracoes)
6. [Aparencia e Site Institucional](#6-aparencia-e-site-institucional)
7. [Schema do Banco de Dados](#7-schema-do-banco-de-dados)
8. [Edge Functions](#8-edge-functions)
9. [Rotas e Navegacao](#9-rotas-e-navegacao)
10. [Roadmap de Desenvolvimento](#10-roadmap-de-desenvolvimento)
    - 10.1 Visao Geral das Fases
    - 10.2 Fases Concluidas (6-7)
    - 10.3 Fase 8 — Modulo Financeiro
    - 10.4 Fase 9 — Academico Completo
    - 10.5 Fase 10 — Portal do Responsavel
    - 10.6 Fase 11 — Secretaria Digital
    - 10.7 Fase 12 — Modulo Pedagogico
    - 10.8 Fase 13 — IA e Analytics
    - 10.10 Melhorias Transversais
    - 10.11 F6.4 Documentacao Tecnica (ultima etapa da v1)
11. [Requisitos Nao Funcionais](#11-requisitos-nao-funcionais)
12. [Apendices](#apendices)

---

## 1. Visao Geral

### 1.1 Contexto

A plataforma escolar e um produto multi-tenant que atende multiplas escolas. Cada cliente possui seu proprio repositorio e projeto Supabase, mas compartilha o mesmo codigo-base. O primeiro cliente e o Colegio Batista em Caruaru.

O sistema e composto por:

- **Site institucional** (React SPA) com formularios de pre-matricula, contato, agendamento de visitas, depoimentos e biblioteca virtual
- **Painel administrativo** (`/admin`) com 16 modulos de gestao
- **Portal do Aluno** (`/portal`) com dashboard, atividades, notas, comunicados, biblioteca e eventos
- **Modulo de atendimento presencial** (`/atendimento` + `/painel-atendimento`) com check-in por QR Code e fila em tempo real

Todos os dados sao armazenados no Supabase (PostgreSQL + RLS + Realtime + Storage + Edge Functions), com integracao WhatsApp via UazAPI.

### 1.2 Usuarios do Sistema

| Role | Descricao | Criado por |
|------|-----------|------------|
| **Super Admin** | Acesso total, gerencia admins | Setup inicial |
| **Admin** | Gerencia modulos operacionais e demais roles | Super Admin |
| **Coordenador** | Gestao de segmento escolar (turmas, professores, alunos) | Admin |
| **Professor** | Gestao de turmas, materiais, atividades e notas | Coordenador |
| **Aluno** | Acesso ao Portal do Aluno | Conversao de pre-matricula |
| **Responsavel** | Acesso ao Portal do Responsavel (planejado - Fase 10) | Admin/Secretaria |
| **User** | Acesso customizado conforme permissoes | Admin |

---

## 2. Arquitetura e Stack

### 2.1 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend (Site + Admin + Portal) | React 18 + TypeScript + Vite 5 |
| Estilizacao | Tailwind CSS 3 + design tokens proprios |
| Roteamento | React Router DOM v6 (lazy-loaded por area) |
| Icones | Lucide React |
| Fontes | Playfair Display (display) + Inter (sans) |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions + Realtime) |
| Auth | Supabase Auth (email/senha + senha temporaria + force change) |
| WhatsApp API | UazAPI (proxied via Edge Function) |
| Storage | Supabase Storage (4 buckets) |
| Compressao | browser-image-compression (uploads) |
| Drag & Drop | @dnd-kit (hero slideshow, kanban) |

### 2.2 Banco de Dados

- **32+ tabelas** com Row Level Security (RLS) em todas
- **26 migrations** aplicadas sequencialmente
- **4 storage buckets**: `enrollment-documents`, `site-images`, `whatsapp-media`, `library-resources`, `avatars`
- **13 Edge Functions** para logica server-side (5 publicas com rate limiting)
- **Realtime** habilitado em `visit_appointments`, `enrollments`, `contact_requests`, `attendance_tickets` e `system_settings`

### 2.3 Arquitetura Multi-Tenant (Upstream + Client Repos)

O produto opera com um modelo de repositorios separados:

| Repo | Funcao |
|------|--------|
| `systemieven/school-platform` | Repo base generico — todo o codigo-fonte sem dados de cliente |
| `systemieven/batista-site` | Primeiro cliente — aponta upstream para school-platform |

**Regras fundamentais:**

- **Nenhum dado de cliente no codigo-fonte**. Nomes, CNPJs, telefones, enderecos e URLs especificas de um cliente **nunca** devem aparecer hardcoded em arquivos `.ts`/`.tsx`. Esses valores vem de:
  1. `system_settings` no banco de dados (via `useBranding()`, `useSettings()`)
  2. Variaveis de ambiente `VITE_*` (fallbacks em `src/config/client.ts`)
- **Todo codigo e generico**. Features novas vao para o repo base e se propagam para todos os clientes.
- **Customizacoes por cliente** (quando necessarias) ficam apenas no repo do cliente, nunca no base.

**Configuracao por cliente:**

| Fonte | O que configura | Exemplo |
|-------|----------------|---------|
| `.env` (por repo) | Credenciais Supabase, identidade da escola | `VITE_SCHOOL_NAME`, `VITE_SUPABASE_URL` |
| `src/config/client.ts` | Fallbacks genericos lidos de env vars | `CLIENT_DEFAULTS.identity.school_name` |
| `system_settings` (DB) | Cores, fontes, identidade, CTA, contato | Tabela no Supabase, editavel via admin |
| `BrandingContext` | Cascata: DB > config/client.ts > defaults | Carrega na inicializacao do app |

**Propagacao automatica:**

- `.github/workflows/propagate.yml` no school-platform: a cada push em main, abre PR automaticamente em todos os repos clientes (matrix strategy)
- Guard `if: github.repository == 'systemieven/school-platform'` impede execucao nos clientes
- `.github/workflows/sync-upstream.yml` nos clientes: dispatch manual para buscar atualizacoes

**Onboarding de novo cliente:**

1. `scripts/new-client.sh <nome> <supabase-ref>` — cria repo, projeto Supabase, configura env
2. `scripts/push-migrations.sh` — aplica todas as migrations no novo projeto
3. `scripts/deploy-functions.sh` — deploy de todas as Edge Functions
4. Configurar `system_settings` no banco do cliente via painel admin

**Fluxo de push local:**

```
git push upstream main && git push origin main
```

Sempre enviar para upstream (base) E origin (cliente). O push para upstream dispara propagacao automatica.

### 2.4 Principios Arquiteturais

- **Modular**: cada modulo e independente com rotas, componentes e queries proprias
- **Config-driven**: formularios do site leem `system_settings` em tempo real
- **Event-driven**: triggers no banco criam leads automaticamente; templates WhatsApp disparam por evento
- **Least-privilege**: RLS no Supabase; Edge Functions como proxy para APIs externas
- **Code-split**: Admin e Portal sao bundles separados, carregados sob demanda

---

## 3. Sistema de Autenticacao e Roles

### 3.1 Autenticacao Admin

- Login por **e-mail + senha** (Supabase Auth)
- **Senha temporaria** gerada pelo admin, enviada via WhatsApp
- **Force change** no primeiro acesso (`must_change_password` flag)
- **Politica de senha configuravel**: complexidade (upper/lower/numbers/special), tempo de vida (0-360 dias), historico (0-24 senhas)
- Edge Functions: `create-admin-user`, `delete-admin-user`, `reset-user-password`, `change-password`

### 3.2 Autenticacao Portal do Aluno

- **Primeiro acesso**: numero de matricula + CPF do responsavel → define senha
- **Acessos seguintes**: numero de matricula + senha
- E-mail ficticio: `{enrollment_number}@portal.colegiobatista.com.br`
- Contexto React isolado: `StudentAuthContext` com `StudentProtectedRoute`

### 3.3 Autenticacao do Responsavel (Planejado — Fase 10)

- **Credenciais**: CPF do responsavel + codigo de acesso (gerado pela secretaria ou enviado via WhatsApp)
- **E-mail ficticio**: `{cpf}@responsavel.{school_slug}.com.br` (mesmo padrao do Portal do Aluno)
- **Contexto React isolado**: `GuardianAuthContext` com `GuardianProtectedRoute`
- **Multiplos filhos**: um responsavel pode ter varios filhos no sistema; seletor de filho ativo no topo
- **Primeiro acesso**: CPF + matricula do filho → definir senha
- **Senha temporaria**: gerada pelo admin, enviada via WhatsApp
- **Edge Function**: `create-guardian-user` (analoga ao `create-admin-user`)

### 3.4 Hierarquia de Roles

```
Super Admin
  └── Admin
        ├── Coordenador (por segmento)
        │     ├── Professor (por turma)
        │     └── Aluno (por turma)
        ├── Responsavel (por filho — planejado Fase 10)
        └── User (permissoes customizadas)
```

### 3.5 Status de 2FA

**Nao implementado.** Existe categoria `2fa` nos templates WhatsApp (migration 0013), mas nao ha logica de geracao/verificacao de codigos OTP. Os templates dessa categoria sao usados para envio de senhas temporarias, nao para autenticacao de dois fatores.

---

## 4. Modulos Implementados (Fases 1-7)

### 4.1 Dashboard e Analytics

**Rota**: `/admin`
**Roles**: super_admin, admin, coordinator

- **Metricas por periodo** (hoje, 7d, 30d) com comparacao de tendencia:
  - Novos agendamentos, matriculas, contatos
  - Confirmacoes pendentes
- **Pipeline de matriculas** — grafico por status (8 estagios)
- **Distribuicao de agendamentos** — por status (pending, confirmed, completed, cancelled, no_show)
- **Distribuicao de motivos de contato** — breakdown visual
- **Funil de leads** — progressao por estagio do kanban
- **Analytics WhatsApp** — enviadas, entregues, lidas, falhas
- **Alertas**:
  - Contatos sem resposta ha +48h
  - Proximos agendamentos (7 dias)

---

### 4.2 Gestao de Agendamentos

**Rota**: `/admin/agendamentos`
**Roles**: super_admin, admin, coordinator

#### Status Pipeline

`pending` → `confirmed` → `comparecimento` → `completed`
`pending` → `cancelled`
`confirmed` → `no_show`

#### Funcionalidades

- **Listagem paginada** com filtros: data, status, motivo, busca por nome/telefone
- **Badges coloridos** por status
- **Detalhes/Edicao**: dados do visitante, motivo, data/hora, acompanhantes, status, notas
- **Timeline de historico** (`appointment_history`): transicoes de status com timestamps
- **WhatsApp**: envio de confirmacao e lembrete via templates
- **Confirmation tracking**: rastreamento de resposta WhatsApp com delay-aware expiry
- **Acoes em lote**: confirmar, cancelar multiplos
- **Criacao manual**: para reservas internas (origin='internal')

#### Integracao

- Setores de atendimento derivados dos motivos de visita
- Link bidirecional com pre-matriculas e contatos
- Auto-criacao de lead via trigger (`trg_auto_create_lead_from_appointment`)

---

### 4.3 Gestao de Pre-Matriculas

**Rota**: `/admin/matriculas`
**Roles**: super_admin, admin, coordinator

#### Status Pipeline (8 estagios)

`new` → `under_review` → `docs_pending` → `docs_received` → `interview_scheduled` → `approved` → `confirmed` → `archived`

#### Funcionalidades

- **Listagem paginada** com filtros: status, segmento, data, busca
- **Detalhes completos**: responsavel (nome, CPF, telefone, email, endereco), aluno (nome, nascimento, CPF), pais (pai/mae com dados), historico escolar
- **Checklist de documentos** com tracking individual por item
- **Timeline de historico** (`enrollment_history`): mudancas de status, mensagens, notas
- **WhatsApp**: envio de templates por status
- **Numeracao sequencial**: formato `YYYY-NNNN` (migration 0001)
- **Conversao**: matricula confirmada → cria registro de aluno + numero de matricula
- **Criacao manual**: para inscricoes presenciais (origin: presencial/telefone/indicacao)
- **Acoes em lote**: operacoes multi-select

---

### 4.4 Gestao de Contatos

**Rota**: `/admin/contatos`
**Roles**: super_admin, admin, coordinator

#### Status Pipeline

`new` → `first_contact` → `follow_up` → `resolved`
Tambem: `contacted`, `converted`, `closed`, `archived`

#### Funcionalidades

- **Listagem paginada** com filtros: status, motivo, data, busca
- **Detalhes**: nome, celular, email, motivo, segmento de interesse, qtd filhos, como conheceu, wants_visit
- **Timeline de interacoes** (`contact_history`)
- **Qualificacao de lead**: flag `is_lead` automatica por motivo; conversao para pre-matricula ou agendamento
- **SLA de resposta**: alerta para contatos sem resposta (configuravel)
- **WhatsApp**: envio de templates de resposta
- **Auto-criacao de lead** via trigger (`trg_auto_create_lead_from_contact`)

---

### 4.5 Atendimentos Presenciais

Modulo completo de gerenciamento de filas presenciais, desde o check-in por QR Code ate o feedback pos-atendimento.

#### 4.5.1 Painel do Atendente

**Rota**: `/admin/atendimentos`
**Roles**: super_admin, admin, coordinator

- **Fila em tempo real**: cards com numero, nome, setor, horario, tempo de espera
- **Workflow**: Chamar proximo → Iniciar atendimento → Finalizar
- **Status de ticket**: `waiting` → `called` → `in_service` → `finished` (ou `abandoned`/`no_show`)
- **Metricas ao vivo**: tempo medio de espera/atendimento, profundidade da fila por setor
- **Prioridade**: agendados recebem prioridade sobre walk-ins (janela configuravel)
- **Drawer de detalhes**: timeline unificada (appointment_history + attendance_history), dados do visitante, geolocalizacao, feedback

#### 4.5.2 Rota Publica — Check-in (`/atendimento`)

Acessada via QR Code na recepcao. Fluxo de 4 etapas:

1. **Entrada de celular** — visitante digita numero com mascara
2. **Validacao de elegibilidade** — busca agendamento do dia; opcao walk-in se habilitado
3. **Geolocalizacao** — valida distancia Haversine entre dispositivo e coordenadas da instituicao (raio configuravel)
4. **Emissao de senha** — exibe numero, ultimo chamado, setor, estimativa de espera, instrucoes

**Pos-check-in**:
- Status em tempo real via Supabase Realtime
- Notificacao visual + sonora quando senha for chamada
- Formulario de feedback pos-atendimento (opcional, configuravel)

#### 4.5.3 Painel de Exibicao (`/painel-atendimento`)

Display para TV/monitor na recepcao:
- **Protecao por senha** (Edge Function `attendance-panel-auth`)
- **Temas visuais**: dark-blue, dark-green, dark-gold, light
- **Senha em destaque**: numero grande + setor; nome do visitante condicional (`show_visitor_name`)
- **Efeito visual da senha**: 4 presets configuraveis — brilho (glow pulsante), deslizar (slide lateral), quique (bounce elastico), neon (contorno piscante)
- **Historico de chamadas**: lista plana das ultimas N senhas (configuravel, max 4 cards visiveis) com label "ULTIMAS SENHAS CHAMADAS"; toggle `show_history` para exibir/ocultar; `show_visitor_name` aplicado tambem ao historico
- **Filtro por setor**: exibe apenas setores selecionados
- **Som configuravel**: preset (bell/chime/ding/buzzer) + repeticoes (1-3x)
- **Realtime**: atualiza automaticamente ao chamar; senha atual so vai para historico quando a proxima e chamada; guarda contra duplicacao de eventos; reset automatico a meia-noite

---

### 4.6 Lead Kanban

**Rota**: `/admin/leads/kanban`
**Roles**: super_admin, admin, coordinator

- **Board Kanban** com colunas customizaveis (tabela `lead_stages`)
- **Drag-and-drop** entre estagios com trigger de acoes automaticas
- **Cards**: nome, telefone, motivo, dias no estagio, prioridade (low/medium/high/urgent)
- **Auto-actions por estagio**: envio de template WhatsApp ao mover card
- **Scoring**: pontuacao por lead
- **Filtros**: segmento, origem, responsavel, data
- **Fontes**: auto-criado de contatos e agendamentos via triggers; criacao manual
- **Timeline de atividades** (`lead_activities`): stage_change, note, call, whatsapp, email, meeting

---

### 4.7 Relatorios e Exportacao

**Rota**: `/admin/relatorios`
**Roles**: super_admin, admin, coordinator

- **Gerador por modulo**: pre-matricula, contato, agendamento, leads, atendimentos
- **Filtros**: periodo, status, motivo, segmento, responsavel
- **Colunas selecionaveis** e ordenacao
- **Exportacao**: CSV, XLSX, PDF
- Utilidade compartilhada: `src/admin/lib/export.ts`

---

### 4.8 WhatsApp e Comunicacao

Embutido nas configuracoes (aba WhatsApp) com 3 sub-abas:

#### Templates (`TemplatesPage`)
- **Editor visual** de templates com preview em tempo real
- **Tipos**: texto, midia (imagem/video/documento), botoes (reply/URL/copy/call), lista de menu
- **Variaveis dinamicas**: `{{variavel}}` com sugestoes por modulo
- **Categorias** com cores: agendamento, matricula, contato, geral, boas-vindas, 2fa
- **Gatilhos automaticos**: `on_create`, `on_status_change`, `on_reminder` com delay configuravel
- **Condicoes**: enviar apenas para status/motivo especificos
- **Suporte Pix**: botao de pagamento com chave CPF/CNPJ/Phone/Email/EVP

#### Historico (`MessageLogPage`)
- **Log completo** de todas as mensagens enviadas
- **Status tracking**: queued → sent → delivered → read → failed
- **Variaveis usadas** por mensagem
- **Filtros**: status, data, destinatario

#### APIs (`WhatsAppProvidersPanel`)
- **CRUD de provedores** WhatsApp (UazAPI)
- **Status de conexao** em tempo real
- **Webhook automatico** com secret gerado
- **Provider padrao** selecionavel

**Infraestrutura**:
- Edge Function `uazapi-proxy`: proxy autenticado — acessivel por todas as roles autenticadas (token nunca exposto ao client)
- Edge Function `uazapi-webhook`: recebe status de entrega (ibotcloud format)
- Edge Function `auto-notify`: disparado por triggers do banco; renderiza variaveis; envia via UazAPI

---

### 4.9 Notificacoes Internas

- **Bell icon** no header com badge de nao lidas
- **Painel de notificacoes** (`NotificationsPanel`) com lista scrollavel
- **Tipos**: novo agendamento, nova matricula, novo contato, mudanca de status, alerta SLA, conexao WhatsApp
- **Realtime** via Supabase channels
- **Preferencias por usuario** (`notification_preferences`): tipos habilitados, horario de silencio
- **Mark as read** individual e em lote

---

### 4.10 Segmentos, Turmas e Alunos

**Rotas**: `/admin/segmentos`, `/admin/alunos`
**Roles**: super_admin, admin, coordinator

- **CRUD de segmentos**: Educacao Infantil, Fund. I, Fund. II, Ensino Medio
- **CRUD de turmas** por segmento: nome, ano, turno (morning/afternoon/full), max alunos, professores atribuidos
- **Atribuicao de coordenadores** por segmento
- **Atribuicao de professores** por turma (array de IDs)
- **Gestao de alunos**: ficha completa (dados pessoais, responsavel, turma, status)
- **Conversao de pre-matricula** em aluno: gera enrollment_number, vincula a turma

---

### 4.11 Area do Professor

**Rota**: `/admin/area-professor`
**Roles**: super_admin, admin, coordinator, teacher

Interface de gestao de sala com 6 abas:

1. **Visao Geral** — estatisticas da turma, info basica
2. **Alunos** — lista da turma com edicao
3. **Materiais** — upload de documentos, links, videos; controle de visibilidade
4. **Atividades** — criacao de dever, prova, projeto, quiz com data de entrega e pontuacao maxima
5. **Notas** — lancamento por atividade/avaliacao, por aluno
6. **Frequencia** — registro de presenca diaria (present/absent/justified/late)

**Restricao**: professores veem apenas turmas atribuidas; coordenadores/admins veem todas.

---

### 4.12 Portal do Aluno

**Rotas**: `/portal/*`
**Auth**: matricula + senha (isolado do admin)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/portal/login` | LoginPage | Login + primeiro acesso (matricula + CPF) |
| `/portal` | DashboardPage | Proximas atividades, notas recentes, comunicados |
| `/portal/atividades` | ActivitiesPage | Lista filtrada por status (pendente/todas/passadas), tipo, disciplina |
| `/portal/notas` | GradesPage | Boletim por periodo, media por disciplina, threshold >= 6.0 |
| `/portal/comunicados` | AnnouncementsPage | Comunicados publicados, filtrados por targeting (all/class) |
| `/portal/biblioteca` | LibraryPage | Recursos filtrados por turma/segmento/aluno; preview inline (YouTube, PDF, imagem) |
| `/portal/eventos` | EventsPage | Eventos futuros com RSVP (Vou/Talvez/Nao vou) |
| `/portal/perfil` | ProfilePage | Dados pessoais (readonly), troca de senha |

---

### 4.13 Biblioteca Virtual

**Admin**: `/admin/biblioteca`
**Portal**: `/portal/biblioteca`

#### Tipos de Conteudo

| Tipo | Subtipo | Armazenamento |
|------|---------|---------------|
| `book` | `link` | URL externa |
| `article` | `link` | URL externa |
| `video` | `youtube` | Embed via ID |
| `video` | `video_upload` | Supabase Storage |
| `document` | `pdf` | Supabase Storage |
| `image` | `image` | Supabase Storage |
| `link` | `link` | URL externa |

#### Controle de Acesso

| Nivel | target_type | Descricao |
|-------|-------------|-----------|
| Escola inteira | `all` | Visivel para todos os alunos |
| Segmento | `segment` | Filtrado por `segment_ids[]` |
| Turma | `class` | Filtrado por `class_ids[]` |
| Aluno especifico | `student` | Filtrado por `student_ids[]` |

**Storage Bucket**: `library-resources` (privado, acesso via signed URL)

---

### 4.14 Comunicados

**Admin**: `/admin/comunicados`
**Portal**: `/portal/comunicados`
**Roles admin**: super_admin, admin, coordinator, teacher

- **Criacao** com titulo, corpo e publico-alvo (all/segment/class/role)
- **Agendamento** de publicacao (`publish_at`)
- **Campanha WhatsApp**: envio em massa via template selecionado
  - Status de campanha: scheduled → sending → paused → done → deleting
  - Tracking por mensagem: scheduled → sent → failed
  - Controles: iniciar, pausar, retomar, excluir
- **Tracking de leitura** (reads array)

---

### 4.15 Eventos

**Admin**: `/admin/eventos`
**Portal**: `/portal/eventos`
**Roles admin**: super_admin, admin, coordinator, teacher

- **Criacao**: titulo, descricao, local, data/hora inicio-fim
- **Publico-alvo**: all, segmento, turma, role
- **RSVP**: confirmed, declined, maybe (`event_rsvps`)
- **Lembretes WhatsApp**: envio automatico
- **Publicacao**: draft/published

---

### 4.16 Gestao de Usuarios

**Rota**: `/admin/usuarios`
**Roles**: super_admin, admin

- **CRUD** de contas com atribuicao de role
- **Status**: ativo/inativo
- **Senha temporaria**: gera e envia via WhatsApp
- **Force change**: flag `must_change_password`
- **Avatar**: upload com crop (`ImageCropModal`)
- **Hierarquia**: Super Admin cria Admins; Admin cria demais roles

---

## 5. Painel de Configuracoes

**Rota**: `/admin/configuracoes`
**Roles**: super_admin, admin

Interface com **10 abas** (incluindo sub-abas), cada uma com cards recolhiveis (`SettingsCard`) e botao salvar flutuante. A aba "Site" contem 5 sub-abas: Aparencia, Branding, Navegacao, Conteudo e SEO.

### 5.1 Dados Institucionais

**Categoria**: `general`

| Card | Campos |
|------|--------|
| Identificacao | `school_name`, `cnpj` |
| Horario de Funcionamento | `business_hours` — ate 2 intervalos/dia (ex: 07-12 + 14-17), toggle por dia da semana |
| Localizacao | `address` (CEP com busca ViaCEP, rua, numero, bairro, cidade, estado), `whatsapp`, `geolocation` (lat, lng, raio em metros) |
| Contato | `phone`, `email` |
| Redes Sociais | `social_networks` — CRUD inline de plataformas + URLs |
| Identidade Visual | `logo_url` |

### 5.2 WhatsApp

**Sub-abas**: Templates, Historico, APIs

Detalhado na secao [4.8 WhatsApp e Comunicacao](#48-whatsapp-e-comunicacao).

### 5.3 Agendamentos de Visitas

**Categoria**: `visit`

| Card | Descricao |
|------|-----------|
| Motivos de Visita | Drawer CRUD com: label, icone, duracao, buffer, max/slot, max/dia, lead_integrated, antecedencia minima, dias da semana, intervalos por dia (ate 3) |
| Dias Fechados | CRUD table para datas especificas (`visit_blocked_dates`) |
| Feriados | Array de feriados fixos anuais (nome, mes, dia) |

**Integracao**: o site le `visit.reasons` em tempo real para calcular slots disponiveis. Duracao, intervalo e antecedencia sao por motivo.

### 5.4 Atendimentos

**Categoria**: `attendance`

| Card | Chaves | Descricao |
|------|--------|-----------|
| Elegibilidade e Fila | `eligibility_rules`, `allow_walkins`, `priority_queue` | Multi-select de regras (same_day, future, past, any); toggle walk-ins; prioridade por agendamento com janela configuravel |
| Formato de Senha | `ticket_format` | Prefixo (nenhum/setor/custom), digitos, contador por setor; preview dinamica |
| Som de Chamada | `sound` | Toggle + preset (bell/chime/ding/buzzer) com preview audio |
| Tela do Cliente | `client_screen_fields` | Toggles: ultimo chamado, setor, estimativa, instrucoes + texto |
| Feedback | `feedback` | Toggle, prompt text, escala (stars/numeric), comentarios, perguntas customizadas (7 tipos: rating, text, single_choice, multi_choice, scale, yes_no, emoji) |
| Painel de Exibicao | `display_panel` | Senha de acesso, toggle historico (`show_history`), nome do visitante (`show_visitor_name`), efeito da senha (`ticket_effect`: glow/slide/bounce/neon), som (preset + repeticoes), qtd historico (`history_count`), filtro por setor, tema visual (4 opcoes) |

### 5.5 Pre-Matricula

**Categoria**: `enrollment`

| Card | Chaves |
|------|--------|
| Idade Minima | `min_age` (0-18) |
| Segmentos Disponiveis | `segments_available` (multi-select) |
| Documentos Obrigatorios | `required_docs_list` (sugestoes pre-configuradas + customizados) |
| Opcoes | `require_parents_data`, `require_documents` |

### 5.6 Formulario de Contato

**Categoria**: `contact`

| Card | Chaves |
|------|--------|
| SLA de Resposta | `sla_hours` (0-360h) |
| Campos Obrigatorios | `required_fields` (multi-select: nome, email, celular, mensagem) |
| Motivos de Contato | `contact_reasons` — drawer CRUD (max 12): label, icone, lead_integrated, require_message |

### 5.7 Notificacoes

**Categoria**: `notifications`

| Card | Chave |
|------|-------|
| Alertas por E-mail | `admin_email_alerts` |
| Novo Contato | `auto_notify_on_contact` |
| Nova Matricula | `auto_notify_on_enrollment` |
| Nova Visita | `auto_notify_on_visit` |
| Conexao WhatsApp | `notify_wa_connection` |
| Lembrete de Visita | `reminder_hours_before` |

### 5.8 Aparencia

**Categoria**: `appearance`

Detalhado na secao [6. Aparencia e Site Institucional](#6-aparencia-e-site-institucional).

### 5.9 Seguranca

**Categoria**: `security`

| Card | Chave | Descricao |
|------|-------|-----------|
| Complexidade | `password_policy.min_length`, `require_*` | Comprimento minimo (4-32), toggles uppercase/lowercase/numbers/special |
| Tempo de Vida | `password_policy.password_lifetime_days` | 0-360 dias (0 = nunca expira) |
| Reutilizacao | `password_policy.password_history_count` | 0-24 senhas anteriores impedidas |

---

## 6. Aparencia e Site Institucional

### 6.1 Hero Slideshow Dinamico

Configuravel na aba Aparencia > Home:

- **Cenas** (`scenes[]`): array de imagens/videos com media_type, media_url, duracao individual, mascara azul
- **Slideshow config**: duracao padrao (segundos), ordem (sequential/random), efeito de transicao, duracao da transicao (ms)
- **Efeitos de transicao**: crossfade, slide, zoom, blur, flip
- **Drag-and-drop** para reordenar cenas (DndKit)
- **Upload** direto para Supabase Storage (`site-images` bucket)

### 6.2 Editor de Headers por Pagina

8 paginas configuraveis (Home, Ed. Infantil, Fund. I, Fund. II, Ensino Medio, Contato, Visita, Matricula):

| Campo | Descricao |
|-------|-----------|
| `badge` | Texto do badge sobre o titulo |
| `title` | Titulo principal |
| `highlight` | Palavra em destaque no titulo (cor accent) |
| `subtitle` | Descricao abaixo do titulo |
| `image` / `scenes` | Imagem de fundo (paginas) ou slideshow (Home) |

**Home** tambem configura 4 cards de segmentos com imagem e descricao.

### 6.3 Horario de Funcionamento

- Configurado em Dados Institucionais (`general.business_hours`)
- Suporta **ate 2 intervalos por dia** (ex: 07:00-12:00 + 14:00-18:00)
- Exibido **dinamicamente no footer** do site (fonte unica de verdade)
- Usado pelos **agendamentos** para restringir slots disponiveis

### 6.4 Redes Sociais

- CRUD inline na aba Dados Institucionais
- Cada rede: plataforma + URL
- Exibidas no footer do site

### 6.5 Config-Driven Frontend

| Config | Formulario do Site | Impacto |
|--------|-------------------|---------|
| `visit.reasons` | AgendarVisita | Motivos, duracao, intervalo, antecedencia por motivo |
| `visit.holidays` | AgendarVisita | Feriados fixos bloqueados |
| `general.business_hours` | AgendarVisita | Dias/horarios disponiveis |
| `contact.contact_reasons` | Contato | Botoes de motivo, require_message, is_lead |
| `contact.required_fields` | Contato | Campos obrigatorios |
| `enrollment.required_docs_list` | Matricula | Lista de documentos |
| `enrollment.require_parents_data` | Matricula | Se exibe secao pai/mae |
| `appearance.*` | Todas as paginas | Textos do hero, imagens, slideshow |

---

## 7. Schema do Banco de Dados

### 7.1 Tabelas Implementadas

#### Auth e Perfis
| Tabela | Descricao |
|--------|-----------|
| `profiles` | Perfis vinculados a `auth.users` com role, avatar, phone, is_active, must_change_password |

#### Configuracao
| Tabela | Descricao |
|--------|-----------|
| `system_settings` | Key-value (JSONB) por categoria; fonte central de configuracao |

#### Pipeline de Vendas
| Tabela | Descricao |
|--------|-----------|
| `visit_appointments` | Agendamentos com status, confirmacao, origin, companions |
| `visit_settings` | Configuracoes de visita (motivos seed — legado, migrado para system_settings) |
| `visit_blocked_dates` | Datas bloqueadas para agendamento |
| `appointment_history` | Audit trail de transicoes de status |
| `enrollments` | Pre-matriculas completas (responsavel + aluno + pais + endereco + historico escolar) |
| `enrollment_documents` | Documentos anexados as matriculas |
| `enrollment_history` | Audit trail de transicoes de status |
| `contact_requests` | Solicitacoes de contato do site |
| `contact_history` | Audit trail de interacoes |
| `consent_records` | Registros LGPD (IP, user-agent, timestamp) |
| `testimonials` | Depoimentos de pais (pending → approved) |

#### Leads (CRM)
| Tabela | Descricao |
|--------|-----------|
| `leads` | Leads qualificados com stage, priority, score, tags |
| `lead_stages` | Colunas do kanban (name, color, position, auto_actions) |
| `lead_activities` | Historico de interacoes (stage_change, note, call, whatsapp) |

#### Atendimento Presencial
| Tabela | Descricao |
|--------|-----------|
| `attendance_tickets` | Senhas da fila com status, timestamps, geolocalizacao, priority_group |
| `attendance_history` | Audit trail de eventos do ticket |
| `attendance_feedback` | Feedback pos-atendimento (rating, answers, comments) |

#### WhatsApp
| Tabela | Descricao |
|--------|-----------|
| `whatsapp_templates` | Templates de mensagem com tipo, conteudo, variaveis, gatilhos |
| `whatsapp_template_categories` | Categorias com label e cor |
| `whatsapp_message_log` | Log de mensagens enviadas com status de entrega |
| `whatsapp_providers` | Provedores API (UazAPI) com credenciais |
| `confirmation_tracking` | Rastreamento de confirmacao WhatsApp com expiry |

#### Notificacoes
| Tabela | Descricao |
|--------|-----------|
| `notifications` | Notificacoes in-app por usuario |
| `notification_preferences` | Preferencias de notificacao por usuario |

#### Academico
| Tabela | Descricao |
|--------|-----------|
| `school_segments` | Segmentos escolares (Ed. Infantil, Fund. I/II, Medio) |
| `school_classes` | Turmas por segmento com professores atribuidos |
| `students` | Alunos matriculados com enrollment_number e vinculo a turma |
| `activities` | Atividades (homework, test, project, quiz) por turma |
| `grades` | Notas por aluno, atividade, periodo |
| `student_attendance` | Frequencia diaria (present/absent/justified/late). Nota: renomeada de `attendance` para evitar ambiguidade com `attendance_tickets` (fila presencial) |

#### Conteudo
| Tabela | Descricao |
|--------|-----------|
| `library_resources` | Recursos digitais (book, article, video, link, document) com targeting |
| `announcements` | Comunicados com targeting e campanha WhatsApp |
| `school_events` | Eventos com RSVP |
| `event_rsvps` | Respostas RSVP (confirmed/declined/maybe) |

### 7.2 Storage Buckets

| Bucket | Acesso | Uso |
|--------|--------|-----|
| `enrollment-documents` | Privado | Documentos de matricula (JPG, PNG, PDF, max 5MB) |
| `site-images` | Publico | Imagens do hero, headers, segmentos |
| `whatsapp-media` | Privado | Midia para templates WhatsApp |
| `library-resources` | Privado (signed URL) | PDFs, videos, imagens da biblioteca |
| `avatars` | Publico | Fotos de perfil dos usuarios |

### 7.3 Migrations Aplicadas (26)

| # | Nome | Data | Descricao |
|---|------|------|-----------|
| 0 | `baseline` | 07/04 | Schema completo: profiles, system_settings, enrollments, visits, contacts, leads, whatsapp, school, students, library, announcements, events |
| 1 | `sequential_enrollment_number` | 07/04 | Funcao de auto-incremento para numero de matricula |
| 2 | `reminder_chain` | 07/04 | Logica de agendamento de lembretes WhatsApp |
| 3 | `notification_settings` | 07/04 | Tabela notification_preferences |
| 6 | `lead_from_appointment_trigger` | 07/04 | Auto-criacao de lead ao criar agendamento |
| 7 | `lead_from_contact_trigger` | 07/04 | Auto-criacao de lead ao criar contato |
| 8 | `appearance_settings` | 08/04 | Configuracoes de aparencia do site |
| 9 | `site_images_bucket` | 08/04 | Bucket para imagens do site |
| 10 | `password_policy` | 08/04 | Politica de senha configuravel |
| 11 | `senha_temporaria_template` | 08/04 | Template de e-mail para senha temporaria |
| 12 | `redefinicao_senha_template` | 08/04 | Template de e-mail para reset de senha |
| 13 | `add_2fa_category` | 08/04 | Categoria 2FA nos templates WhatsApp |
| 14 | `create_whatsapp_template_categories` | 08/04 | Sistema de categorias com cores |
| 15 | `add_variables_used_to_log` | 08/04 | Tracking de variaveis no log de mensagens |
| 16 | `whatsapp_media_bucket` | 09/04 | Bucket para midia WhatsApp |
| 17 | `avatars_bucket` | 09/04 | Bucket para avatares |
| 18 | `confirmation_tracking` | 09/04 | Rastreamento de confirmacao WhatsApp |
| 19 | `fix_auto_create_lead` | 09/04 | Fix para criacao de lead com motivos string |
| 20 | `confirmation_tracking_delay_aware_expiry` | 09/04 | Logica de expiracao de confirmacao |
| 21 | `realtime_modules` | 09/04 | Realtime para enrollments e contact_requests |
| 22 | `business_hours` | 09/04 | Horario de funcionamento com dual intervals |
| 23 | `social_networks` | 09/04 | Links de redes sociais |
| 24 | `attendance_module` | 09/04 | Modulo completo de atendimento (tickets, feedback, history, RLS) |
| 25 | `attendance_priority_queue` | 11/04 | Prioridade na fila por agendamento |

### 7.4 RLS Policies

#### Acesso Publico (Anon)
- `visit_appointments`: INSERT (pending), SELECT, UPDATE (own pending/confirmed)
- `visit_settings`, `visit_blocked_dates`: SELECT
- `enrollments`: INSERT (new)
- `enrollment_documents`: INSERT
- `contact_requests`: INSERT (new)
- `consent_records`: INSERT
- `testimonials`: INSERT (pending), SELECT (approved)
- `system_settings`: SELECT categorias publicas (contact, visit, enrollment, general)

#### Acesso Admin (Authenticated)
- `profiles`: SELECT all, UPDATE self/lower roles, INSERT (admins), DELETE (super_admin)
- `system_settings`: FULL para admins
- `whatsapp_*`: admin/coordinator/teacher only
- `*_history`: admin full access
- `notifications`: SELECT/UPDATE own (recipient_id = auth.uid())

#### Acesso Portal (Student — via queries filtradas)
- Grades, Activities: filtradas por student_id/class_id
- Announcements, Library, Events: filtradas por target_type + target_ids + is_published

### 7.5 Tabelas Planejadas (Fases 8-12)

#### Fase 8 — Financeiro (Migration 28)

| Tabela | Campos-chave | Descricao |
|--------|-------------|-----------|
| `financial_plans` | name, amount, installments, due_day, punctuality_discount_pct, late_fee_pct, interest_rate_pct, segment_ids, school_year | Planos de mensalidade por ano letivo |
| `financial_contracts` | student_id, plan_id, school_year, status (draft/active/suspended/cancelled/concluded), discount_type, discount_value, net_amount, gateway_id | Contrato financeiro por aluno/ano |
| `financial_installments` | contract_id, student_id, installment_number, reference_month, due_date, amount, status (pending/paid/overdue/negotiated/cancelled/renegotiated), paid_at, paid_amount, provider_charge_id, boleto_url, pix_code, payment_link | Parcelas individuais |
| `financial_notification_log` | installment_id, trigger_type (D-5/D-1/D+0/D+3/D+10/D+30), sent_at, whatsapp_message_id | Log da regua de cobranca |
| `payment_gateways` | provider, label, is_active, is_default, environment, credentials (JSONB criptografado), webhook_secret, supported_methods | Gateways configurados por tenant |
| `gateway_customers` | gateway_id, student_id, provider_customer_id | Cache de clientes no gateway |
| `gateway_webhook_log` | gateway_id, provider, event_type, provider_charge_id, installment_id, normalized (JSONB), raw (JSONB) | Log de eventos de webhook |

#### Fase 9 — Academico Completo (Migrations 29-31)

| Tabela | Campos-chave | Migration | Descricao |
|--------|-------------|-----------|-----------|
| `disciplines` | name, code, weekly_hours, color, segment_ids, is_active | 29 | Disciplinas escolares |
| `class_disciplines` | class_id, discipline_id, teacher_id | 29 | Disciplina por turma + professor |
| `class_schedules` | class_id, discipline_id, teacher_id, day_of_week, start_time, end_time | 29 | Grade horaria |
| `school_calendar_events` | title, type (holiday/exam_period/recess/deadline/institutional/period_start/period_end), start_date, end_date, school_year, period_number, segment_ids | 30 | Calendario letivo |
| `grade_formulas` | segment_id, formula_type (simple/weighted/by_period/custom), config (JSONB), passing_grade, recovery_grade, min_attendance_pct, grade_scale | 30 | Formula de media por segmento |
| `student_results` | student_id, discipline_id, class_id, school_year, period1_avg..period4_avg, recovery_grade, final_avg, attendance_pct, result (approved/recovery/failed_grade/failed_attendance/in_progress) | 31 | Resultado final do aluno |
| `student_transcripts` | student_id, school_year, class_id, segment_id, final_result | 31 | Historico escolar |

#### Fase 10 — Portal do Responsavel (Migration 32)

| Tabela | Campos-chave | Descricao |
|--------|-------------|-----------|
| `guardian_profiles` | id (FK auth.users), cpf, name, phone, email, is_active, must_change_password | Perfis de responsaveis (single source of truth para dados do responsavel) |
| `student_guardians` | student_id (FK students), guardian_id (FK guardian_profiles), relationship (pai/mae/avo/tio/outro), is_financial_guardian, is_primary | Vinculo N:N aluno-responsavel (substitui campos guardian_* e financial_guardian_* da tabela students) |
| `student_occurrences` | student_id, class_id, created_by, type (behavioral/academic/health/administrative/commendation/absence_justification), severity, title, description, attachments, visible_to_guardian, guardian_response, status (open/read/resolved) | Ocorrencias/bilhetes |
| `activity_authorizations` | title, description, event_id, deadline, target_class_ids, target_segment_ids | Autorizacoes de atividades |
| `authorization_responses` | authorization_id, student_id, guardian_id, response (authorized/not_authorized), notes | Respostas de autorizacao |

#### Fase 11 — Secretaria Digital (Migration 33)

| Tabela | Campos-chave | Descricao |
|--------|-------------|-----------|
| `document_templates` | name, type (enrollment/frequency/transfer/transcript/graduation/custom), html_content, variables, requires_signature | Templates de declaracao |
| `document_requests` | student_id, template_id, requested_by, status (pending/approved/generated/delivered/rejected), file_url | Solicitacoes de documentos |
| `student_health_records` | student_id, blood_type, allergies (JSONB), medications (JSONB), special_needs (JSONB), chronic_conditions, emergency_contact_*, health_insurance | Ficha de saude |
| `reenrollment_campaigns` | title, school_year, start_date, end_date, early_discount_pct, default_plan_id, status (draft/active/closed) | Campanhas de rematricula |
| `reenrollment_applications` | campaign_id, student_id, status (not_started/notified/in_progress/pending_signature/completed/cancelled), plan_id | Processos de rematricula |

#### Fase 12 — Pedagogico (Migration 34)

| Tabela | Campos-chave | Descricao |
|--------|-------------|-----------|
| `lesson_plans` | class_id, discipline_id, teacher_id, lesson_date, status (planned/completed/cancelled), content_taught, methodology, resources_used (JSONB), activities_linked, observations | Diario de classe / plano de aula |
| `learning_objectives` | discipline_id, segment_id, school_year, title, bncc_code, sequence_order | Objetivos de aprendizagem |
| `lesson_plan_objectives` | lesson_plan_id, objective_id | N:N plano de aula x objetivos |

#### Modificacoes em Tabelas Existentes (Fases 8-12)

| Tabela | Campo adicionado | Tipo | Fase | Motivo |
|--------|-----------------|------|------|--------|
| `students` | `status` | TEXT | 8 | active/inactive/transferred/cancelled (expandir CHECK existente) |
| `students` | `school_year` | INTEGER | 8 | Ano letivo ativo |
| `activities` | `discipline_id` | UUID FK | 9 | Vinculo a tabela `disciplines` |
| `student_attendance` | `school_calendar_event_id` | UUID FK | 9 | Vinculo a feriados/eventos |
| `student_attendance` | `lesson_plan_id` | UUID FK | 12 | Vinculo ao plano de aula (chamada integrada ao diario) |
| `financial_contracts` | `gateway_id` | UUID FK | 8 | Gateway de pagamento do contrato |
| `financial_installments` | `gateway_id` | UUID FK | 8 | Gateway da parcela |
| `financial_installments` | `provider_charge_id` | TEXT | 8 | ID da cobranca no gateway |
| `financial_installments` | `payment_link` | TEXT | 8 | Link unificado de pagamento |
| `financial_installments` | `gateway_fee_cents` | INTEGER | 8 | Taxa do gateway |
| `financial_installments` | `gateway_raw_response` | JSONB | 8 | Ultima resposta bruta (debug) |
| `whatsapp_template_categories` | 5 novas categorias seed | — | 8-11 | financeiro, academico, ocorrencia, responsavel, secretaria |
| `system_settings` | chave `financial.*` | JSONB | 8 | Config financeira: PIX, gateway, regua |

---

## 8. Edge Functions

### 8.1 Edge Functions Implementadas (13)

| Funcao | Auth | Rate Limit | Descricao |
|--------|------|------------|-----------|
| `uazapi-proxy` | JWT (admin+) | — | Proxy autenticado para UazAPI; token nunca exposto ao client |
| `uazapi-webhook` | Secret URL param | 120/min | Recebe status de entrega WhatsApp; atualiza `whatsapp_message_log` |
| `auto-notify` | Trigger secret | — | Disparado por eventos do banco; encontra templates; renderiza variaveis; envia via UazAPI |
| `attendance-checkin` | Nenhum | 15/min | Check-in em 2 fases: dry-run (validacao) + emissao real (geolocalizacao + ticket) |
| `attendance-feedback` | Nenhum | 10/min | Recebe feedback pos-atendimento; valida ticket finalizado; janela de 24h |
| `attendance-public-config` | Nenhum | 30/min | Devolve config publica de atendimento sem alargar RLS |
| `attendance-panel-auth` | Senha do painel | 5/min | Valida senha; retorna config completa do painel de exibicao |
| `create-admin-user` | JWT (super_admin) | — | Cria usuario + profile com senha temporaria |
| `delete-admin-user` | JWT (super_admin) | — | Remove usuario com cascade cleanup |
| `reset-user-password` | JWT (admin+) | — | Gera senha temporaria; loga para envio WhatsApp |
| `change-password` | JWT (auth) | — | Troca de senha com validacao de politica e historico |
| `geocode-address` | JWT (admin+) | — | Proxy Google Maps Geocoding API; converte endereco em lat/lng |
| `google-static-map` | JWT (admin+) | — | Proxy Google Static Maps API; retorna PNG com marcador + circulo |

**Rate Limiting**: Endpoints publicos usam rate limiter in-memory com sliding window por IP (`_shared/rate-limit.ts`). Resposta 429 inclui headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Endpoints protegidos por JWT nao precisam de rate limiting adicional.

### 8.2 Edge Functions Planejadas (Fases 8-12)

| Funcao | Auth | Rate Limit | Fase | Descricao |
|--------|------|------------|------|-----------|
| `financial-notify` | Trigger secret (pg_cron) | — | 8 | Disparado diariamente as 08:00; itera parcelas overdue/pending por timing da regua; renderiza templates financeiros; envia via `uazapi-proxy` |
| `payment-gateway-proxy` | JWT (admin+) | — | 8 | Proxy multi-gateway com GatewayRouter; actions: create_customer, create_charge, cancel_charge, get_charge, refresh_charge, ping; descriptografa credenciais AES-256-CBC |
| `payment-gateway-webhook` | Secret URL param | 120/min | 8 | Recebe confirmacoes de pagamento de qualquer gateway; normaliza via adapter; atualiza installments; idempotente; verify_jwt = false |
| `generate-document` | JWT (admin+) | — | 11 | Renderiza template HTML com variaveis → gera PDF; salva em Storage; retorna signed URL |
| `create-guardian-user` | JWT (super_admin) | — | 10 | Cria usuario Supabase Auth para responsavel + `guardian_profiles`; gera senha temporaria |
| `calculate-grades` | JWT (admin+) | — | 9 | Calcula medias e resultado final por turma/periodo usando a `grade_formula` do segmento |
| `occurrence-notify` | Trigger secret | — | 10 | Disparado ao inserir em `student_occurrences`; envia WhatsApp ao responsavel do aluno |

---

## 9. Rotas e Navegacao

### 9.1 Site Publico (14 rotas)

| Rota | Componente | Status |
|------|-----------|--------|
| `/` | Home | Completo |
| `/educacao-infantil` | EducacaoInfantil | Completo |
| `/ensino-fundamental-1` | EnsinoFundamental1 | Completo |
| `/ensino-fundamental-2` | EnsinoFundamental2 | Completo |
| `/ensino-medio` | EnsinoMedio | Completo |
| `/matricula` | Matricula | Completo |
| `/contato` | Contato | Completo |
| `/agendar-visita` | AgendarVisita | Completo |
| `/politica-privacidade` | PoliticaPrivacidade | Completo |
| `/termos-de-uso` | TermosUso | Completo |
| `/sobre` | EmConstrucao | Placeholder |
| `/estrutura` | EmConstrucao | Placeholder |
| `/area-professor` | EmConstrucao | Placeholder |
| `/*` | NotFound | 404 |

### 9.2 Atendimento Publico (2 rotas)

| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/atendimento` | AtendimentoPublico | Check-in por QR Code |
| `/painel-atendimento` | PainelAtendimento | Display TV/monitor |

### 9.3 Admin — Rotas Implementadas (17 rotas)

| Rota | Componente | Roles |
|------|-----------|-------|
| `/admin/login` | LoginPage | Publico |
| `/admin/alterar-senha` | ForcePasswordChange | Auth |
| `/admin` | DashboardPage | admin+ |
| `/admin/agendamentos` | AppointmentsPage | admin+ |
| `/admin/matriculas` | EnrollmentsPage | admin+ |
| `/admin/contatos` | ContactsPage | admin+ |
| `/admin/atendimentos` | AttendancePage | admin+ |
| `/admin/leads/kanban` | KanbanPage | admin+ |
| `/admin/relatorios` | ReportsPage | admin+ |
| `/admin/segmentos` | SegmentsPage | admin+ |
| `/admin/alunos` | StudentsPage | admin+ |
| `/admin/area-professor` | TeacherAreaPage | admin+, teacher |
| `/admin/biblioteca` | LibraryPage | admin+, teacher |
| `/admin/comunicados` | AnnouncementsPage | admin+, teacher |
| `/admin/eventos` | EventsPage | admin+, teacher |
| `/admin/usuarios` | UsersPage | super_admin, admin |
| `/admin/configuracoes` | SettingsPage | super_admin, admin |

*admin+ = super_admin, admin, coordinator*

### 9.4 Portal do Aluno — Rotas Implementadas (8 rotas)

| Rota | Componente |
|------|-----------|
| `/portal/login` | LoginPage |
| `/portal` | DashboardPage |
| `/portal/atividades` | ActivitiesPage |
| `/portal/notas` | GradesPage |
| `/portal/comunicados` | AnnouncementsPage |
| `/portal/biblioteca` | LibraryPage |
| `/portal/eventos` | EventsPage |
| `/portal/perfil` | ProfilePage |

### 9.5 Admin — Rotas Planejadas (16 novas)

| Rota | Modulo | Roles | Fase |
|------|--------|-------|------|
| `/admin/financeiro` | Dashboard Financeiro | admin+ | 8 |
| `/admin/financeiro/planos` | Planos de Mensalidade | super_admin, admin | 8 |
| `/admin/financeiro/contratos` | Contratos | admin+ | 8 |
| `/admin/financeiro/cobrancas` | Parcelas / Cobrancas | admin+ | 8 |
| `/admin/disciplinas` | Disciplinas | admin+ | 9 |
| `/admin/grade-horaria` | Grade Horaria | admin+ | 9 |
| `/admin/calendario` | Calendario Letivo | admin+ | 9 |
| `/admin/boletim` | Boletim Formal | admin+ | 9 |
| `/admin/ocorrencias` | Ocorrencias | admin+, teacher | 10 |
| `/admin/autorizacoes` | Autorizacoes | admin+ | 10 |
| `/admin/secretaria/declaracoes` | Declaracoes | admin+ | 11 |
| `/admin/secretaria/saude` | Fichas de Saude | admin+ | 11 |
| `/admin/rematricula` | Campanhas de Rematricula | super_admin, admin | 11 |
| `/admin/secretaria/transferencias` | Transferencias | admin+ | 11 |
| `/admin/diario` | Diario / Plano de Aula | admin+, teacher | 12 |
| `/admin/objetivos` | Objetivos de Aprendizagem | admin+, coordinator | 12 |

### 9.6 Portal do Responsavel — Rotas Planejadas (13 rotas — Fase 10)

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/responsavel/login` | LoginPage | Login CPF + senha |
| `/responsavel` | DashboardPage | Resumo por filho selecionado |
| `/responsavel/notas` | BoletimPage | Notas + medias + resultado por disciplina |
| `/responsavel/frequencia` | FrequenciaPage | Presencas/faltas por dia e disciplina + % |
| `/responsavel/financeiro` | FinanceiroPage | Parcelas, boletos, historico de pagamentos |
| `/responsavel/comunicados` | ComunicadosPage | Todos os comunicados do filho |
| `/responsavel/eventos` | EventosPage | Com RSVP (confirmar presenca do filho) |
| `/responsavel/grade` | GradeHorariaPage | Horario semanal de aulas |
| `/responsavel/ocorrencias` | OcorrenciasPage | Bilhetes enviados pela escola + respostas |
| `/responsavel/autorizacoes` | AutorizacoesPage | Autorizar/negar atividades |
| `/responsavel/declaracoes` | DeclaracoesPage | Solicitar declaracoes (Fase 11) |
| `/responsavel/rematricula` | RematriculaPage | Rematricula online (Fase 11) |
| `/responsavel/perfil` | PerfilPage | Dados pessoais, troca de senha, dados do filho |
| `/responsavel/biblioteca` | BibliotecaPage | Materiais da turma |

### 9.7 Portal do Aluno — Rotas Planejadas (3 novas)

| Rota | Pagina | Fase |
|------|--------|------|
| `/portal/financeiro` | FinanceiroPage | 8 |
| `/portal/grade` | GradeHorariaPage | 9 |
| `/portal/diario` | DiarioPage (read-only) | 12 |

---

## 10. Roadmap de Desenvolvimento

### 10.1 Visao Geral das Fases

| Fase | Nome | Status | Prioridade | Dependencias |
|------|------|--------|------------|--------------|
| 1-5 | Fundacao (site, admin, portal, atendimento, CRM) | ✅ Concluido | — | — |
| 6 | Governanca e Escala (permissoes, modulos, audit) | ✅ Concluido | — | 1-5 |
| 7 | Whitelabel (personalizacao total, multi-tenant) | ✅ Concluido | — | 6 |
| 8 | Modulo Financeiro | ⏳ Pendente | Critica | 7 |
| 9 | Academico Completo | ⏳ Pendente | Critica | 7 |
| 10 | Portal do Responsavel | ⏳ Pendente | Critica | 8 + 9 |
| 11 | Secretaria Digital | ⏳ Pendente | Alta | 10 |
| 12 | Modulo Pedagogico | ⏳ Pendente | Media | 9 |
| 13 | IA e Analytics | ⏳ Pendente | Media | 8 + 9 + 10 |

**Dependencias**: Fases 8 e 9 podem ser desenvolvidas em paralelo. Fase 10 depende de ambas. Fase 11 depende de 10. Fase 12 depende de 9. Fase 13 depende de 8+9+10 (dados suficientes para insights).

**Pre-requisitos transversais** (antes das fases 8-12):
- Renomear tabela `attendance` → `student_attendance` para disambiguar da fila presencial (`attendance_tickets`)
- Criar tabela `student_guardians` (N:N) como fonte unica de verdade para responsaveis, substituindo campos `guardian_*` e `financial_guardian_*` de `students`
- Adicionar `testimonials` ao seed da tabela `modules` (ausente na migration 26)

---

### 10.2 Fases Concluidas (6-7)

#### Fase 6 — Governanca e Escala

| Item | Descricao | Status |
|------|-----------|--------|
| **F6.1 Permissoes Granulares** | Tabelas `role_permissions` e `user_permission_overrides`; grid modulo x acao por role; override por usuario; preview de permissoes efetivas | ✅ Concluido (migration 26, PermissionsContext, PermissionsPage, PermissionGate) |
| **F6.2 Gerenciamento de Modulos** | Interface on/off para modulos; mapa de dependencias; ocultar menu/bloquear rotas ao desabilitar | ✅ Concluido (PermissionsPage aba Modulos, ModuleGuard, depends_on) |
| **F6.3 Audit Logs Centralizados** | Tabela `audit_logs` unificada (usuario, acao, modulo, old/new data, IP, user-agent); interface de consulta; retencao configuravel | ✅ Concluido (migration 27, logAudit em 10+ paginas, AuditLogsPage) |
| **F6.4 Documentacao Tecnica** | API docs, guia de onboarding, runbook operacional, manual do usuario | ⏳ Ultima etapa — sera feita ao final da v1 |

#### Fase 7 — Whitelabel: Personalizacao Total

Tornar o app inteiramente configuravel pelo admin, sem necessidade de alterar codigo. Qualquer instituicao de ensino pode usar o sistema com sua propria identidade visual, textos, menus e branding.

Todas as 11 etapas concluidas: BrandingContext com Realtime, useBranding() hook, useSEO() hook, favicon dinamico, SEO admin panel, 5 categorias de settings (appearance, branding, navigation, content, seo), site_presets com save/restore. Migracao de ~78 arquivos de valores hardcoded para CSS variables e config-driven.

| Etapa | Status |
|-------|--------|
| CSS Variables (substituicao de cores hardcoded em ~78 arquivos) | ✅ Concluido |
| BrandingProvider (context + hook + Realtime) | ✅ Concluido |
| Navbar dinamica (menu de `navigation.navbar`) | ✅ Concluido |
| Footer dinamico (colunas de `navigation.footer`) | ✅ Concluido |
| TopBar dinamica (URLs sociais de `navigation.topbar`) | ✅ Concluido |
| Home content (features, infrastructure, stats de `content.home`) | ✅ Concluido |
| Segment pages (pilares, diferenciais de `content.segment_pages`) | ✅ Concluido |
| Admin branding (LoginPage, Sidebar, Header de `branding.*`) | ✅ Concluido |
| SEO dinamico (useSEO em 12 paginas, SEOSettingsPanel, favicon dinamico) | ✅ Concluido |
| Config UI (BrandingSettingsPanel, NavigationSettingsPanel, ContentSettingsPanel, SEOSettingsPanel) | ✅ Concluido |
| Seed defaults (site_presets com preset base) | ✅ Concluido |

#### Multi-Tenancy: Upstream + Client Repos

Implementado em 12 de abril de 2026. Detalhes na secao 2.3.

| Item | Status |
|------|--------|
| Genericizacao do codigo (remocao de dados hardcoded em 37+ arquivos) | ✅ Concluido |
| `src/config/client.ts` (defaults com env vars) | ✅ Concluido |
| `.env.example` (template para novos clientes) | ✅ Concluido |
| Repo base `systemieven/school-platform` | ✅ Concluido |
| Upstream remote configurado | ✅ Concluido |
| Propagacao automatica (`.github/workflows/propagate.yml`) | ✅ Concluido |
| Sync manual (`.github/workflows/sync-upstream.yml`) | ✅ Concluido |
| Scripts de onboarding (`new-client.sh`, `push-migrations.sh`, `deploy-functions.sh`) | ✅ Concluido |

---

### 10.3 Fase 8 — Modulo Financeiro

**Objetivo**: Gerenciar mensalidades, cobrancas, inadimplencia e BI financeiro de forma integrada ao aluno ja matriculado. Inclui regua de cobranca WhatsApp automatica e integracao multi-gateway.

**Dependencias**: Fase 7 (multi-tenant consolidado)

#### 8.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Planos de Mensalidade | CRUD com valor, parcelas, vencimento, juros, multa, desconto pontualidade; por segmento/ano letivo | Alta |
| Contratos Financeiros | Vincula aluno + plano + ano letivo; desconto individual; geracao automatica de parcelas ao ativar; pipeline draft → active → suspended → cancelled → concluded | Alta |
| Parcelas e Cobrancas | Listagem com filtros; status pipeline; registro de pagamento manual; negociacao de divida; acoes em lote; calculo automatico de juros | Alta |
| Dashboard Financeiro (BI) | Receita prevista/realizada, inadimplencia R$/%/, ticket medio, alunos em dia/inadimplentes; graficos de evolucao, distribuicao, aging, top 10 | Alta |
| Regua de Cobranca WhatsApp | Gatilhos temporais (D-5, D-1, D+0, D+3, D+10, D+30) com templates configuraveis; pg_cron + financial-notify; destinatario = responsavel financeiro | Alta |
| Relatorios Financeiros | Extrato por aluno, receita mensal, inadimplencia, fluxo de caixa, projecao, contratos por status; export PDF/CSV/XLSX | Media |
| Portal do Aluno — Financeiro | `/portal/financeiro`: lista de parcelas, status visual, botao ver boleto/copiar PIX | Media |
| Gateway de Pagamento | Integracao multi-gateway (ver secao 8.7); modulo opcional, modo manual sempre disponivel | Media |

#### 8.2 Tabelas

| Tabela | Campos-chave | Migration |
|--------|-------------|-----------|
| `financial_plans` | name, amount, installments, due_day, segment_ids, school_year | 28 |
| `financial_contracts` | student_id, plan_id, school_year, status, discount_*, gateway_id | 28 |
| `financial_installments` | contract_id, installment_number, due_date, amount, status, paid_*, provider_charge_id, boleto_url, pix_code | 28 |
| `financial_notification_log` | installment_id, trigger_type, sent_at, whatsapp_message_id | 28 |
| `payment_gateways` | provider, label, credentials (enc), webhook_secret, supported_methods | 28 |
| `gateway_customers` | gateway_id, student_id, provider_customer_id | 28 |
| `gateway_webhook_log` | gateway_id, event_type, provider_charge_id, normalized, raw | 28 |

#### 8.3 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `financial-notify` | Trigger (pg_cron) | Regua de cobranca automatica |
| `payment-gateway-proxy` | JWT (admin+) | Proxy multi-gateway com GatewayRouter |
| `payment-gateway-webhook` | Secret URL param | Recebe webhooks de qualquer gateway; normaliza; atualiza installments |

#### 8.4 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/financeiro` | Dashboard Financeiro |
| `/admin/financeiro/planos` | Planos de Mensalidade |
| `/admin/financeiro/contratos` | Contratos |
| `/admin/financeiro/cobrancas` | Parcelas / Cobrancas |

#### 8.5 Rotas Portal

| Rota | Portal | Descricao |
|------|--------|-----------|
| `/portal/financeiro` | Aluno | Parcelas e pagamentos |

#### 8.6 WhatsApp

**Nova categoria**: `financeiro` (cor: `#14532d` verde escuro)

**Regua de cobranca completa**:

| Gatilho | Timing | Descricao |
|---------|--------|-----------|
| Aviso pre-vencimento | D-5 | Valor + data de vencimento |
| Lembrete vespera | D-1 | Valor atualizado + PIX/boleto |
| Dia do vencimento | D+0 | Regularizar para evitar juros |
| Primeiro aviso atraso | D+3 | Valor atualizado |
| Segundo aviso atraso | D+10 | Dias de atraso + valor com juros |
| Ultimo aviso | D+30 | Aviso final |
| Pagamento confirmado | — | Confirmacao automatica via webhook |

**Variaveis financeiras**: `{{nome_aluno}}`, `{{responsavel}}`, `{{turma}}`, `{{mes_referencia}}`, `{{valor}}`, `{{valor_atualizado}}`, `{{data_vencimento}}`, `{{dias_atraso}}`, `{{chave_pix}}`, `{{link_boleto}}`, `{{link_portal}}`

#### 8.7 Gateway de Pagamento

Subsistema de integracao multi-gateway dentro do modulo financeiro. Cada escola pode ter mais de um gateway ativo simultaneamente. Modo manual sempre disponivel.

##### Arquitetura — Adapter Pattern

O sistema nao fala diretamente com nenhum gateway. Toda operacao passa por uma camada de adaptadores que normaliza a API de cada provedor para um contrato interno comum. O modulo financeiro emite um `ChargeRequest` e recebe um `GatewayCharge`.

```
FinancialModule (React)
    │  ChargeRequest (gateway-agnostic)
    ▼
Edge Function: payment-gateway-proxy
    │  Le payment_gateways → seleciona adapter
    ▼
GatewayRouter → switch(provider)
    │
    ├─ AsaasAdapter
    ├─ EfiAdapter
    ├─ IuguAdapter
    ├─ PagarmeAdapter
    ├─ ManualAdapter
    └─ ...
    │
    ▼
GatewayCharge (normalizado)
```

##### Provider Roadmap

| Versao | Gateways | Notas |
|--------|----------|-------|
| V1 (lancamento) | Manual + Asaas | API acessivel; conta PJ integrada |
| V2 (3 meses) | Efi, Iugu, Pagar.me, Sicredi | mTLS para Efi/Sicredi PIX |
| V3 (6 meses) | Vindi, PagSeguro, Mercado Pago | Sob demanda |

##### Tabelas

| Tabela | Descricao |
|--------|-----------|
| `payment_gateways` | Gateways configurados por tenant: provider, credentials (JSONB enc), webhook_secret, supported_methods, is_default, environment |
| `gateway_customers` | Cache de clientes no gateway: gateway_id, student_id, provider_customer_id |
| `gateway_webhook_log` | Log de eventos de webhook: normalized (NormalizedWebhookEvent), raw payload |

##### Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `payment-gateway-proxy` | JWT (admin+) | Actions: create_customer, create_charge, cancel_charge, get_charge, refresh_charge, ping |
| `payment-gateway-webhook` | Secret URL param, 120/min, verify_jwt=false | Normaliza webhooks de qualquer provider; idempotente via gateway_webhook_log |

##### Seguranca — Criptografia de Credenciais

**2 camadas de protecao**:

1. **RLS**: tabela `payment_gateways` acessivel apenas por super_admin e admin
2. **AES-256-CBC**: campo `credentials` criptografado antes de salvar, descriptografado apenas dentro de Edge Functions

```typescript
// Formato: "enc:{iv_hex}:{encrypted_hex}"
// Chave: GATEWAY_ENCRYPTION_KEY (Supabase secret, 32 bytes hex)
// Secret: supabase secrets set GATEWAY_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

O frontend nunca recebe valores de campos `secret`, o campo `credentials` completo, nem o `webhook_secret` apos criacao.

##### Admin UI — Wizard de 4 Etapas

1. **Selecao do provedor**: grid de cards com logo/nome/descricao; badge V1/V2
2. **Formulario de credenciais**: campos gerados dinamicamente de `GATEWAY_CREDENTIAL_SCHEMAS[provider]`; campos `secret` exibem `••••••` apos salvar
3. **Configuracoes adicionais**: label, ambiente (producao/sandbox), metodos suportados, toggle padrao
4. **Teste de conexao**: ping → ✅ Conectado / erro; salvar habilitado apos teste

Apos salvar: URL de webhook exibida com botao "Copiar URL" + instrucoes.

##### TypeScript Interfaces (Resumo)

```typescript
interface ChargeRequest {
  external_ref: string          // installment_id
  customer_external_id: string  // ID do cliente no gateway
  amount_cents: number
  due_date: string              // YYYY-MM-DD
  description: string
  payment_methods: Array<'boleto' | 'pix' | 'credit_card' | 'debit_card'>
  interest_rate_pct?: number
  late_fee_pct?: number
  discount?: { type: 'fixed' | 'percentage'; value: number; deadline_days?: number }
  metadata?: Record<string, string>
}

interface GatewayCharge {
  provider_id: string
  external_ref: string          // installment_id de volta
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'failed'
  boleto_url?: string
  pix_code?: string
  payment_link?: string
  due_date: string
  amount_cents: number
}

interface GatewayAdapter {
  createCustomer(data: GatewayCustomerData): Promise<GatewayCustomer>
  findCustomer(externalRef: string): Promise<GatewayCustomer | null>
  createCharge(charge: ChargeRequest): Promise<GatewayCharge>
  cancelCharge(providerChargeId: string): Promise<void>
  getCharge(providerChargeId: string): Promise<GatewayCharge>
  normalizeWebhook(rawPayload: unknown): NormalizedWebhookEvent
  ping(): Promise<{ ok: boolean; message?: string }>
}

interface NormalizedWebhookEvent {
  provider_charge_id: string
  installment_id: string
  event_type: 'payment_received' | 'payment_failed' | 'payment_refunded' | 'charge_cancelled' | 'overdue'
  status: GatewayChargeStatus
  paid_at?: string
  paid_amount_cents?: number
  payment_method?: string
  gateway_fee_cents?: number
  raw: unknown
}
```

##### Fluxos de Integracao

1. **Ativar contrato**: Admin ativa contrato → seleciona gateway → createCustomer (se novo) → createCharge para cada parcela → salva provider_charge_id, boleto_url, pix_code
2. **Pagamento confirmado (webhook)**: Gateway POST → payment-gateway-webhook → valida secret → normalizeWebhook → salva em gateway_webhook_log → atualiza installment (paid) → dispara auto-notify "pagamento-confirmado"
3. **Regua de cobranca (pg_cron)**: Diariamente as 08:00 → seleciona parcelas elegiveis → calcula etapa da regua → verifica financial_notification_log → envia via financial-notify
4. **Reenvio manual**: Admin clica "Reenviar" → getCharge (sincroniza status) → reenvia notificacao WhatsApp → retorna links atualizados
5. **Cancelamento**: Admin cancela parcela → cancelCharge no gateway (se existe) → status = cancelled

##### Modo Manual

Adapter que nao faz chamadas externas. `createCharge()` retorna status pending sem links de pagamento. Baixa feita manualmente pelo admin (data, valor, forma de pagamento, observacao). Nenhum gateway e obrigatorio.

#### 8.8 Settings — Adicoes

| Aba | Card/Sub-aba | Descricao |
|-----|-------------|-----------|
| Financeiro | Gateways | Listagem de gateways configurados; wizard de adicao/edicao |
| Financeiro | Regua de Cobranca | Toggle por etapa (D-5..D+30); seletor de template; preview |
| Financeiro | Chave PIX | Tipo + chave para templates WhatsApp |

#### 8.9 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `students` | Campos financial_guardian_*; visibilidade financeira na ficha |
| `school_classes` | Filtros de cobranca por turma |
| `enrollments` | Ao confirmar pre-matricula → sugerir criacao de contrato |
| `whatsapp_templates` | Nova categoria `financeiro`; regua usa `auto-notify` existente |
| `notifications` | Alerta: aluno inadimplente ha +30d; receita abaixo de meta |
| Dashboard `/admin` | Card "Inadimplencia do mes" + "Receita realizada" |
| `audit_logs` | Todos os pagamentos registrados |

#### 8.10 Prioridade de Desenvolvimento Interna

1. Schema + migrations financeiras
2. Planos + contratos (admin)
3. Geracao de parcelas (automatica ao ativar contrato)
4. Tela de cobrancas + baixa manual
5. Dashboard financeiro (BI)
6. Regua de cobranca WhatsApp
7. `/portal/financeiro` (Portal do Aluno)
8. Integracao com gateway (Asaas) — ultima subetapa, ativavel como modulo

---

### 10.4 Fase 9 — Academico Completo

**Objetivo**: Completar o modulo academico com disciplinas, grade horaria, calendario letivo, boletim formal com formula configuravel, resultado final e historico escolar.

**Dependencias**: Fase 7 (pode ser desenvolvida em paralelo com Fase 8)

#### 9.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Disciplinas | CRUD com nome, codigo, carga horaria, cor, associacao por segmento, atribuicao turma+professor (class_disciplines) | Alta |
| Grade Horaria | Cadastro por turma: dia x horario x disciplina x professor; visualizacao em grade; conflito de professor; export PDF | Alta |
| Calendario Letivo | Periodos configuraveis (bimestres/trimestres/semestres); tipos de evento (holiday, exam_period, recess, deadline, institutional); visao mensal/anual | Alta |
| Boletim Formal | Formula de media configuravel por segmento (simples, ponderada, por periodo, customizada); nota minima aprovacao/recuperacao; frequencia minima; escala numerica ou conceitual | Alta |
| Resultado Final | Calculo automatico ao fechar periodo: aprovado/recuperacao/reprovado (nota)/reprovado (falta); tabela student_results | Alta |
| Alertas de Frequencia | Calculo de % por disciplina/periodo/ano; alerta WhatsApp ao responsavel ao atingir X% de faltas; painel de alunos em risco | Media |
| Historico Escolar | Registro automatico ao fechar ano letivo; visualizacao formal; export PDF; tabela student_transcripts | Media |

#### 9.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `disciplines` | 29 | Disciplinas escolares |
| `class_disciplines` | 29 | Disciplina por turma + professor |
| `class_schedules` | 29 | Grade horaria |
| `school_calendar_events` | 30 | Calendario letivo |
| `grade_formulas` | 30 | Formula de media por segmento/ano |
| `student_results` | 31 | Resultado final por aluno/disciplina/ano |
| `student_transcripts` | 31 | Historico escolar |

#### 9.3 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `calculate-grades` | JWT (admin+) | Calcula medias e resultado final por turma/periodo usando grade_formula |

#### 9.4 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/disciplinas` | CRUD de disciplinas |
| `/admin/grade-horaria` | Grade horaria por turma |
| `/admin/calendario` | Calendario letivo |
| `/admin/boletim` | Boletim formal — visao por turma, edicao, fechamento, PDF |

#### 9.5 Rotas Portal

| Rota | Portal | Descricao |
|------|--------|-----------|
| `/portal/grade` | Aluno | Grade horaria pessoal |
| `/portal/notas` | Aluno | Enriquecido com medias por periodo e media final |

#### 9.6 WhatsApp

**Nova categoria**: `academico` (cor: `#1e3a5f` azul escuro)

| Evento | Template | Gatilho |
|--------|---------|---------|
| Nota lancada (abaixo da media) | `nota-baixa` | `on_status_change` em grades |
| X% de faltas atingido | `alerta-faltas` | Cron diario + trigger |
| Resultado final disponivel | `resultado-final` | Ao fechar periodo letivo |
| Nova atividade criada | `nova-atividade` | `on_create` em activities |
| Atividade proxima do prazo | `prazo-atividade` | Cron: D-2 antes do due_date |

#### 9.7 Settings — Adicoes

| Aba | Card | Descricao |
|-----|------|-----------|
| Academico | Periodos Letivos | Tipo (bimestre/trimestre/semestre), datas |
| Academico | Formula de Media | Por segmento: tipo, pesos, nota minima, frequencia minima, escala |
| Academico | Alertas de Frequencia | Thresholds de % para disparo de alerta WhatsApp |

#### 9.8 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `activities` | `discipline_id` → FK para `disciplines` |
| `grades` | Conecta ao periodo letivo + formula de media |
| `attendance` | Conecta ao calendario letivo + calculo de % |
| `school_classes` | Adiciona `class_disciplines` como entidade |
| `students` | `student_results` + `student_transcripts` |
| Portal do Aluno | Grade horaria + calendario + boletim enriquecido |
| `school_events` | Integracao com calendario letivo |

---

### 10.5 Fase 10 — Portal do Responsavel

**Objetivo**: Criar um portal dedicado ao responsavel (pai/mae/guardiao), com autenticacao propria, acompanhamento completo do filho e canal de comunicacao escola-familia.

**Dependencias**: Fases 8 e 9 concluidas

#### 10.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Auth do Responsavel | CPF + codigo de acesso; GuardianAuthContext; multiplos filhos; seletor de filho | Alta |
| Dashboard | Cards de resumo por filho: atividades, notas, faltas, parcelas, comunicados, eventos | Alta |
| Visualizacao Academica | Boletim, frequencia, grade horaria (leitura) | Alta |
| Visualizacao Financeira | Parcelas, boletos, historico de pagamentos | Alta |
| Ocorrencias/Bilhetes | Canal estruturado escola-familia; tipos (behavioral, academic, health, administrative, commendation, absence_justification); fluxo open → read → resolved; resposta do responsavel | Alta |
| Autorizacoes | Criar autorizacao (admin); responsavel autoriza/nega; prazo; notificacao WhatsApp | Media |
| Comunicados + Eventos | Filtrados por filho (turma/segmento); RSVP pelo responsavel | Media |
| Biblioteca | Materiais da turma do filho | Baixa |

#### 10.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `guardian_profiles` | 32 | Perfis de responsaveis com student_ids[] |
| `student_occurrences` | 32 | Ocorrencias/bilhetes por aluno |
| `activity_authorizations` | 32 | Autorizacoes de atividades |
| `authorization_responses` | 32 | Respostas de autorizacao |

#### 10.3 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `create-guardian-user` | JWT (super_admin) | Cria usuario Auth + guardian_profiles |
| `occurrence-notify` | Trigger secret | Notifica responsavel via WhatsApp ao criar ocorrencia |

#### 10.4 Rotas

13 rotas no Portal do Responsavel — ver secao 9.6.

#### 10.5 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/ocorrencias` | CRUD de ocorrencias (teacher, admin+) |
| `/admin/autorizacoes` | CRUD de autorizacoes (admin+) |

#### 10.6 WhatsApp

**Novas categorias**: `ocorrencia` (cor: `#7c2d12` vermelho escuro), `responsavel` (cor: `#4c1d95` roxo)

| Evento | Destinatario | Template |
|--------|-------------|---------|
| Nova ocorrencia criada | Responsavel | `nova-ocorrencia` |
| Escola respondeu a resposta | Responsavel | `ocorrencia-atualizada` |
| Autorizacao solicitada | Responsavel | `nova-autorizacao` |
| Prazo de autorizacao proximo (D-1) | Responsavel | `autorizacao-prazo` |
| Senha temporaria do portal | Responsavel | `senha-portal-responsavel` |

---

### 10.6 Fase 11 — Secretaria Digital

**Objetivo**: Automatizar os processos de secretaria: geracao de declaracoes PDF, ficha de saude, rematricula online e transferencias.

**Dependencias**: Fase 10 concluida

#### 11.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Geracao de Declaracoes | Templates HTML configuraveis com variaveis; solicitacao pelo responsavel; fila de aprovacao; PDF via Edge Function; download por signed URL | Alta |
| Ficha de Saude | Alergias, medicamentos, necessidades especiais, info medica, emergencia, convenio; visivel apenas admin/coordinator | Alta |
| Rematricula Online | Campanha com periodo, desconto antecipado, plano padrao; fluxo: notificacao → confirmacao → assinatura → contrato gerado | Media |
| Transferencias | Interna (mudar turma), saida (declaracao), trancamento, cancelamento; impacto no financeiro (parcelas futuras canceladas) | Media |

#### 11.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `document_templates` | 33 | Templates de declaracao com HTML + variaveis |
| `document_requests` | 33 | Solicitacoes e status (pending → approved → generated → delivered) |
| `student_health_records` | 33 | Ficha de saude por aluno |
| `reenrollment_campaigns` | 33 | Campanhas de rematricula |
| `reenrollment_applications` | 33 | Processos individuais de rematricula |

#### 11.3 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `generate-document` | JWT (admin+) | Renderiza template HTML → PDF; salva em Storage |

#### 11.4 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/secretaria/declaracoes` | Templates + solicitacoes |
| `/admin/secretaria/saude` | Fichas de saude |
| `/admin/rematricula` | Campanhas |
| `/admin/secretaria/transferencias` | Transferencias e movimentacoes |

#### 11.5 Rotas Portal

| Rota | Portal | Descricao |
|------|--------|-----------|
| `/responsavel/declaracoes` | Responsavel | Solicitar declaracoes |
| `/responsavel/rematricula` | Responsavel | Rematricula online |

#### 11.6 WhatsApp

**Nova categoria**: `secretaria` (cor: `#374151` cinza)

| Evento | Destinatario | Template |
|--------|-------------|---------|
| Campanha de rematricula aberta | Responsaveis elegiveis | `rematricula-aberta` |
| Prazo de rematricula em 7 dias | Nao rematriculados | `rematricula-prazo` |
| Rematricula confirmada | Responsavel | `rematricula-confirmada` |
| Declaracao pronta para download | Responsavel | `declaracao-pronta` |

---

### 10.7 Fase 12 — Modulo Pedagogico

**Objetivo**: Dotar professores e coordenadores de ferramentas para planejamento, registro de conteudo e analise pedagogica.

**Dependencias**: Fase 9 concluida

#### 12.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Plano de Aula / Diario | Registro por aula: turma + disciplina + conteudo + metodologia + recursos + atividades + observacoes + frequencia; status planned → completed/cancelled; visualizacao em calendario | Alta |
| Objetivos de Aprendizagem | CRUD por disciplina + segmento; referencia BNCC opcional; associacao ao plano de aula (N:N); relatorio de cobertura | Media |
| Relatorios Pedagogicos | Desempenho por turma, alunos em risco, cobertura do curriculo, evolucao individual, analise comparativa, aulas registradas | Media |

#### 12.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `lesson_plans` | 34 | Diario de classe / plano de aula |
| `learning_objectives` | 34 | Objetivos de aprendizagem com BNCC |
| `lesson_plan_objectives` | 34 | N:N plano x objetivos |

#### 12.3 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/diario` | Diario / plano de aula (teacher, admin+) |
| `/admin/objetivos` | Objetivos de aprendizagem (coordinator, admin+) |

#### 12.4 Rotas Portal

| Rota | Portal | Descricao |
|------|--------|-----------|
| `/portal/diario` | Aluno | Conteudo das aulas (read-only) |

#### 12.5 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `activities` | Vinculadas ao plano de aula |
| `student_attendance` | Registrada junto com o diario (via lesson_plan_id) |
| `grades` | Metricas pedagogicas nos relatorios |
| `library_resources` | Recursos utilizados na aula |

---

### 10.8 Fase 13 — IA e Analytics

**Objetivo**: Criar agentes de IA que analisam dados do sistema e geram insights acionaveis para alunos, professores e administradores. Transformar dados brutos em recomendacoes inteligentes.

**Dependencias**: Fases 8, 9 e 10 concluidas (dados suficientes para analise)

#### 13.1 Arquitetura

Agentes de IA como Edge Functions que consomem dados do Supabase e geram insights via Claude API (Anthropic Messages API). Resultados cacheados em tabela `ai_insights` por 24h.

#### 13.2 Tabelas

| Tabela | Campos-chave | Descricao |
|--------|-------------|-----------|
| `ai_insights` | module (financial/academic/pedagogic/admin), insight_type, target_type (student/class/segment/school), target_id, title, body (markdown), priority (info/warning/action), metadata (JSONB), generated_at, expires_at, dismissed_by[] | Insights gerados por IA |

#### 13.3 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `ai-insights` | JWT (admin+) | Gera insights por modulo; busca dados → prompt → Claude API → parseia → salva em ai_insights |

#### 13.4 Agentes

**Agente Academico (Portal do Aluno)**: Analisa `grades`, `activities`, `student_results`, `student_attendance` → recomendacoes de estudo personalizadas. Ex: "Voce esta 1.2 pontos abaixo da media em Matematica. Foque em [topico X]".

**Agente Pedagogico (Dashboard Professor)**: Analisa desempenho da turma, cobertura de objetivos BNCC, frequencia. Ex: "A turma 7A tem media 5.8 em Matematica — 35% abaixo das demais turmas do segmento".

**Agente Administrativo (Dashboard Admin)**: Analisa KPIs financeiros, academicos e operacionais. Ex: "Inadimplencia subiu de 8% para 12%. 65% dos inadimplentes sao do Fundamental II".

#### 13.5 Privacidade

- Toggle por escola: `system_settings.ai.enabled`
- Dados anonimizados antes de enviar para LLM externo
- Opcao de LLM local (Ollama) para escolas com restricoes
- Logs de uso em `audit_logs`
- Custo estimado: ~$0.01-0.05 por analise (Claude Haiku)

#### 13.6 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| Dashboard Admin | Card "Insights IA" com botao "Executar analise" |
| Portal do Aluno | Card "Dicas de Estudo" no dashboard |
| Portal do Professor | Painel de recomendacoes pedagogicas semanais |
| WhatsApp | Possibilidade de enviar insights criticos via template |

---

### 10.10 Melhorias Transversais

| Item | Descricao | Prioridade | Status |
|------|-----------|------------|--------|
| **Atendimento como Hub Operacional** | AttendanceQuickActions: acoes contextuais no drawer de atendimento (2a via boleto, ver matricula, gerar declaracao, agendar retorno, enviar WhatsApp) baseadas no `visitor_phone` | Alta | ⏳ Pendente |
| **MessageOrchestrator** | Servico central de comunicacao WhatsApp com deduplicacao inteligente (nao enviar 2+ mensagens em <30min) e priorizacao entre modulos | Alta | ⏳ Pendente |
| **Pipeline enrollment→student→contract** | Automacao: enrollment confirmada → cria student → sugere contrato financeiro → gera parcelas → ativa regua | Media | ⏳ Pendente |
| **Portal do Professor dedicado** | `/professor/*` com interface focada (10 rotas): dashboard, turmas, diario, notas, atividades, ocorrencias, comunicados, biblioteca, perfil | Media | ⏳ Pendente |
| **2FA real via WhatsApp** | Geracao/verificacao de OTP com time-window; hoje so existe scaffold de categoria | Baixa | ⏳ Pendente |
| **Relatorios agendados** | Envio periodico por e-mail (mensal/trimestral) | Baixa | ⏳ Pendente |
| **OAuth para depoimentos** | Google e Facebook providers no Supabase Auth | Baixa | ⏳ Pendente |
| **Mascaramento de dados** | CPF e telefone parcial para roles restritas | Baixa | ⏳ Pendente |
| **Biblioteca Virtual publica** | Rota `/biblioteca-virtual` no site — decidir se migra para /portal/biblioteca | Baixa | ⏳ Pendente |

---

### 10.11 F6.4 Documentacao Tecnica

**Status**: ⏳ Pendente — ultima etapa antes do encerramento da v1

| Entregavel | Descricao |
|-----------|-----------|
| API docs | Documentacao de todas as Edge Functions (endpoints, payloads, respostas) |
| Guia de onboarding | Passo a passo para novos clientes (setup Supabase, deploy, configuracao) |
| Runbook operacional | Procedimentos de manutencao, backup, monitoramento |
| Manual do usuario | Guia para admin, professor, aluno, responsavel |

---

## 11. Requisitos Nao Funcionais

### Performance
- Paginacao server-side para listagens
- Realtime via Supabase channels para notificacoes e filas
- Code-splitting: Admin e Portal carregados sob demanda
- Compressao de imagens no upload

### Seguranca
- RLS em todas as tabelas
- Edge Functions como proxy para APIs externas (UazAPI, Google Maps, gateways de pagamento)
- Politica de senha configuravel com historico
- Tokens JWT com refresh automatico
- Dados sensiveis nunca expostos ao client (API keys em secrets do Supabase)
- Credenciais de gateways criptografadas com AES-256-CBC (2 camadas: RLS + criptografia)
- Secret GATEWAY_ENCRYPTION_KEY em Supabase Vault
- Campos `secret` de credenciais nunca retornados ao frontend

### Geracao de Documentos
- PDF gerado via Edge Function `generate-document`
- Templates HTML com variaveis configuraveis pelo admin
- Armazenamento em Supabase Storage com signed URL (expiracao configuravel)
- Tipos: declaracao de matricula, frequencia, transferencia, historico escolar, conclusao

### Gateway de Pagamento
- Abstração total via GatewayAdapter interface
- Multi-gateway por tenant (multiplos gateways ativos simultaneamente)
- Modo manual sempre disponivel (nenhum gateway obrigatorio)
- Webhook normalizado com idempotencia via gateway_webhook_log
- Provider roadmap: V1 (Manual+Asaas), V2 (+Efi/Iugu/Pagar.me/Sicredi), V3 (+Vindi/PagSeguro/MercadoPago)

### UX/UI
- Design system: navy (#003876), gold (#ffd700), Playfair Display, Inter
- Responsivo (desktop-first para admin)
- Loading/empty/error states em todos os componentes
- Dark mode suportado
- Confirmacao para acoes destrutivas
- Cards recolhiveis com estado persistente nas configuracoes
- Componente padronizado `SettingsCard` (head+body)

### Observabilidade
- Tabelas de historico por modulo (appointment_history, enrollment_history, contact_history, attendance_history)
- Log completo de mensagens WhatsApp com status de entrega
- Metricas no dashboard (tendencias, alertas)
- Audit logs centralizados (audit_logs) com retencao configuravel
- Gateway webhook log com payload bruto preservado

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
| Senha | Numero de atendimento na fila presencial |
| Walk-in | Visitante sem agendamento previo |
| Setor | Area de atendimento derivada do motivo de visita |
| Parcela | Pagamento individual de uma mensalidade (installment) |
| Boleto | Documento bancario de cobranca registrado (barcode + PIX) |
| Gateway | Provedor de pagamento integrado (Asaas, Efi, etc.) |
| Regua de cobranca | Sequencia de notificacoes automaticas por timing de vencimento |
| Disciplina | Materia escolar (ex: Matematica, Portugues) |
| Boletim | Relatorio de notas do aluno por periodo letivo |
| Ocorrencia | Registro escolar (comportamental, academico, saude, elogio) |
| Responsavel | Pai, mae ou guardiao legal do aluno |
| Rematricula | Renovacao de matricula para o proximo ano letivo |
| Declaracao | Documento oficial gerado pela secretaria (PDF) |
| Plano de aula | Registro de conteudo ministrado por aula (diario de classe) |
| BNCC | Base Nacional Comum Curricular — referencia para objetivos de aprendizagem |
| Periodo letivo | Divisao do ano escolar (bimestre, trimestre, semestre) |
| Resultado final | Status do aluno ao final do ano: aprovado, recuperacao, reprovado |
| Historico escolar | Registro cumulativo de desempenho do aluno por ano letivo |

### B. Integracao UazAPI

- **Documentacao**: https://docs.uazapi.com
- **Autenticacao**: Bearer token no header (via Edge Function `uazapi-proxy`)
- **Webhook**: recebe status via `uazapi-webhook` com validacao por secret
- **Funcionalidades**: envio de texto, midia, botoes, listas; verificacao de numero; status de entrega

### C. Repositorios

- **Repo base**: `systemieven/school-platform` — codigo generico, sem dados de cliente
- **Primeiro cliente**: `systemieven/batista-site` — upstream → school-platform, origin → batista-site
- **Branch principal**: `main` (em ambos)
- **Areas do app**: site (`/`), admin (`/admin`), portal (`/portal`), atendimento (`/atendimento`), responsavel (`/responsavel` — planejado)
- **Propagacao**: push em school-platform abre PR automaticamente nos clientes
- **Push local**: `git push upstream main && git push origin main`

### D. Credenciais Supabase

- **Project ID**: `dinbwugbwnkrzljuocbs`
- **Project URL**: `https://dinbwugbwnkrzljuocbs.supabase.co`
- **Anon Key**: `sb_publishable_XQXGJDPXCEsMkk_xr6ok7A_xw9ZK6WQ`

### E. Gateway Providers — Comparativo de Capabilities

| Capacidade | Asaas | Efi | Iugu | Vindi | Pagar.me | PagSeguro | Mercado Pago | Sicredi |
|------------|:-----:|:---:|:----:|:-----:|:--------:|:---------:|:------------:|:-------:|
| Boleto registrado | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| PIX dinamico | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Cartao recorrente | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Nao |
| Boleto + PIX hibrido | Sim | Sim | Sim | Nao | Nao | Nao | Nao | Sim |
| Webhook de confirmacao | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Sandbox/teste | Sim | Sim | Sim | Sim | Sim | Sim | Sim | Sim |
| Regua nativa | Sim | Nao | Nao | Sim | Nao | Nao | Nao | Nao |
| NF-e integrada | Sim | Nao | Nao | Nao | Nao | Nao | Nao | Nao |
| Split de pagamento | Nao | Nao | Sim | Nao | Sim | Nao | Sim | Nao |
| Conta digital integrada | Sim | Sim | Nao | Nao | Nao | Sim | Sim | Sim |
| mTLS obrigatorio (PIX) | Nao | Sim | Nao | Nao | Nao | Nao | Nao | Sim |
| Complexidade de integracao | Baixa | Media | Media | Media | Media | Baixa | Baixa | Alta |
| Perfil de uso escolar | Escolas medias; edtech | Escolas menores; cooperativas | Edtech SaaS; redes | Assinaturas; franquias | Redes maiores; marketplace | Operacao presencial | Ecosistema ML | Cooperativas; Sul/CO |

**Notas**:
- Asaas e Vindi tem regua de cobranca propria. Toggle configuravel em settings para desativar a regua interna e usar a do gateway.
- Efi e Sicredi exigem certificado mTLS para PIX. A Edge Function suporta mTLS nativo via `Deno.createHttpClient`.

### F. WhatsApp Template Categories (Completo)

| Categoria | Cor | Modulo | Status |
|-----------|-----|--------|--------|
| `agendamento` | `#1e40af` (azul) | Agendamentos de visita | ✅ Implementado |
| `matricula` | `#065f46` (verde) | Pre-matriculas | ✅ Implementado |
| `contato` | `#92400e` (laranja) | Contatos do site | ✅ Implementado |
| `geral` | `#374151` (cinza) | Comunicados gerais | ✅ Implementado |
| `boas_vindas` | `#7c3aed` (roxo) | Boas-vindas ao portal | ✅ Implementado |
| `2fa` | `#be185d` (rosa) | Senhas temporarias (scaffold, sem OTP real) | ✅ Implementado |
| `financeiro` | `#14532d` (verde escuro) | Cobrancas, inadimplencia, pagamento confirmado | ⏳ Fase 8 |
| `academico` | `#1e3a5f` (azul escuro) | Notas, faltas, resultado final, atividades | ⏳ Fase 9 |
| `ocorrencia` | `#7c2d12` (vermelho escuro) | Bilhetes/ocorrencias escolares | ⏳ Fase 10 |
| `responsavel` | `#4c1d95` (roxo escuro) | Portal do responsavel, senha temporaria | ⏳ Fase 10 |
| `secretaria` | `#374151` (cinza) | Declaracoes, rematricula | ⏳ Fase 11 |
