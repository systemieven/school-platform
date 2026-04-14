# PRD v2 — Plataforma Escolar (school-platform)

> **Versao**: 2.1
> **Data**: 13 de abril de 2026
> **Baseado em**: PRD v1 (07/04/2026) — `docs/PRD_BACKEND_V1.md`
> **Status**: Documento de referencia — descreve o estado real do sistema
> **Arquitetura**: Multi-tenant via upstream/client repos (ver secao 2.4)

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura e Stack](#2-arquitetura-e-stack)
3. [Sistema de Autenticacao e Roles](#3-sistema-de-autenticacao-e-roles)
4. [Modulos Implementados](#4-modulos-implementados)
5. [Painel de Configuracoes](#5-painel-de-configuracoes)
6. [Aparencia e Site Institucional](#6-aparencia-e-site-institucional)
7. [Schema do Banco de Dados](#7-schema-do-banco-de-dados)
8. [Edge Functions](#8-edge-functions)
9. [Rotas e Navegacao](#9-rotas-e-navegacao)
10. [Pendencias e Roadmap Futuro](#10-pendencias-e-roadmap-futuro)
    - 10.1 Fase 6 — Governanca e Escala
    - 10.2 Fase 7 — Whitelabel: Personalizacao Total
    - 10.3 Multi-Tenancy: Upstream + Client Repos
    - 10.4 Melhorias Adicionais
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

### 3.3 Hierarquia de Roles

```
Super Admin
  └── Admin
        ├── Coordenador (por segmento)
        │     ├── Professor (por turma)
        │     └── Aluno (por turma)
        └── User (permissoes customizadas)
```

### 3.4 Status de 2FA

**Nao implementado.** Existe categoria `2fa` nos templates WhatsApp (migration 0013), mas nao ha logica de geracao/verificacao de codigos OTP. Os templates dessa categoria sao usados para envio de senhas temporarias, nao para autenticacao de dois fatores.

---

## 4. Modulos Implementados

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

### 7.1 Tabelas

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
| `attendance` | Frequencia diaria (present/absent/justified/late) |

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

### 7.3 Migrations (26)

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

---

## 8. Edge Functions

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

### 9.3 Admin (17 rotas)

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

### 9.4 Portal do Aluno (8 rotas)

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

---

## 10. Pendencias e Roadmap Futuro

### 10.1 Fase 6 — Governanca e Escala (CONCLUIDA — exceto F6.4)

| Item | Descricao | Prioridade | Status |
|------|-----------|------------|--------|
| **F6.1 Permissoes Granulares** | Tabelas `role_permissions` e `user_permission_overrides`; grid modulo x acao por role; override por usuario; preview de permissoes efetivas | Alta | ✅ Concluido (migration 26, PermissionsContext, PermissionsPage, PermissionGate) |
| **F6.2 Gerenciamento de Modulos** | Interface on/off para modulos; mapa de dependencias; ocultar menu/bloquear rotas ao desabilitar | Media | ✅ Concluido (PermissionsPage aba Modulos, ModuleGuard, depends_on) |
| **F6.3 Audit Logs Centralizados** | Tabela `audit_logs` unificada (usuario, acao, modulo, old/new data, IP, user-agent); interface de consulta; retencao configuravel | Media | ✅ Concluido (migration 27, logAudit em 10+ paginas, AuditLogsPage) |
| **F6.4 Documentacao Tecnica** | API docs, guia de onboarding, runbook operacional, manual do usuario | Baixa | ⏳ Pendente |

### 10.2 Fase 7 — Whitelabel: Personalizacao Total (CONCLUIDA)

**Objetivo**: Tornar o app inteiramente configuravel pelo admin, sem necessidade de alterar codigo. Qualquer instituicao de ensino pode usar o sistema com sua propria identidade visual, textos, menus e branding — mantendo a consistencia de UI/UX consolidada.

**Principio**: Toda alteracao visual e textual deve fluir de `system_settings` → CSS variables / React context → componentes. Nenhum valor de marca deve permanecer hardcoded.

**Status**: ✅ Todas as 11 etapas concluidas. BrandingContext com Realtime, useBranding() hook, useSEO() hook, favicon dinamico, SEO admin panel, 5 categorias de settings (appearance, branding, navigation, content, seo), site_presets com save/restore.

#### 10.2.1 Auditoria — Elementos Hardcoded Atuais

| Categoria | Arquivos Afetados | Estado Atual |
|-----------|-------------------|-------------|
| Cores (navy/gold) | index.css, Navbar, Footer, Home, Sidebar, LoginPage, 4 paginas de segmento | CSS vars no root, mas inline classes hardcoded em ~78 arquivos |
| Fontes (Inter/Playfair/Sora) | index.html, tailwind.config.ts, index.css | Google Fonts URL e family names hardcoded |
| Menus de navegacao | Navbar.tsx (site), admin-navigation.ts (admin), Footer.tsx | Labels, rotas e icones hardcoded |
| Hero CTAs | Home.tsx, 4 paginas de segmento | Texto e rotas hardcoded ("Conheca Nossa Escola", "Agende uma Visita") |
| Cards da Home | Home.tsx (FEATURES, INFRASTRUCTURE arrays) | Titulos, descricoes, icones e stats hardcoded |
| Logo | Navbar.tsx, Sidebar.tsx, index.html (favicon) | URL S3 hardcoded |
| Botao Matricula | Navbar.tsx, index.css (animacao pulsante) | Texto "Matricula 2026" e cor da animacao hardcoded |
| Stats | Home.tsx, 4 paginas de segmento (PILLARS) | "920+ ENEM", "20+ anos", "90%+ aprovacao" hardcoded |
| SEO/Meta | index.html | Title, description, OG tags, favicon hardcoded |
| TopBar social | TopBar.tsx | WhatsApp, Facebook, Instagram URLs hardcoded |
| Branding admin | LoginPage.tsx, Sidebar.tsx, AdminHeader.tsx | "Colegio Batista", cores, iniciais "CB" hardcoded |

#### 10.2.2 Nova Categoria — `system_settings[branding]`

Concentra toda a identidade visual e textual da instituicao.

```
branding.identity
├── school_name           "Colégio Batista em Caruaru"
├── school_short_name     "Batista"
├── school_initials       "CB"
├── slogan                "Educação que Transforma Vidas"
├── cnpj                  "01.873.279/0002-61"
├── logo_url              URL do logo principal
├── logo_dark_url         URL do logo para fundo escuro (opcional)
├── favicon_url           URL do favicon
└── og_image_url          URL da imagem OpenGraph

branding.colors
├── primary               "#003876"     → --primary
├── primary_dark           "#002855"     → --primary-dark
├── secondary             "#ffd700"     → --secondary
├── secondary_light       "#ffe44d"     → --secondary-light
├── accent                "#ffd700"     → --accent (alias de secondary)
├── surface               "#f9fafb"     → --surface
├── text_on_primary       "#ffffff"
└── text_on_secondary     "#1a1a2e"

branding.fonts
├── display_family        "Playfair Display"
├── display_weight        "700"
├── sans_family           "Inter"
├── sans_weight           "400"
├── admin_family          "Sora"
└── google_fonts_url      URL completa do Google Fonts (gerada automaticamente)

branding.cta
├── enrollment_label      "Matrícula 2026"
├── enrollment_route      "/matricula"
├── enrollment_pulse      true
├── hero_primary_label    "Conheça Nossa Escola"
├── hero_primary_route    "/sobre"
├── hero_secondary_label  "Agende uma Visita"
├── hero_secondary_route  "/agendar-visita"
├── band_label            "Faça sua matrícula"
└── band_route            "/matricula"
```

#### 10.2.3 Nova Categoria — `system_settings[navigation]`

Menus do site e admin configuraveis.

```
navigation.topbar
├── show_topbar           true
├── show_phone            true
├── show_social           true
├── whatsapp_message      "Olá, vim do site e queria mais informações"
└── items[]               [{label, url, icon, target}]   // links extras

navigation.navbar
├── items[]               [{label, route, children?}]
│   ├── { label: "Início", route: "/" }
│   ├── { label: "Segmentos", children: [
│   │     { label: "Educação Infantil", route: "/educacao-infantil" },
│   │     ...
│   │   ]}
│   ├── { label: "Sobre", route: "/sobre" }
│   ├── { label: "Estrutura", route: "/estrutura" }
│   └── { label: "Contato", route: "/contato" }
└── cta                   → lê de branding.cta.enrollment_*

navigation.footer
├── columns[]             [{title, links: [{label, route}]}]
│   ├── { title: "Links Rápidos", links: [...] }
│   ├── { title: "Segmentos", links: [...] }
│   └── { title: "Redes Sociais", links: [...] }
├── legal_links[]         [{label, route}]
├── show_cnpj             true
├── show_business_hours   true
└── copyright_text        "© {year} {school_name}. Todos os direitos reservados."

navigation.admin_sidebar
├── brand_title           "Colégio Batista"
├── brand_subtitle        "Painel Administrativo"
├── show_initials_box     true
└── groups[]              → herda de admin-navigation.ts mas com override de labels/visibilidade
```

#### 10.2.4 Nova Categoria — `system_settings[content]`

Conteudo editavel das paginas publicas.

```
content.home
├── features[]            [{title, description, stat_value, stat_label, icon}]
│   Exemplo:
│   { title: "Excelência Acadêmica",
│     description: "Nossos alunos alcançam as melhores notas...",
│     stat_value: "920+",
│     stat_label: "Média ENEM",
│     icon: "GraduationCap" }
├── infrastructure[]      [{title, items[], icon}]
│   Exemplo:
│   { title: "Infraestrutura Completa",
│     items: ["Laboratórios modernos", "Quadra poliesportiva", ...],
│     icon: "Building" }
├── stats[]               [{value, label, icon}]
│   Exemplo: { value: "920+", label: "Média ENEM", icon: "Trophy" }
└── testimonials_title    "O que dizem os pais"

content.seo
├── title                 "Colégio Batista em Caruaru"
├── description           "Educação que Transforma Vidas..."
├── og_title              → fallback para title
├── og_description        → fallback para description
├── og_image              → fallback para branding.identity.og_image_url
└── twitter_card          "summary_large_image"

content.segment_pages     → já parcialmente coberto por appearance.*
├── educacao_infantil     { pillars[], differentials[], activities[] }
├── fundamental_1         { ... }
├── fundamental_2         { ... }
└── ensino_medio          { ... }
```

#### 10.2.5 Implementacao — Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  system_settings                     │
│  [branding] [navigation] [content] [appearance]      │
└──────────────────────┬──────────────────────────────┘
                       │ Supabase Realtime
                       ▼
┌─────────────────────────────────────────────────────┐
│              BrandingProvider (React Context)         │
│  • Carrega branding + navigation + content           │
│  • Injeta CSS variables no :root                     │
│  • Gera Google Fonts URL dinamicamente               │
│  • Expõe via useBranding() hook                      │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
     Site Publico   Admin Panel   Portal Aluno
     (Navbar,       (Sidebar,     (Layout,
      Footer,        Login,        cores,
      Home,          Header)       fontes)
      Segmentos)
```

**Fluxo de aplicacao de cores**:
1. Admin salva `branding.colors.primary = "#1a5276"` em `system_settings`
2. `BrandingProvider` detecta mudanca via Realtime
3. Injeta `document.documentElement.style.setProperty('--primary', '#1a5276')`
4. Todos os componentes que usam `var(--primary)` atualizam instantaneamente
5. Classes Tailwind hardcoded (ex: `bg-[#003876]`) sao migradas para `bg-[var(--primary)]`

**Fluxo de aplicacao de fontes**:
1. Admin seleciona fontes no branding
2. Provider gera URL Google Fonts: `https://fonts.googleapis.com/css2?family=...`
3. Injeta `<link>` dinamicamente no `<head>`
4. Atualiza CSS variables `--font-display` e `--font-sans`

#### 10.2.6 Nova Aba de Configuracao — Branding

Nova aba no painel de configuracoes (`/admin/configuracoes`), posicionada como **primeira aba** (antes de Dados Institucionais):

| Card | Conteudo |
|------|----------|
| **Identidade** | Nome, nome curto, iniciais, slogan, CNPJ |
| **Logos** | Upload de logo principal, logo dark, favicon; preview em navbar/sidebar |
| **Cores** | Color pickers para primary, secondary, accent, surface; preview ao vivo em mini-site |
| **Tipografia** | Seletor de fonte display + sans com preview; dropdown com fontes populares do Google Fonts |
| **Botoes CTA** | Texto e rota do botao de matricula, CTAs do hero, banda CTA; toggle pulsar |
| **SEO** | Title, description, OG image; preview de como aparece no Google/WhatsApp |

#### 10.2.7 Nova Aba de Configuracao — Navegacao

Nova aba no painel de configuracoes:

| Card | Conteudo |
|------|----------|
| **TopBar** | Toggle visibilidade, mensagem WhatsApp, links extras |
| **Menu Principal** | CRUD de items com drag-and-drop para reordenar; suporte a dropdown |
| **Footer** | CRUD de colunas + links; toggle CNPJ, horarios; texto de copyright |
| **Admin Sidebar** | Titulo, subtitulo, toggle iniciais; override de labels de grupo |

#### 10.2.8 Nova Aba de Configuracao — Conteudo das Paginas

Nova aba no painel de configuracoes:

| Card | Conteudo |
|------|----------|
| **Home — Features** | CRUD com drag-and-drop: titulo, descricao, stat, icone (seletor Lucide) |
| **Home — Infraestrutura** | CRUD: titulo, icone, lista de items |
| **Home — Stats do Hero** | CRUD: valor, label, icone |
| **Paginas de Segmento** | Editor por segmento: pilares, diferenciais, atividades |

#### 10.2.9 Migracao de Codigo — Etapas

| Etapa | Descricao | Esforco | Status |
|-------|-----------|---------|--------|
| 1. CSS Variables | Substituir TODOS os `bg-[#003876]`, `text-[#ffd700]`, etc. por `bg-[var(--primary)]`, `text-[var(--secondary)]` em ~78 arquivos | Alto | ✅ Concluido |
| 2. BrandingProvider | Criar context + hook que carrega settings e injeta CSS vars + fonts | Medio | ✅ Concluido (BrandingContext com Realtime) |
| 3. Navbar dinamica | Migrar menu hardcoded para leitura de `navigation.navbar` | Medio | ✅ Concluido |
| 4. Footer dinamico | Migrar colunas e links para `navigation.footer` | Medio | ✅ Concluido |
| 5. TopBar dinamica | Migrar URLs sociais para `navigation.topbar` | Baixo | ✅ Concluido |
| 6. Home content | Migrar FEATURES, INFRASTRUCTURE, STATS para `content.home` | Medio | ✅ Concluido |
| 7. Segment pages | Migrar PILLARS, DIFFERENTIALS para `content.segment_pages` | Medio | ✅ Concluido |
| 8. Admin branding | Migrar LoginPage, Sidebar, Header, templates WhatsApp para `branding.*` | Medio | ✅ Concluido (useBranding em admin + portal) |
| 9. SEO dinamico | Hook `useSEO()` injeta title, meta, OG/Twitter tags; admin panel SEO; favicon dinamico | Baixo | ✅ Concluido (useSEO em 12 paginas, SEOSettingsPanel, injectFavicon) |
| 10. Config UI | Criar abas Branding, Navegacao e Conteudo no painel | Alto | ✅ Concluido (BrandingSettingsPanel, NavigationSettingsPanel, ContentSettingsPanel, SEOSettingsPanel) |
| 11. Seed defaults | Criar migration com valores atuais como seed (preserva identidade Batista) | Baixo | ✅ Concluido (site_presets com preset base) |

---

### 10.3 Multi-Tenancy: Upstream + Client Repos (CONCLUIDO)

> **Implementado em**: 12 de abril de 2026
> **Substitui**: Abordagem anterior de replicacao via SQL script (descartada)

Arquitetura completa de multi-tenancy implementada. Detalhes na secao 2.3.

**Itens concluidos:**

| Item | Descricao | Status |
|------|-----------|--------|
| Genericizacao do codigo | Remocao de todos os dados hardcoded de cliente em 37+ arquivos | ✅ Concluido |
| `src/config/client.ts` | Centralizacao de defaults com leitura de env vars `VITE_*` | ✅ Concluido |
| `.env.example` | Template para novos clientes | ✅ Concluido |
| Repo base `school-platform` | Criado e populado em `systemieven/school-platform` | ✅ Concluido |
| Upstream remote | `batista-site` configurado com upstream apontando para school-platform | ✅ Concluido |
| Propagacao automatica | `.github/workflows/propagate.yml` com guard de repo | ✅ Concluido |
| Sync manual | `.github/workflows/sync-upstream.yml` para clientes | ✅ Concluido |
| Scripts de onboarding | `new-client.sh`, `push-migrations.sh`, `deploy-functions.sh` | ✅ Concluido |
| GitHub CLI | Instalado e autenticado (`~/.local/bin/gh`) | ✅ Concluido |
| Supabase CLI | Instalado e autenticado (`~/.local/bin/supabase`) | ✅ Concluido |

<details><summary>Planejamento original de replicacao via SQL (historico — descartado)</summary>

**Objetivo original**: Gerar um kit de replicacao completo que permite criar uma instancia funcional do sistema em um projeto Supabase novo e limpo, pronta para customizacao via painel.

#### 10.3.1 O Que Vai no SQL vs. O Que Fica Fora

O Supabase tem 3 camadas de configuracao com mecanismos distintos:

| Camada | Mecanismo | Coberto pelo setup.sql? |
|--------|-----------|:-:|
| **Schema** (tabelas, funcoes, triggers, indices) | SQL DDL | **Sim** |
| **RLS Policies** (acesso por role) | SQL `CREATE POLICY` | **Sim** |
| **Storage Buckets** (criacao + policies) | SQL `INSERT INTO storage.buckets` + `CREATE POLICY ON storage.objects` | **Sim** |
| **Realtime** (publicacao) | SQL `ALTER PUBLICATION` | **Sim** |
| **pg_cron Jobs** (tarefas agendadas) | SQL `SELECT cron.schedule(...)` | **Sim** |
| **pg_net** (HTTP de triggers) | SQL `SELECT net.http_post(...)` dentro de funcoes | **Sim** |
| **Extensions** (pg_cron, pg_net, pgcrypto) | SQL `CREATE EXTENSION` | **Sim** |
| **Seed Data** (config inicial) | SQL `INSERT INTO` | **Sim** |
| **Secrets auto-injetados** (SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY) | Automatico pelo Supabase — nenhuma acao necessaria | N/A |
| **Secrets customizados** (GOOGLE_MAPS_API_KEY) | CLI: `supabase secrets set KEY=value` | **Nao** — documentado no README |
| **Edge Functions** (13 funcoes Deno) | CLI: `supabase functions deploy` | **Nao** — copiadas no kit |
| **Edge Function JWT config** (verify_jwt por funcao) | `supabase/config.toml` | **Nao** — copiado no kit |
| **Frontend .env** (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) | Arquivo `.env` no build frontend | **Nao** — template no kit |

#### 10.3.2 Escopo do `setup.sql`

Script unico e auto-contido, executavel no SQL Editor do Supabase. Ordem:

```
1. Extensions
   ├── pgcrypto
   ├── pg_cron (schema pg_catalog)
   └── pg_net (schema extensions)

2. Tabelas (CREATE TABLE) — 32+ tabelas
   ├── profiles
   ├── system_settings
   ├── visit_appointments, visit_settings, visit_blocked_dates
   ├── enrollments, enrollment_documents, enrollment_history
   ├── contact_requests, contact_history
   ├── consent_records, testimonials
   ├── leads, lead_stages, lead_activities
   ├── attendance_tickets, attendance_history, attendance_feedback
   ├── whatsapp_templates, whatsapp_template_categories
   ├── whatsapp_message_log, whatsapp_providers
   ├── confirmation_tracking
   ├── notifications, notification_preferences
   ├── school_segments, school_classes, students
   ├── activities, grades, attendance (academico)
   ├── library_resources
   ├── announcements, school_events, event_rsvps
   └── appointment_history

3. Indices (CREATE INDEX)

4. Funcoes (CREATE OR REPLACE FUNCTION)
   ├── generate_enrollment_number()
   ├── fn_auto_create_lead_from_appointment()
   ├── fn_auto_create_lead_from_contact()
   ├── fn_log_appointment_status()
   ├── fn_log_enrollment_status()
   ├── fn_log_contact_status()
   ├── fn_notify_via_edge_function()     — usa pg_net para chamar auto-notify
   ├── fn_send_visit_reminders()         — chamada pelo pg_cron
   ├── fn_expire_pending_confirmations() — chamada pelo pg_cron
   ├── update_updated_at_column()
   └── demais funcoes utilitarias

5. Triggers (CREATE TRIGGER)
   ├── trg_auto_create_lead_from_appointment  (ON INSERT visit_appointments)
   ├── trg_auto_create_lead_from_contact      (ON INSERT contact_requests)
   ├── trg_appointment_status_log             (ON UPDATE visit_appointments)
   ├── trg_enrollment_status_log              (ON UPDATE enrollments)
   ├── trg_contact_status_log                 (ON UPDATE contact_requests)
   ├── trg_notify_on_appointment              (ON INSERT visit_appointments → pg_net → auto-notify)
   ├── trg_notify_on_enrollment               (ON INSERT enrollments → pg_net → auto-notify)
   ├── trg_notify_on_contact                  (ON INSERT contact_requests → pg_net → auto-notify)
   └── trg_updated_at_* (por tabela com updated_at)

6. RLS Policies (ALTER TABLE ENABLE RLS + CREATE POLICY)
   ├── Publicas (anon):
   │   visit_appointments (INSERT pending, SELECT, UPDATE own),
   │   enrollments (INSERT new), enrollment_documents (INSERT),
   │   contact_requests (INSERT new), consent_records (INSERT),
   │   testimonials (INSERT pending, SELECT approved),
   │   system_settings (SELECT categorias publicas),
   │   visit_settings (SELECT), visit_blocked_dates (SELECT)
   ├── Authenticated:
   │   profiles (SELECT all, UPDATE self/lower),
   │   notifications (SELECT/UPDATE own),
   │   notification_preferences (CRUD own)
   ├── Admin+ (super_admin, admin, coordinator):
   │   Todas as tabelas operacionais (CRUD),
   │   whatsapp_* (CRUD), system_settings (CRUD)
   └── Super Admin:
       profiles (INSERT, DELETE), whatsapp_providers (CRUD)

7. Storage Buckets (INSERT INTO storage.buckets + CREATE POLICY ON storage.objects)
   ├── enrollment-documents   (privado, 5 MB, JPG/PNG/PDF)
   ├── site-images            (publico read, 10 MB, JPG/PNG/WebP)
   ├── whatsapp-media         (publico read, 20 MB, imagem/video/audio/doc)
   ├── library-resources      (privado signed URL, sem limite hard)
   └── avatars                (publico read, 5 MB, JPG/PNG/WebP, pasta por usuario)
   Cada bucket inclui 4 policies: SELECT (anon), INSERT/UPDATE/DELETE (auth)

8. Realtime (ALTER PUBLICATION supabase_realtime)
   ├── visit_appointments
   ├── enrollments
   ├── contact_requests
   └── attendance_tickets

9. pg_cron Jobs (SELECT cron.schedule)
   ├── visit_reminders        — a cada 15 min, chama fn_send_visit_reminders()
   ├── confirmation_expiry    — a cada 1 hora, chama fn_expire_pending_confirmations()
   └── (futuro: cleanup de tokens, relatorios agendados)
```

#### 10.3.3 Escopo do `seed.sql`

Arquivo separado com dados iniciais genericos (nao especificos de nenhuma instituicao):

```
1. lead_stages — estagios padrao do kanban
   (Novo Lead, 1o Contato, Interesse Confirmado, Visita Agendada,
    Visita Realizada, Docs Entregues, Matricula Confirmada, Perdido)

2. whatsapp_template_categories — categorias com cores
   (agendamento, matricula, contato, geral, boas_vindas, 2fa)

3. system_settings — valores padrao por categoria
   ├── general:   school_name, business_hours (seg-sex 07-17), geolocation (vazio)
   ├── branding:  cores padrao (navy/gold), fontes padrao, CTAs padrao
   ├── navigation: menus padrao do template
   ├── content:   features, stats e infrastructure com placeholders
   ├── visit:     motivos padrao (Conhecer Escola, Entrega de Docs, Entrevista)
   ├── attendance: config padrao (elegibilidade same_day, formato A001, som bell)
   ├── enrollment: docs padrao (RG, CPF, Certidao, Historico), min_age 3
   ├── contact:   motivos padrao (Matricula, Duvidas, Sugestoes, Outro), SLA 48h
   ├── notifications: todos os alertas habilitados
   ├── appearance: headers com placeholders genericos
   └── security:  min 8 chars, require uppercase+lowercase+numbers

4. visit_settings — motivos seed (legado, compatibilidade)
```

#### 10.3.4 Secrets e Configuracao Externa

**Secrets auto-injetados pelo Supabase** (nenhuma acao manual):

| Secret | Uso | Funcoes |
|--------|-----|---------|
| `SUPABASE_URL` | URL do projeto | 11 de 13 edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso admin (bypass RLS) | 11 de 13 edge functions |
| `SUPABASE_ANON_KEY` | Acesso publico | 10 de 13 edge functions |

**Secrets que precisam ser configurados manualmente**:

| Secret | Obrigatorio? | Comando | Funcoes que usam |
|--------|:-:|---------|-----------------|
| `GOOGLE_MAPS_API_KEY` | Opcional* | `supabase secrets set GOOGLE_MAPS_API_KEY=AIza...` | `geocode-address`, `google-static-map` |

*Necessario apenas se o modulo de geolocalizacao (check-in presencial) for utilizado.

**Credenciais UazAPI (WhatsApp)**: armazenadas na tabela `whatsapp_providers` (nao como secret do Supabase), gerenciadas pela interface admin em Configuracoes > WhatsApp > APIs.

#### 10.3.5 Edge Functions — Deploy e Config

As 13 Edge Functions sao copiadas no kit e deployadas via CLI:

```bash
# Deploy de todas as funcoes de uma vez
supabase functions deploy --project-ref <PROJECT_ID>
```

**Configuracao JWT** (`supabase/config.toml`): 6 funcoes publicas com `verify_jwt = false` (validacao feita internamente):

| Funcao | verify_jwt | Motivo |
|--------|:-:|--------|
| `attendance-checkin` | false | Rota publica /atendimento (QR Code) |
| `attendance-feedback` | false | Feedback publico pos-atendimento |
| `attendance-public-config` | false | Config publica da tela de espera |
| `attendance-panel-auth` | false | Painel TV (auth por senha propria) |
| `geocode-address` | false | Chamada com validacao interna de role |
| `google-static-map` | false | Chamada com validacao interna de role |

As demais 7 funcoes usam `verify_jwt = true` (padrao).

#### 10.3.6 Frontend — Template `.env`

Arquivo `setup/.env.template` com variaveis que o operador preenche:

```env
# Preencha com os dados do seu projeto Supabase
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SEU_ANON_KEY
VITE_SUPABASE_PROJECT_ID=SEU_PROJECT_ID
```

#### 10.3.7 Entregaveis

| Arquivo | Descricao |
|---------|-----------|
| `setup/setup.sql` | Schema completo: extensions, tabelas, indices, funcoes, triggers, RLS, storage buckets + policies, realtime, pg_cron jobs |
| `setup/seed.sql` | Dados iniciais genericos (lead_stages, categories, system_settings com placeholders) |
| `setup/edge-functions/` | Copia das 13 Edge Functions Deno prontas para deploy |
| `setup/config.toml` | Configuracao do projeto (verify_jwt por funcao) |
| `setup/.env.template` | Template de variaveis de ambiente do frontend |
| `setup/README.md` | Guia passo a passo completo |

#### 10.3.8 Checklist de Replicacao

```
SUPABASE
  □ 1. Criar projeto no Supabase Dashboard
  □ 2. Executar setup.sql no SQL Editor (cria schema + storage + cron)
  □ 3. Executar seed.sql no SQL Editor (dados iniciais)
  □ 4. (Opcional) Configurar secret: supabase secrets set GOOGLE_MAPS_API_KEY=...

EDGE FUNCTIONS
  □ 5. Copiar config.toml para supabase/config.toml
  □ 6. Copiar edge-functions/ para supabase/functions/
  □ 7. Deploy: supabase functions deploy --project-ref <ID>

FRONTEND
  □ 8. Copiar .env.template para .env e preencher credenciais
  □ 9. Build: npm install && npm run build
  □ 10. Deploy em Vercel/Cloudflare (apontar dominio)

PRIMEIRO ACESSO
  □ 11. Chamar edge function create-admin-user para criar super_admin
  □ 12. Login em /admin com credenciais temporarias
  □ 13. Alterar senha no primeiro acesso
  □ 14. Personalizar branding, cores, logo, menus em /admin/configuracoes
  □ 15. Configurar WhatsApp provider (se aplicavel)
  □ 16. Testar fluxo completo: site → matricula → admin → portal
```

#### 10.3.9 Geracao do Script

| Etapa | Descricao |
|-------|-----------|
| 1 | Consolidar as 26 migrations em DDL unico, resolvendo dependencias e colapsando ALTERs intermediarios em CREATE TABLE finais |
| 2 | Extrair e unificar todas as funcoes PL/pgSQL e triggers |
| 3 | Extrair e unificar todas as RLS policies |
| 4 | Incluir storage buckets com INSERT + policies (ja feito nas migrations 9, 16, 17) |
| 5 | Incluir pg_cron schedules e pg_net configs |
| 6 | Gerar seed.sql com valores genericos (substituir dados do Colegio Batista por placeholders) |
| 7 | Validar executando setup.sql + seed.sql em projeto Supabase vazio |
| 8 | Validar deploy das edge functions + teste de health check |
| 9 | Teste end-to-end: site → formularios → admin → portal |

</details>

---

### 10.4 Melhorias Adicionais

| Item | Descricao | Prioridade |
|------|-----------|------------|
| **2FA real via WhatsApp** | Implementar geracao/verificacao de OTP com time-window; hoje so existe scaffold de categoria | Baixa | ⏳ Pendente |
| **Calendario visual de agendamentos** | Visao semanal/mensal com drag-and-drop e indicador de lotacao (PRD v1 especificava) | Media | ✅ Concluido (CalendarView em AppointmentsPage) |
| **Relatorios agendados** | Envio periodico por e-mail (mensal/trimestral) | Baixa | ⏳ Pendente |
| **OAuth para depoimentos** | Google e Facebook providers no Supabase Auth (pendente desde frontend v1) | Baixa | ⏳ Pendente |
| **Paginas placeholder do site** | `/sobre`, `/estrutura`, `/area-professor` — apontam para EmConstrucao | Media | ✅ Concluido |
| **Mascaramento de dados** | CPF e telefone parcial para roles restritas | Baixa | ⏳ Pendente |
| **Rate limiting** | Endpoints publicos (5 Edge Functions com sliding window por IP) | Media | ✅ Concluido (15/30/10/5/120 req/min) |
| **Biblioteca Virtual publica** | Rota `/biblioteca-virtual` no site (parcial com busca local, sem backend) — decidir se migra para /portal/biblioteca | Baixa | ⏳ Pendente |

---

## 11. Requisitos Nao Funcionais

### Performance
- Paginacao server-side para listagens
- Realtime via Supabase channels para notificacoes e filas
- Code-splitting: Admin e Portal carregados sob demanda
- Compressao de imagens no upload

### Seguranca
- RLS em todas as tabelas
- Edge Functions como proxy para APIs externas (UazAPI, Google Maps)
- Politica de senha configuravel com historico
- Tokens JWT com refresh automatico
- Dados sensiveis nunca expostos ao client (API keys em secrets do Supabase)

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

### B. Integracao UazAPI

- **Documentacao**: https://docs.uazapi.com
- **Autenticacao**: Bearer token no header (via Edge Function `uazapi-proxy`)
- **Webhook**: recebe status via `uazapi-webhook` com validacao por secret
- **Funcionalidades**: envio de texto, midia, botoes, listas; verificacao de numero; status de entrega

### C. Repositorios

- **Repo base**: `systemieven/school-platform` — codigo generico, sem dados de cliente
- **Primeiro cliente**: `systemieven/batista-site` — upstream → school-platform, origin → batista-site
- **Branch principal**: `main` (em ambos)
- **Areas do app**: site (`/`), admin (`/admin`), portal (`/portal`), atendimento (`/atendimento`)
- **Propagacao**: push em school-platform abre PR automaticamente nos clientes
- **Push local**: `git push upstream main && git push origin main`

### D. Credenciais Supabase

- **Project ID**: `dinbwugbwnkrzljuocbs`
- **Project URL**: `https://dinbwugbwnkrzljuocbs.supabase.co`
- **Anon Key**: `sb_publishable_XQXGJDPXCEsMkk_xr6ok7A_xw9ZK6WQ`
