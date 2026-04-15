# PRD v3 — Plataforma Escolar (school-platform)

> **Versao**: 3.3
> **Data**: 15 de abril de 2026
> **Status**: Documento unificado — estado atual (Fases 1-9, 9.M e 8.5 concluidas) + roadmap ate v1
> **Arquitetura**: Multi-tenant via upstream/client repos com sync merge-based (sem force-push)

---

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Arquitetura e Stack](#2-arquitetura-e-stack)
3. [Sistema de Autenticacao e Roles](#3-sistema-de-autenticacao-e-roles)
4. [Modulos Implementados (Fases 1-8)](#4-modulos-implementados-fases-1-8)
5. [Painel de Configuracoes](#5-painel-de-configuracoes)
6. [Aparencia e Site Institucional](#6-aparencia-e-site-institucional)
7. [Schema do Banco de Dados](#7-schema-do-banco-de-dados)
8. [Edge Functions](#8-edge-functions)
9. [Rotas e Navegacao](#9-rotas-e-navegacao)
10. [Roadmap de Desenvolvimento](#10-roadmap-de-desenvolvimento)
    - 10.1 Visao Geral das Fases
    - 10.2 Fases Concluidas (6-9)
    - 10.3 Fase 8 — Modulo Financeiro (CONCLUIDA)
    - 10.4 Fase 9 — Academico Completo
    - 10.4B Fase 9.5 — Dashboards Analiticos (pendente)
    - 10.4C Fase 8.5 — ERP Financeiro Completo (CONCLUIDA)
    - 10.5 Fase 10 — Portal do Responsavel
    - 10.5B Fase 10.P — Portal do Professor / Diario de Classe (paralelo a Fase 10)
    - 10.6 Fase 11 — Secretaria Digital
    - 10.7 Fase 12 — Modulo Pedagogico Avancado (BNCC)
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

- **40+ tabelas** com Row Level Security (RLS) em todas
- **47 migrations** aplicadas sequencialmente
- **5 storage buckets**: `enrollment-documents`, `site-images`, `whatsapp-media`, `library-resources`, `avatars`
- **16 Edge Functions** para logica server-side (8 publicas com rate limiting ou auth customizada)
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

**Estrutura de branches (em cada clone local):**

| Branch | Rastreia | O que contem |
|--------|----------|--------------|
| `base` | `upstream/main` (school-platform) | Codigo 100% generico, sem `.env`, sem dados de cliente. E o que todos os clientes compartilham. |
| `main` | `origin/main` (repo do cliente) | `base` + um commit com o `.env` do cliente + merge commits dos syncs subsequentes. E o que o Lovable consome e publica. |

**Configuracao por cliente:**

| Fonte | O que configura | Exemplo |
|-------|----------------|---------|
| `.env` (tracked em `main` do repo do cliente) | Credenciais Supabase + identidade da escola | `VITE_SUPABASE_URL`, `VITE_SCHOOL_NAME` |
| `src/config/client.ts` | Fallbacks genericos lidos de env vars | `CLIENT_DEFAULTS.identity.school_name` |
| `system_settings` (DB) | Cores, fontes, identidade, CTA, contato | Tabela no Supabase, editavel via `/admin/configuracoes` |
| `BrandingContext` | Cascata: DB > config/client.ts > defaults | Carrega na inicializacao do app |

**Integracao Lovable Cloud — importante:**

A integracao Supabase do Lovable Cloud (botao "Cloud" no painel do projeto) injeta `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` **apenas no preview** (dev server do Lovable). **Nao injeta no `vite build` do publish.** Por isso `.env` precisa estar commitado em `origin/main`:

- **Preview:** Lovable Cloud injeta as vars → funciona mesmo se `.env` estivesse ausente.
- **Publish:** Lovable roda `vite build` contra o checkout do repo → `.env` do filesystem e a unica fonte.

Tentativas anteriores de eliminar `.env` do git (confiando so no Lovable Cloud) quebraram o site publicado com o banner "Variaveis de ambiente ausentes". A regra e: **`.env` fica commitado em `main`, sem excecao.**

**Sincronizacao base → main via merge (sem force-push):**

Como `.env` so existe em `main`, a branch diverge de `base`. A sync usa `git merge --no-ff` (nunca rebase), preservando SHAs:

```
base:    A---B---C---D---F              (upstream/main — linear)
                  \   \
main:    A---B---C---E(.env)---M1---M2   (origin/main — com merges)
                                /    /
                               D    F
```

`upstream/main` recebe apenas a linha linear de `base` via `git push upstream base:main` — nunca ve `.env`, nunca ve merge commits, school-platform permanece 100% generico. `origin/main` avanca sempre em fast-forward, entao o Lovable nunca perde referencia de commit (problema recorrente do workflow rebase-based anterior).

**Comando unificado:** `./scripts/push-all.sh`

Detecta o branch atual e age de acordo:

1. **Em `base`** (trabalho generico — a maior parte):
   - `git push upstream base:main` (fast-forward)
   - `git checkout main && git merge base --no-ff`
   - `git push origin main` (fast-forward)
   - `git checkout base`
2. **Em `main`** (raro — ex.: rotacionar chave Supabase no `.env`):
   - `git push origin main` (fast-forward)
   - (`upstream` nunca recebe — ok para client-only)

**Propagacao automatica:**

- `.github/workflows/propagate.yml` no school-platform: a cada push em main, abre PR automaticamente em todos os repos clientes (matrix strategy). Skip early se o cliente ja esta up-to-date com upstream.
- Guard `if: github.repository == 'systemieven/school-platform'` impede execucao nos clientes.
- `.github/workflows/sync-upstream.yml` nos clientes: dispatch manual para buscar atualizacoes.

**Onboarding de novo cliente:**

1. Fork de `systemieven/school-platform` para `systemieven/<cliente>-site`
2. Criar projeto Supabase dedicado ao cliente
3. No fork, copiar `.env.example` para `.env`, preencher com credenciais Supabase + identidade, commitar no `main` do fork (apenas `main`, nunca em `base`)
4. Abrir o fork no Lovable, conectar Supabase via **Cloud** (cobre o preview)
5. Clonar localmente e configurar os dois remotos:
   ```bash
   git clone git@github.com:systemieven/<cliente>-site.git
   cd <cliente>-site
   git remote add upstream https://github.com/systemieven/school-platform.git
   git fetch upstream
   git checkout -b base upstream/main
   ```
6. Aplicar migrations: `scripts/push-migrations.sh`
7. Deploy de Edge Functions: `scripts/deploy-functions.sh`
8. Configurar identidade/branding via `/admin/configuracoes` (grava em `system_settings`)

**Dev local:** criar `.env.local` (gitignored via pattern `*.local`) com as credenciais de desenvolvimento. Vite carrega `.env.local` em todos os modos e sobrescreve o `.env` committado.

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

## 4. Modulos Implementados (Fases 1-8)

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

#### 4.5.4 Nao Comparecimento Automatico

> ✅ **CONCLUIDO — 2026-04-15** (migration 65)

Agendamentos passados sem transicao para `comparecimento` ou `completed` podem ser marcados automaticamente como `no_show` por um job periodico. Configura­vel na aba de configuracoes > Atendimentos.

- **Funcao SQL**: `mark_appointment_no_shoots()` (`SECURITY DEFINER`) — le `attendance.no_show_config` de `system_settings`; atualiza `status = 'no_show'` quando `(appointment_date + appointment_time) AT TIME ZONE 'America/Recife' < now() - (timeout_minutes * INTERVAL '1 minute')`
- **Cron**: pg_cron job `no-show-checker` executado a cada 15 min (registro manual no Supabase SQL Editor)
- **Config**: `no_show_config: { enabled: boolean, timeout_minutes: 30 | 60 | 120 | 240 }`

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
- **Variaveis dinamicas**: `{{variavel}}` com sugestoes por modulo — `MODULE_VARIABLES` no frontend define as variaveis por categoria
- **Categorias** com cores: agendamento, matricula, contato, geral, boas-vindas, 2fa, financeiro, academico (migration 64 corrigiu os arrays `variables` destas duas ultimas)
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

### 4.10 Seguimentos, Series, Turmas e Alunos

**Rotas**: `/admin/segmentos` (redireciona para `/admin/academico`), `/admin/alunos`, `/admin/alunos/:studentId` (ficha)
**Roles**: super_admin, admin, coordinator

> ✅ **HIERARQUIA 3-NIVEIS APLICADA — 2026-04-15** (PR1+PR2+PR3, migrations 61-63)
>
> Modelo `school_segments → school_series → school_classes` aplicado completo: backbone, regras de negocio (capacidade + progressao) e granularidade financeira por serie. Detalhes em **10.4C.1** a **10.4C.7**.
>
> Descricao original (OBSOLETA — mantida para rastreabilidade):
> ~~CRUD de turmas por segmento: nome, ano, turno, max alunos, professores atribuidos~~
> ~~Tabela unica `school_classes` com FK direto para `school_segments`~~

#### 4.10.A Hierarquia Correta (3 niveis)

```
Seguimento
  └── Serie (1..N por seguimento)
        └── Turma (1..N por serie, por ano letivo)
              └── Alunos matriculados
```

---

##### Seguimento (`school_segments` — tabela existente, modelo valido)

Agrupamento de series por faixa etaria. Exemplos: Educacao Infantil, Fundamental I, Fundamental II, Ensino Medio.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | text | Nome do seguimento |
| `slug` | text | Identificador URL |
| `description` | text | Descricao opcional |
| `coordinator_ids` | uuid[] | **1 ou 2 coordenadores** responsaveis pelo seguimento |
| `position` | int | Ordem de exibicao |
| `is_active` | boolean | — |

Regras:
- Cada seguimento tem 0, 1 ou 2 coordenadores (nao ha limite formal, mas a pratica e 1–2).
- Coordenadores do seguimento tem acesso a todas as series e turmas daquele seguimento.

---

##### Serie (`school_series` — **TABELA NOVA, NAO EXISTE AINDA**)

Estagio escolar do aluno dentro de um seguimento. Exemplos: 1º Ano, 2º Ano, 3º Ano, Maternal I, Maternal II.

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `segment_id` | uuid FK | Seguimento pai |
| `name` | text | Nome completo: "1º Ano", "2º Ano", etc. |
| `short_name` | text | Abreviacao para display: "1A", "2A" |
| `order_index` | int | Ordem dentro do seguimento (define progressao) |
| `is_active` | boolean | — |

Regras:
- Series sao cadastradas **uma unica vez** e reutilizadas indefinidamente.
- Alunos **avancam de serie** ao final do ano letivo (aprovados) ou **permanecem** (reprovados).
- Series sao independentes de ano letivo — elas existem permanentemente no seguimento.
- Nao e possivel excluir uma serie que tenha turmas ou alunos associados.

---

##### Turma (`school_classes` — **TABELA EXISTENTE, PRECISA DE MIGRACAO**)

Subdivisao organizacional dentro de uma serie para um determinado ano letivo. Exemplo: "1º Ano A 2026", "1º Ano B 2026".

| Campo | Tipo | Status | Descricao |
|-------|------|--------|-----------|
| `series_id` | uuid FK | **NOVO** | Serie a qual a turma pertence |
| `segment_id` | uuid FK | ~~Deprecado~~ | Substituido por `series_id → segment_id`; manter por compatibilidade durante migracao |
| `school_year` | int | Renomear de `year` | Ano letivo (ex.: 2026) |
| `name` | text | Existente | Letra identificadora: "A", "B", "C" |
| `shift` | text | Existente | morning / afternoon / full |
| `max_students` | int | Existente | **Capacidade maxima da turma** |
| `teacher_ids` | uuid[] | Existente | Professores atribuidos |
| `is_active` | boolean | Existente | — |

Regras:
- Turmas sao criadas a cada ano letivo e podem ter capacidade, turno e professores diferentes entre anos.
- O **nome** da turma e apenas a letra (A, B, C); o nome completo e exibido como `{serie.name} {turma.name} {school_year}` — ex.: "1º Ano A 2026".
- **Limite de capacidade**: ao atingir `max_students`, nenhum aluno pode ser adicionado a turma sem autorizacao explicita de um gestor (role `admin` ou `super_admin`) com confirmacao de senha/pin.
- Alunos podem **transferir de turma** durante o ano, mas NAO podem mudar de serie.
- Pre-matriculas do proximo ano letivo vao preenchendo as novas turmas a medida que sao confirmadas.
- Turmas **sem serie** (legadas) devem ser migradas antes de habilitar o novo fluxo.

---

#### 4.10.B Fluxo de Ano Letivo

```
1. Admin cria as turmas do proximo ano (school_year = N+1), vinculadas as series existentes.
2. Pre-matriculas de veteranos sao confirmadas → aluno e movido para a turma do novo ano.
3. Pre-matriculas de novos → aluno criado e vinculado a turma.
4. Ao atingir max_students: novas tentativas sao bloqueadas no sistema.
   - Gestor pode autorizar com override (role admin+, confirmacao de senha).
5. Ao final do ano letivo: resultado final determina se aluno avanca de serie ou repete.
6. Inicio do proximo ano: alunos aprovados sao vinculados a turma da serie seguinte.
```

---

#### 4.10.C Impacto em Tabelas Existentes

As tabelas abaixo possuem FK para `school_classes.id` e serao afetadas pela migracao:

| Tabela | FK atual | Acao necessaria |
|--------|----------|-----------------|
| `students` | `class_id` | Manter; agora aponta para turma do ano letivo corrente |
| `class_disciplines` | `class_id` | Manter; vinculo disciplina+professor e por turma |
| `class_schedules` | `class_id` | Manter; grade horaria e por turma |
| `student_results` | `class_id` | Manter; resultado e por aluno+turma+ano |
| `student_transcripts` | `class_id` | Manter; historico ja tem `school_year` |
| `financial_discounts` | `class_id` | Manter; desconto por turma |
| `grade_formulas` | `segment_id` | Avaliar se deve migrar para `series_id` (mais granular) |

---

**Gestao de alunos**:

> ✅ **FOTO E FICHA DO ALUNO — 2026-04-15** (migration 66, `StudentDetailPage`)

- Ficha completa: dados pessoais, responsavel, turma, status
- Conversao de pre-matricula em aluno: gera enrollment_number, vincula a turma do ano letivo
- **Foto 3x4** (`photo_url TEXT`): upload com crop via `ImageCropModal` no `CreateStudentDrawer`; exibido como avatar na listagem (`StudentsPage`) e na ficha
- **Ficha do Aluno** (`/admin/alunos/:studentId`): pagina dedicada com 5 abas internas — Resumo (dados pessoais + responsavel + filiacao + historico escolar), Academico (tabela de notas por bimestre + frequencia + resultado final do ano letivo corrente), Financeiro (ultimas 12 parcelas com status e valores), Documentos (links para arquivos anexados), Observacoes (notas internas); KPI strip com 4 cards; edicao de foto inline com hover overlay; botao "Imprimir ficha" (`window.print()`); layout `print:` com Tailwind CSS

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

### 4.17 Modulo Financeiro (Fase 8)

**Rota**: `/admin/financeiro`
**Roles**: super_admin, admin
**Portal**: `/portal/financeiro`

Gerencia mensalidades, cobrancas, descontos, bolsas, templates de contrato, inadimplencia, cobranca extrajudicial e BI financeiro, integrado ao aluno matriculado. Opera com tab rail interna (pagina unica, **7 abas**: Dashboard, Planos, Contratos, Cobrancas, Descontos, Bolsas, Templates).

#### 4.17.1 Dashboard Financeiro

- **5 KPIs**: Receita recebida (pagas), A receber (pendente), Inadimplencia (vencidos), **Cobranca Extrajudicial** (vencidos alem do `max_overdue_days` do plano), Contratos ativos
- **Alertas**: banner vermelho para parcelas vencidas + banner ambar para parcelas em cobranca extrajudicial
- **Calculo de extrajudicial**: derivado client-side via join `installment → contract → plan.max_overdue_days`, sem novo status de parcela

#### 4.17.2 Planos de Mensalidade

- **CRUD** completo: nome, valor, parcelas, dia de vencimento, multa (%), juros (%)
- **Prazo de pagamento no portal** (`max_overdue_days`, 0-90 dias, passo 10 via `BrandSlider`): dias maximos apos vencimento em que o portal ainda aceita pagamento; apos esse prazo a parcela e considerada em cobranca extrajudicial e o botao de pagamento e bloqueado no portal do aluno. Valor `0` = sem limite.
- **Segmentacao**: por segmento escolar e ano letivo
- **Toggle** ativo/inativo

> **Nota historica**: O campo `punctuality_discount_pct` foi removido (migration 57) — descontos por antecipacao agora sao regras progressivas no modulo de Descontos (ver 4.17.7).

#### 4.17.3 Contratos Financeiros

- **Pipeline de status**: draft → active → suspended → cancelled → concluded
- **Vinculo**: aluno + plano + ano letivo (UNIQUE)
- **Geracao automatica de parcelas** ao ativar contrato (RPC `generate_installments_for_contract`)
- **Descontos automaticos**: ao ativar, o contrato consulta `calculate_applicable_discounts` e aplica todos os descontos/bolsas compativeis com o aluno (scope global/group/student). Fonte unica de verdade.
- **Acoes**: ativar + gerar parcelas, suspender, cancelar (cancela parcelas pendentes)

> **Nota historica**: Os campos `discount_type` / `discount_value` em `financial_contracts` foram removidos (migration 59). Todo desconto agora vive no modulo Descontos (ver 4.17.7) — para um desconto especifico de aluno, criar com `scope='student'`.

#### 4.17.4 Parcelas e Cobrancas

- **Listagem** com filtros por status (pending, overdue, paid, negotiated, cancelled, renegotiated)
- **Registro de pagamento manual**: valor, metodo (boleto, PIX, cartao, dinheiro, transferencia), observacoes
- **KPIs resumo**: total pendente, total vencido, total pago
- **`amount_with_discount`** preenchido no momento do pagamento quando regras progressivas se aplicam (calculadas via `payment_date` vs `due_date`)

#### 4.17.5 Portal do Aluno — Financeiro

- **3 cards KPI**: Pendente, Em Atraso, Pagas (com valor e contagem)
- **Filtro por status**: Todas, Pendentes, Vencidas, Pagas
- **Tabela/cards responsivos** com numero da parcela, vencimento, valor, status badge
- **Copiar PIX**: via RPC `get_pix_key()` (SECURITY DEFINER)
- **Ver Boleto**: link quando `boleto_url` preenchido
- **Bloqueio extrajudicial**: quando `today > due_date + plan.max_overdue_days`, o portal substitui o status "Vencida" por badge `Gavel + Extrajudicial` e substitui os botoes PIX/Boleto/Link por mensagem "Contate a secretaria da escola". Banner ambar no topo lista quantas parcelas estao nesse estado.

#### 4.17.6 Regua de Cobranca WhatsApp

- **Etapas customizaveis**: CRUD com offset em dias (negativo = antes do vencimento, positivo = apos, zero = no dia)
- **Cada etapa**: toggle habilitado + seletor de template WhatsApp (categoria `financeiro`)
- **Disparo por campanha**: agrupamento em lote via UazAPI `/sender/advanced` (folder por etapa/data)
- **Dedup**: tabela `financial_notification_log` impede duplicidade (installment_id + trigger_type)
- **pg_cron**: job `financial-notify-daily` executa 08:00 BRT diariamente

#### 4.17.7 Descontos

**Tabela**: `financial_discounts`

- **CRUD** completo com grid cards + drawer edit
- **Scopes**: `global` (todos os alunos), `group` (por plano, segmento ou turma), `student` (aluno especifico)
- **Tipos**: percentual (%) ou fixo (R$)
- **Descontos progressivos por antecipacao**: array JSONB `progressive_rules = [{days_before_due, percentage}]` — ex: "10 dias antes = 5%, 5 dias antes = 3%". Quando preenchido substitui `discount_value`.
- **Validade**: datas `valid_from` / `valid_until` opcionais
- **Prioridade** + flag `is_cumulative` — descontos nao cumulativos sao mutuamente exclusivos (aplica-se apenas o de maior prioridade)
- **Aplicacao**:
  - **Descontos comuns**: aplicados na geracao de parcelas via RPC `calculate_applicable_discounts` (chamada por `generate_installments_for_contract`)
  - **Progressivos**: ignorados na geracao (sem `payment_date`); avaliados no momento do registro de pagamento, escolhendo a melhor regra (maior `days_before_due <= due - payment`)
- **RPC**: `calculate_applicable_discounts(student_id, plan_id, amount, ref_date, payment_date?, due_date?)` retorna `total_discount`, `discount_ids[]`, `scholarship_ids[]`

#### 4.17.8 Bolsas (Scholarships)

**Tabela**: `financial_scholarships`

- **CRUD** por aluno com pipeline de aprovacao (`pending` → `approved` → `rejected` → `expired`)
- **Tipos**: `full` (100%), `percentage` (%), `fixed` (R$)
- **Vigencia**: `valid_from` / `valid_until` obrigatorios
- **Cumulativas** por padrao (sempre somam aos descontos aplicaveis)
- **Aplicacao automatica**: integradas na mesma RPC `calculate_applicable_discounts` (bloco separado, pos-descontos)

#### 4.17.9 Templates de Contrato

**Tabela**: `financial_contract_templates`

- **CRUD** de templates com body HTML + variaveis (`{{aluno_nome}}`, `{{plano_nome}}`, `{{valor_total}}`, `{{ano_letivo}}`, `{{responsavel_nome}}`, etc.)
- **Header/Footer** customizaveis por template
- **Versionamento** por `school_year`
- **Geracao de PDF** cliente-side a partir do template escolhido no contrato

#### 4.17.10 Gateway de Pagamento

- **Adapter Pattern**: interface `GatewayAdapter` normaliza operacoes entre provedores
- **V1**: Asaas implementado (`AsaasAdapter`); modo manual sempre disponivel
- **Proxy autenticado**: `payment-gateway-proxy` (JWT admin+) com acoes `createCustomer`, `createCharge`, `getCharge`, `cancelCharge`
- **Webhook**: `payment-gateway-webhook` (publico, idempotente via `gateway_webhook_log`) atualiza `financial_installments` automaticamente
- **Multi-gateway**: cada escola pode ter mais de um gateway ativo

---

## 5. Painel de Configuracoes

**Rota**: `/admin/configuracoes`
**Roles**: super_admin, admin

Interface com **14 abas** (incluindo sub-abas), cada uma com cards recolhiveis (`SettingsCard`) e botao salvar flutuante. A aba "Site" contem 5 sub-abas: Aparencia, Branding, Navegacao, Conteudo e SEO.

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
| Visibilidade de Setores | `sector_visibility_mode` | ✅ Dois botoes estilizados em grid 2 colunas: "Todos os setores" (`all`) e "Restrito ao setor" (`restricted`); substitui radio buttons simples |
| Nao Comparecimento | `no_show_config` | ✅ Toggle habilitado/desabilitado + 4 botoes de preset de timeout (30 min, 1 h, 2 h, 4 h); ativa o job pg_cron de fechamento automatico (migration 65) |

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

### 5.10 Usuarios

Gerenciamento de contas de usuario com atribuicao de roles (ver secao 4.16).

### 5.11 Permissoes

Grid de permissoes por role (modulo x acao) com overrides por usuario.

### 5.12 Auditoria

Consulta de `audit_logs` com filtros por usuario, acao, modulo e periodo.

### 5.13 Financeiro

**Categoria**: `financial`

Painel proprio (`FinancialSettingsPanel`) com botao salvar flutuante (dirty tracking).

| Card | Descricao |
|------|-----------|
| Gateways de Pagamento | Lista de `payment_gateways` com provider, label, status; Drawer para adicionar/editar (provider, label, environment, API key, metodos, ativo/padrao) |
| Regua de Cobranca WhatsApp | CRUD de etapas com offset em dias (D-5, D+3, etc.) + label customizado; toggle habilitado; seletor de template WhatsApp (categoria `financeiro`); sem presets fixos — cada escola define sua propria regua |
| Chave PIX para Cobrancas | Select tipo (CPF/CNPJ/Email/Telefone/Aleatoria) + input valor; usada nas notificacoes e portal |

### 5.14 Academico

**Categoria**: `academic` — Painel proprio (`AcademicoSettingsPanel`). Adicionado na Fase 9.

| Card | Descricao |
|------|-----------|
| Periodos Letivos | Tipo (bimestre/trimestre/semestre), datas de inicio/fim por periodo |
| Formula de Media | Por segmento: tipo (simples/ponderada/por_periodo/customizada), pesos, nota minima de aprovacao, nota minima de recuperacao, frequencia minima (%), escala numerica ou conceitual |
| Alertas de Frequencia | Thresholds de % de presenca para disparo de alerta WhatsApp ao responsavel |

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
| `school_segments` | Seguimentos escolares (Ed. Infantil, Fund. I/II, Medio) com coordinator_ids |
| `school_series` | ✅ Series por seguimento (1º Ano, 2º Ano…); permanentes entre anos letivos (migration 61) |
| `school_classes` | ✅ Turmas por serie + ano letivo; `series_id NOT NULL` + campo `year` renomeado para `school_year` (migration 61) |
| `students` | Alunos matriculados com enrollment_number e vinculo a turma do ano letivo corrente |
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

#### Financeiro (Fase 8)
| Tabela | Descricao |
|--------|-----------|
| `financial_plans` | Planos de mensalidade: nome, valor, parcelas, vencimento, multa, juros, `max_overdue_days` (0-90) |
| `financial_contracts` | Contrato aluno+plano+ano com pipeline draft→active→concluded (sem desconto proprio — delegado a `financial_discounts`) |
| `financial_installments` | Parcelas com status, pagamento, gateway, boleto/PIX, `amount_with_discount` aplicado no pagamento |
| `financial_discounts` | Descontos com scope (global/group/student), tipo (% ou R$), `progressive_rules` JSONB, validade, prioridade, cumulativo |
| `financial_scholarships` | Bolsas por aluno com pipeline de aprovacao, tipos (full/%/fixo) e vigencia |
| `financial_contract_templates` | Templates de contrato HTML com header/footer/body e variaveis por `school_year` |
| `financial_notification_log` | Dedup da regua de cobranca (installment_id + trigger_type) |
| `payment_gateways` | Gateways configurados com credentials (JSONB), webhook_secret |
| `gateway_customers` | Cache de clientes no gateway (gateway_id, student_id) |
| `gateway_webhook_log` | Log de webhooks idempotente (normalized + raw) |

#### Governanca
| Tabela | Descricao |
|--------|-----------|
| `role_permissions` | Permissoes por role (modulo x acao) |
| `user_permission_overrides` | Overrides de permissao por usuario |
| `modules` | Modulos do sistema com toggle on/off e dependencias |
| `audit_logs` | Log centralizado de acoes admin |

### 7.2 Storage Buckets

| Bucket | Acesso | Uso |
|--------|--------|-----|
| `enrollment-documents` | Privado | Documentos de matricula (JPG, PNG, PDF, max 5MB) |
| `site-images` | Publico | Imagens do hero, headers, segmentos |
| `whatsapp-media` | Privado | Midia para templates WhatsApp |
| `library-resources` | Privado (signed URL) | PDFs, videos, imagens da biblioteca |
| `avatars` | Publico | Fotos de perfil dos usuarios |
| `student-photos` | Publico | Fotos 3x4 dos alunos (migration 66, max 5 MB) |

### 7.3 Migrations Aplicadas (66)

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
| 26 | `granular_permissions` | 11/04 | role_permissions, user_permission_overrides, modules |
| 27 | `audit_logs` | 11/04 | Tabela audit_logs centralizada |
| 28 | `attendance_improvements` | 11/04 | Setor, transferencia, historico expandido |
| 29 | `attendance_ticket_effects` | 11/04 | Efeitos visuais na chamada de senha |
| 30 | `attendance_sound_config` | 11/04 | Configuracao de som por setor |
| 31 | `attendance_panel_password` | 11/04 | Senha de acesso ao painel TV |
| 32 | `attendance_display_settings` | 11/04 | Settings do painel de exibicao |
| 33 | `attendance_feedback_questions` | 12/04 | Perguntas customizaveis de feedback |
| 34 | `branding_settings` | 12/04 | Categorias branding, navigation, content |
| 35 | `seo_settings` | 12/04 | Configuracoes SEO dinamico |
| 36 | `site_presets` | 12/04 | Save/restore de presets do site |
| 37 | `branding_fonts_cta` | 12/04 | Fontes e CTAs no branding |
| 38 | `testimonials_featured` | 12/04 | Flag de destaque em depoimentos |
| 39 | `testimonials_admin_policy` | 12/04 | RLS para admin em depoimentos |
| 40 | `sobre_estrutura_settings` | 12/04 | Conteudo das paginas Sobre e Estrutura |
| 41 | `students_expanded` | 13/04 | Campos expandidos de alunos |
| 42 | `student_import` | 13/04 | Import em lote de alunos |
| 43 | `rename_attendance_to_student_attendance` | 13/04 | Rename para disambiguar de attendance_tickets |
| 44 | `student_guardians` | 13/04 | Tabela N:N aluno-responsavel |
| 45 | `add_testimonials_module` | 13/04 | Modulo testimonials no seed |
| 46 | `financial_module` | 13/04 | Schema financeiro: plans, contracts, installments, gateways, logs |
| 47 | `financial_portal_rpc` | 14/04 | RPC get_pix_key() SECURITY DEFINER |
| 48 | `financial_notify_cron` | 14/04 | pg_cron job financial-notify-daily 08:00 BRT |
| 49 | `academic_disciplines_schedules` | 14/04 | Fase 9: disciplines, class_disciplines, class_schedules |
| 50 | `academic_calendar_formulas` | 14/04 | Fase 9: school_calendar_events, grade_formulas |
| 51 | `academic_results_transcripts` | 14/04 | Fase 9: student_results, student_transcripts |
| 52 | `academic_whatsapp_templates` | 14/04 | Seed categoria `academico` + 5 templates (nota-baixa, alerta-faltas, resultado-final, nova-atividade, prazo-atividade) |
| 53 | `financial_discounts_scholarships` | 14/04 | Tabelas `financial_discounts` e `financial_scholarships` com RLS |
| 54 | `financial_discounts_rpc` | 14/04 | RPC `calculate_applicable_discounts` (global/group/student + bolsas) |
| 55 | `financial_contract_templates` | 14/04 | Tabela `financial_contract_templates` (HTML body + variaveis) |
| 56 | `whatsapp_billing_templates` | 14/04 | Seed templates de cobranca (regua WhatsApp) |
| 57 | `financial_plans_grace_progressive` | 14/04 | DROP `punctuality_discount_pct`; ADD `grace_days` em plans; ADD `progressive_rules` JSONB em discounts; RPC com `payment_date` |
| 58 | `financial_plans_rename_max_overdue` | 14/04 | Rename `grace_days` → `max_overdue_days` (0-90); semantica de prazo maximo no portal antes da cobranca extrajudicial |
| 59 | `drop_contract_discount` | 14/04 | DROP `discount_type` / `discount_value` de `financial_contracts`; fonte unica de desconto = modulo Descontos |
| 60 | `financial_contracts_signed_documents` | 14/04 | Suporte a documentos assinados em contratos financeiros |
| 61 | `school_series_hierarchy` | 15/04 | PR1 — tabela `school_series` + `series_id NOT NULL` em `school_classes` + rename `year → school_year` |
| 62 | `capacity_and_year_progression` | 15/04 | PR2 — trigger `check_class_capacity` + RPCs `create_student_with_capacity`, `move_student_with_capacity`, `suggest_year_progression` |
| 63 | `financial_series_scope` | 15/04 | PR3 — `financial_plans.series_ids[]`, `financial_discounts.series_id`, RPC `calculate_applicable_discounts` reescrita derivando series/segment via JOIN com prioridade student → class → series → segment → plan → global |
| 64 | `fix_whatsapp_category_variables` | 15/04 | Corrige arrays `variables` nas categorias `academico` e `financeiro` do `whatsapp_template_categories`; as variaveis corretas agora correspondem ao `MODULE_VARIABLES` do frontend |
| 65 | `attendance_no_show_auto` | 15/04 | Funcao `mark_appointment_no_shows()` SECURITY DEFINER: lê `no_show_config` de `system_settings`, marca `no_show` agendamentos passados conforme timeout configuravel; pg_cron job `no-show-checker` a cada 15 min (manual no Supabase SQL) |
| 66 | `student_photo` | 15/04 | ADD COLUMN `photo_url TEXT` em `students`; bucket `student-photos` (publico, 5 MB, image/*) com 4 policies RLS (anon read, auth insert/update/delete) |

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

### 7.5 Tabelas Planejadas (Fases 9-12)

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

#### Modificacoes em Tabelas Existentes (Fases 9-12)

| Tabela | Campo adicionado | Tipo | Fase | Motivo |
|--------|-----------------|------|------|--------|
| `activities` | `discipline_id` | UUID FK | 9 | Vinculo a tabela `disciplines` |
| `student_attendance` | `school_calendar_event_id` | UUID FK | 9 | Vinculo a feriados/eventos |
| `student_attendance` | `lesson_plan_id` | UUID FK | 12 | Vinculo ao plano de aula (chamada integrada ao diario) |
| `whatsapp_template_categories` | 4 novas categorias seed | — | 9-11 | academico, ocorrencia, responsavel, secretaria |

> **Nota**: Campos financeiros (`students.status`, `students.school_year`, `financial_*.gateway_id`, etc.) ja aplicados na migration 46. Categoria `financeiro` ja seedada.

---

## 8. Edge Functions

### 8.1 Edge Functions Implementadas (16)

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
| `financial-notify` | Trigger secret (pg_cron) | — | Regua de cobranca automatica diaria (08:00 BRT); le billing_stages configuravel; agrupa por etapa em campanha via UazAPI `/sender/advanced`; dedup via `financial_notification_log` |
| `payment-gateway-proxy` | JWT (admin+) | — | Proxy multi-gateway com Adapter Pattern; acoes: createCustomer, createCharge, getCharge, cancelCharge; adapters: Asaas (V1) |
| `payment-gateway-webhook` | Secret URL param | — | Recebe webhooks de gateways; normaliza via adapter; atualiza installments; idempotente via `gateway_webhook_log`; verify_jwt=false |

**Rate Limiting**: Endpoints publicos usam rate limiter in-memory com sliding window por IP (`_shared/rate-limit.ts`). Resposta 429 inclui headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Endpoints protegidos por JWT nao precisam de rate limiting adicional.

### 8.2 Edge Functions Planejadas (Fases 9-12)

| Funcao | Auth | Rate Limit | Fase | Descricao |
|--------|------|------------|------|-----------|
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

### 9.3 Admin — Rotas Implementadas (18 rotas)

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
| `/admin/financeiro` | FinancialPage (tab rail: Dashboard, Planos, Contratos, Cobrancas, Descontos, Bolsas, Templates) | admin+ |
| `/admin/area-professor` | TeacherAreaPage | admin+, teacher |
| `/admin/biblioteca` | LibraryPage | admin+, teacher |
| `/admin/comunicados` | AnnouncementsPage | admin+, teacher |
| `/admin/eventos` | EventsPage | admin+, teacher |
| `/admin/usuarios` | UsersPage | super_admin, admin |
| `/admin/configuracoes` | SettingsPage | super_admin, admin |

*admin+ = super_admin, admin, coordinator*

### 9.4 Portal do Aluno — Rotas Implementadas (10 rotas)

| Rota | Componente |
|------|-----------|
| `/portal/login` | LoginPage |
| `/portal` | DashboardPage |
| `/portal/atividades` | ActivitiesPage |
| `/portal/notas` | GradesPage |
| `/portal/grade` | GradePage (grade horaria pessoal — Fase 9) |
| `/portal/comunicados` | AnnouncementsPage |
| `/portal/biblioteca` | LibraryPage |
| `/portal/eventos` | EventsPage |
| `/portal/financeiro` | FinanceiroPage |
| `/portal/perfil` | ProfilePage |

### 9.5 Admin — Rotas Planejadas (8 novas)

> **Nota Fase 9**: As rotas de Disciplinas, Grade Horaria, Calendario Letivo e Boletim foram implementadas como **abas internas** de `/admin/academico` (nao como rotas separadas). O redirect `/admin/segmentos` → `/admin/academico` tambem esta ativo.

| Rota | Modulo | Roles | Fase |
|------|--------|-------|------|
| `/admin/ocorrencias` | Ocorrencias | admin+, teacher | 10 |
| `/admin/autorizacoes` | Autorizacoes | admin+ | 10 |
| `/admin/diario` | Diario de Classe — leitura e alertas | coordinator, admin+ | 10.P |
| `/admin/provas` | Provas criadas pelos professores | coordinator, admin+ | 10.P |
| `/admin/secretaria/declaracoes` | Declaracoes | admin+ | 11 |
| `/admin/secretaria/saude` | Fichas de Saude | admin+ | 11 |
| `/admin/rematricula` | Campanhas de Rematricula | super_admin, admin | 11 |
| `/admin/secretaria/transferencias` | Transferencias | admin+ | 11 |
| `/admin/objetivos` | Objetivos de Aprendizagem / BNCC | admin+, coordinator | 12 |

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

### 9.7 Portal do Aluno — Rotas Planejadas (1 nova)

> **Nota Fase 9**: `/portal/grade` ja foi implementada e movida para a secao 9.4.

| Rota | Pagina | Fase |
|------|--------|------|
| `/portal/diario` | DiarioPage — conteudo das aulas (read-only) | 10.P |

### 9.8 Portal do Professor — Rotas Planejadas (9 rotas — Fase 10.P)

> Portal separado do Portal do Aluno (`/portal/*`). Autenticacao propria via Supabase Auth com `role = 'teacher'`. Professor acessa apenas suas turmas e disciplinas vinculadas.

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/professor/login` | LoginPage | Autenticacao com e-mail + senha (role=teacher) |
| `/professor` | DashboardPage | Turmas do dia, alertas pendentes, resumo semanal |
| `/professor/turmas` | TurmasPage | Lista de turmas e disciplinas vinculadas |
| `/professor/turmas/:classId/diario` | DiarioPage | Entradas do diario da turma em ordem cronologica |
| `/professor/turmas/:classId/diario/:entryId` | DiarioEntradaPage | Edicao: presenca + conteudo + atividades |
| `/professor/turmas/:classId/notas` | NotasPage | Grade de notas por atividade; media calculada |
| `/professor/planos` | PlanosPage | CRUD de planos de aula (draft → published → executed) |
| `/professor/provas` | ProvasPage | Criador de provas com questoes e exportacao PDF |
| `/professor/turmas/:classId/alunos/:studentId` | AlunoPerfilPage | Historico individual: presenca + notas + observacoes |

---

## 10. Roadmap de Desenvolvimento

### 10.1 Visao Geral das Fases

| Fase | Nome | Status | Prioridade | Dependencias |
|------|------|--------|------------|--------------|
| 1-5 | Fundacao (site, admin, portal, atendimento, CRM) | ✅ Concluido | — | — |
| 6 | Governanca e Escala (permissoes, modulos, audit) | ✅ Concluido | — | 1-5 |
| 7 | Whitelabel (personalizacao total, multi-tenant) | ✅ Concluido | — | 6 |
| 8 | Modulo Financeiro | ✅ Concluido | Critica | 7 |
| 8.5 | ERP Financeiro Completo (Caixas, A/R, A/P, Relatorios) | ✅ Concluido (migrations 67-73, 2026-04-15) | Alta | 8 |
| 9 | Academico Completo | ✅ Concluido (UI + backend + WhatsApp) | Critica | 7 |
| 9.M | Migracao Arquitetural: Seguimento→Serie→Turma | ✅ Concluido (migrations 61-63, 2026-04-15) | Critica | 1-5 (gap) |
| 9.5 | Dashboards Analiticos (Financeiro + Academico) | ⏳ Pendente | Alta | 8 + 9 |
| 10 | Portal do Responsavel | ⏳ Pendente | Critica | 8 + 9 + 9.M |
| 10.P | Portal do Professor / Diario de Classe | ⏳ Pendente | Alta | 9 + 9.M *(paralelo a Fase 10)* |
| 11 | Secretaria Digital | ⏳ Pendente | Alta | 10 |
| 12 | Modulo Pedagogico Avancado (BNCC + Relatorios) | ⏳ Pendente | Media | 9 + 10.P |
| 13 | IA e Analytics | ⏳ Pendente | Media | 8 + 9 + 10 |

**Dependencias**: Fase 9.5 pode ser desenvolvida imediatamente (8+9 concluidos). Fases 10 e 10.P compartilham as mesmas dependencias (9+9.M) e devem ser desenvolvidas **em paralelo** — o Portal do Professor gera os dados (frequencia, notas, conteudo) que o Portal do Responsavel exibe. Fase 11 depende de 10. Fase 12 (agora limitada a BNCC e relatorios avancados) depende de 10.P. Fase 13 depende de 8+9+10 (dados suficientes para insights).

**Pre-requisitos transversais** (antes das fases 9-12):
- ✅ Renomear tabela `attendance` → `student_attendance` (migration 43)
- ✅ Criar tabela `student_guardians` N:N (migration 44)
- ✅ Adicionar `testimonials` ao seed da tabela `modules` (migration 45)

---

### 10.2 Fases Concluidas (6-8)

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
| NavigationSettingsPanel — Links Rapidos com drag-to-reorder (`@dnd-kit/sortable`) | ✅ Concluido (2026-04-15) |
| Rotas publicas sem spinner de carregamento (`<Lazy fallback={null}>`) | ✅ Concluido (2026-04-15) |
| AcademicoPage — aba Segmentos com icone `GraduationCap` e label "Segmentos, Series e Turmas" | ✅ Concluido (2026-04-15) |
| Seed defaults (site_presets com preset base) | ✅ Concluido |

#### Multi-Tenancy: Upstream + Client Repos

Implementado em 12 de abril de 2026, refinado em 14 de abril de 2026 (sync merge-based, integracao Lovable Cloud). Detalhes na secao 2.3.

| Item | Status |
|------|--------|
| Genericizacao do codigo (remocao de dados hardcoded em 37+ arquivos) | ✅ Concluido |
| `src/config/client.ts` (defaults com env vars) | ✅ Concluido |
| `.env.example` (template para novos clientes, com instrucoes Lovable Cloud) | ✅ Concluido |
| Repo base `systemieven/school-platform` | ✅ Concluido |
| Upstream remote configurado | ✅ Concluido |
| Propagacao automatica (`.github/workflows/propagate.yml`, com skip de sync vazio) | ✅ Concluido |
| Sync manual (`.github/workflows/sync-upstream.yml`) | ✅ Concluido |
| Scripts de onboarding (`new-client.sh`, `push-migrations.sh`, `deploy-functions.sh`) | ✅ Concluido |
| Estrutura de branches `base` (upstream) + `main` (client) | ✅ Concluido |
| `push-all.sh` merge-based (sem rebase, sem force-push) | ✅ Concluido |
| Integracao Lovable Cloud para preview (credenciais Supabase injetadas) | ✅ Concluido |
| `.env` commitado em `main` (unica fonte para build publicado) | ✅ Concluido |

---

### 10.3 Fase 8 — Modulo Financeiro (CONCLUIDA)

> **Concluido em**: 14 de abril de 2026
> **Migrations**: 46, 47, 48, 53, 54, 55, 56, 57, 58, 59
> **Edge Functions**: financial-notify (v2), payment-gateway-proxy (v2), payment-gateway-webhook (v2)
> **Detalhes completos**: secao 4.17, `docs/PRD_ERP_COMPLEMENTAR.md` secao 3, `docs/PRD_FINANCEIRO_GATEWAYS.md`

| Item | Descricao | Status |
|------|-----------|--------|
| **Planos de Mensalidade** | CRUD com valor, parcelas, vencimento, multa, juros; `max_overdue_days` (slider 0-90) para prazo maximo no portal | ✅ Concluido (FinancialPlansPage) |
| **Contratos Financeiros** | Pipeline draft→active→concluded; geracao automatica de parcelas via RPC; descontos automaticos via modulo Descontos | ✅ Concluido (FinancialContractsPage) |
| **Parcelas e Cobrancas** | Listagem com filtros; registro de pagamento manual; KPIs; `amount_with_discount` no pagamento | ✅ Concluido (FinancialInstallmentsPage) |
| **Dashboard Financeiro** | 5 KPIs: receita, pendente, inadimplencia, **cobranca extrajudicial**, contratos ativos; 2 alertas (vencidos + extrajudicial) | ✅ Concluido (FinancialDashboardPage) |
| **Descontos** | CRUD com scopes (global/group/student); tipos % e R$; regras progressivas por antecipacao; validade; prioridade; cumulativo; RPC `calculate_applicable_discounts` | ✅ Concluido (FinancialDiscountsPage) |
| **Bolsas** | CRUD por aluno com pipeline de aprovacao; tipos full/%/fixo; vigencia; aplicacao automatica cumulativa | ✅ Concluido (FinancialScholarshipsPage) |
| **Templates de Contrato** | CRUD de templates HTML com variaveis, header/footer, versionamento por ano letivo | ✅ Concluido (FinancialTemplatesPage) |
| **Regua de Cobranca WhatsApp** | Etapas customizaveis CRUD (offset arbitrario); disparo por campanha via `/sender/advanced`; dedup | ✅ Concluido (FinancialSettingsPanel + financial-notify) |
| **Portal do Aluno — Financeiro** | 3 KPIs, filtros, copiar PIX, ver boleto; **bloqueio de pagamento apos `max_overdue_days`** (cobranca extrajudicial) | ✅ Concluido (FinanceiroPage) |
| **Gateway Asaas (V1)** | Adapter Pattern; proxy + webhook; idempotente | ✅ Concluido (AsaasAdapter deployed) |
| **Settings — Financeiro** | 3 cards: Gateways, Regua, PIX; floating save com dirty tracking | ✅ Concluido (FinancialSettingsPanel) |

**Decisoes de implementacao que divergiram do plano original:**

1. **Regua customizavel**: O plano previa 6 etapas fixas (D-5, D-1, D+0, D+3, D+10, D+30). A implementacao permite CRUD de etapas com offset arbitrario — cada escola define sua propria regua.
2. **Disparo por campanha**: O plano previa envio individual por parcela. A implementacao agrupa parcelas por etapa em campanha unica via UazAPI `/sender/advanced`, habilitando pause/resume/cancel via UI de Comunicados.
3. **Tab rail interno**: O plano previa 4 rotas separadas. A implementacao usa pagina unica `/admin/financeiro` com tab rail interna (padrao do sistema) — hoje com **7 abas**: Dashboard, Planos, Contratos, Cobrancas, Descontos, Bolsas, Templates.
4. **Relatorios financeiros dedicados**: Planejados mas adiados — funcionalidades basicas cobertas pelo ReportsPage existente.

**Adendos pos-entrega (refatoracoes de 14/04 — migrations 53-59):**

5. **Modulo Descontos expandido**: O plano previa apenas `financial_contracts.discount_type/value` como unica forma de desconto. A implementacao criou um modulo dedicado `financial_discounts` com scopes (global/group/student), validade, prioridade, cumulatividade e regras progressivas por antecipacao. O desconto de contrato foi removido (migration 59) — fonte unica de verdade.
6. **Descontos progressivos por antecipacao**: Regras JSONB `[{days_before_due, percentage}]` em `financial_discounts`. Aplicadas somente no momento do pagamento (a RPC `calculate_applicable_discounts` recebe `payment_date` + `due_date`; quando `NULL` no momento da geracao de parcelas, os progressivos sao ignorados).
7. **Prazo maximo no portal** (`max_overdue_days`, 0-90 dias, passo 10): substituiu semanticamente o antigo `grace_days` (migration 58). Representa o limite apos o qual a parcela entra em cobranca extrajudicial — nao e tolerancia de multa/juros.
8. **KPI Cobranca Extrajudicial**: adicionado ao dashboard (derivado client-side via join com `plan.max_overdue_days`). Nao estava previsto no PRD original — surgiu naturalmente da refatoracao do `max_overdue_days`.
9. **Bloqueio de pagamento no portal**: quando uma parcela vencida ultrapassa o prazo, o portal do aluno substitui o status por badge `Gavel + Extrajudicial` e remove botoes de pagamento (PIX, boleto, link), exibindo "Contate a secretaria da escola".
10. **Bolsas e Templates de Contrato**: ambos planejados no PRD ERP complementar mas nao listados na Fase 8 original — implementados em 14/04 (migrations 53 e 55).
11. **Remocao do `punctuality_discount_pct`**: coluna removida de `financial_plans` (migration 57). A semantica foi substituida por descontos progressivos em `financial_discounts.progressive_rules` — mais flexivel (multiplas faixas) e reutilizavel (global ou por grupo).

---

### 10.4 Fase 9 — Academico Completo

**Status**: ✅ Concluido — UI, backend e WhatsApp (categorias + variaveis corrigidas via migration 64)

**Objetivo**: Completar o modulo academico com disciplinas, grade horaria, calendario letivo, boletim formal com formula configuravel, resultado final e historico escolar.

**Dependencias**: Fases 7 e 8 (ambas concluidas)

#### 9.1 Sub-modulos

| Feature | Descricao | Prioridade | Status |
|---------|-----------|------------|--------|
| Disciplinas | CRUD com nome, codigo, carga horaria, cor, associacao por segmento, atribuicao turma+professor (class_disciplines) | Alta | ✅ Concluido |
| Grade Horaria | Cadastro por turma: dia x horario x disciplina x professor; visualizacao em grade; conflito de professor; export PDF | Alta | ✅ Concluido |
| Calendario Letivo | Periodos configuraveis (bimestres/trimestres/semestres); tipos de evento (holiday, exam_period, recess, deadline, institutional); visao mensal/anual | Alta | ✅ Concluido |
| Boletim Formal | Formula de media configuravel por segmento (simples, ponderada, por periodo, customizada); nota minima aprovacao/recuperacao; frequencia minima; escala numerica ou conceitual | Alta | ✅ Concluido |
| Resultado Final | Calculo automatico ao fechar periodo: aprovado/recuperacao/reprovado (nota)/reprovado (falta); tabela student_results | Alta | ✅ Concluido |
| Alertas de Frequencia | Calculo de % por disciplina/periodo/ano; alerta WhatsApp ao responsavel ao atingir X% de faltas; painel de alunos em risco | Media | ✅ Concluido |
| Historico Escolar | Registro automatico ao fechar ano letivo; visualizacao formal; export PDF; tabela student_transcripts | Media | ✅ Concluido |
| WhatsApp categoria `academico` | 5 templates: nota-baixa, alerta-faltas, resultado-final, nova-atividade, prazo-atividade; seed via migration 52 | Alta | ✅ Concluido (migration 52) |

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

### 10.4B Fase 9.5 — Dashboards Analiticos com Graficos Personalizaveis

**Objetivo**: Enriquecer os dashboards dos modulos Financeiro e Academico com KPIs contextuais, graficos nativos e uma area de graficos personalizaveis pelo usuario (tipo, fonte de dados, periodo), persistidos no banco como templates editaveis a qualquer momento.

**Dependencias**: Fases 8 e 9 concluidas (dados suficientes para analise). Pode ser desenvolvida em paralelo com itens restantes da Fase 9.

**Biblioteca de graficos**: Recharts `2.x` — instalar pinado sem caret (`"recharts": "2.15.0"`).

#### 9.5.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| **Financial Dashboard — Graficos** | Adicionar secao de graficos personalizaveis em `FinancialDashboardPage`, abaixo dos KPIs existentes; manter KPIs atuais intactos | Alta |
| **Academic Dashboard — Nova Aba** | Nova aba "Dashboard" como primeira aba de `AcademicoPage`; KPIs fixos + widget de eventos da semana + area de graficos personalizaveis | Alta |
| **ChartBuilderDrawer (compartilhado)** | Componente `src/admin/components/ChartBuilderDrawer.tsx`: drawer de criacao/edicao de widget; seletor de tipo (galeria de thumbnails), fonte de dados, periodo, titulo; salva em `dashboard_widgets` | Alta |
| **ChartWidget (compartilhado)** | Componente `src/admin/components/ChartWidget.tsx`: renderiza um widget a partir de sua config JSONB; busca dados de acordo com `data_source`; suporta todos os tipos de grafico | Alta |

#### 9.5.2 Componente ChartBuilderDrawer — UX

Drawer padrao (`<Drawer>` + `<DrawerCard>`) de 560px, footer com Cancelar + Salvar Widget (3 estados):

1. **Titulo** — campo de texto livre (`DrawerCard "Identificacao" icon={Tag}`)
2. **Tipo de grafico** — galeria de thumbnails 3-col com icones SVG miniatura (`DrawerCard "Tipo de Grafico" icon={BarChart2}`):
   - Barras verticais, Barras horizontais, Linha, Area preenchida, Pizza, Rosca, Metrica grande
3. **Fonte de dados** — select descritivo com label + descricao resumida do que o grafico mostra (`DrawerCard "Dados" icon={Database}`)
4. **Periodo** — select: Ultimos 3 meses, Ultimos 6 meses, Ultimo ano, Ano atual, Ano anterior (`DrawerCard "Periodo" icon={Calendar}`)

#### 9.5.3 UX do Painel de Graficos (em ambos os modulos)

- Grid responsivo: 1 col em tablet, 2 cols em desktop, 3 cols em wide (minimo 320px por widget)
- Botao `+ Adicionar Grafico` (icone `LayoutDashboard`) abre ChartBuilderDrawer
- Cada widget tem menu de acoes no hover: `Pencil` (editar) + `Trash2` (remover com confirmacao inline)
- Empty state: ilustracao + "Nenhum grafico adicionado. Clique em + Adicionar para comecar."
- Skeleton loading enquanto dados carregam (pulse animation)
- Altura fixa de 280px por widget para grid uniforme

#### 9.5.4 Academic Dashboard — KPIs Fixos (nao personalizaveis)

Sempre exibidos no topo, antes da area de graficos personalizaveis:

| KPI | Dado | Fonte |
|-----|------|-------|
| Taxa de ocupacao | Alunos matriculados / vagas totais das turmas | `school_classes` |
| Indice de frequencia | Media de % de presenca de todos os alunos ativos | `student_attendance` |
| Media geral | Media das medias finais do ultimo periodo fechado | `student_results` |
| Alertas ativos | Alunos com % frequencia abaixo do threshold configurado | `student_results` |
| Eventos esta semana | Contagem de eventos no calendário letivo nos proximos 7 dias | `school_calendar_events` |

Widget adicional fixo: **"Proximos Eventos"** — lista dos proximos 5 eventos do calendario letivo (icone por tipo, data relativa, cor da categoria). Link "Ver calendario" aponta para a aba Calendario Letivo.

#### 9.5.5 Fontes de Dados Disponiveis

**Modulo Financeiro** (`module = 'financeiro'`):

| data_source | Descricao | Tipos Sugeridos |
|-------------|-----------|-----------------|
| `revenue_by_month` | Receita recebida mes a mes (ultimos N meses) | bar, line, area |
| `overdue_trend` | Evolucao do valor inadimplente mes a mes | line, area |
| `contracts_by_segment` | Contratos ativos agrupados por segmento | pie, donut |
| `installments_status_dist` | Distribuicao de parcelas: pago/pendente/vencido/bloq. | pie, donut |
| `collection_funnel` | Pago vs Pendente vs Vencido (valor total por status) | bar_horizontal |
| `monthly_revenue_vs_overdue` | Receita recebida x inadimplencia por mes | bar (grouped) |

**Modulo Academico** (`module = 'academico'`):

| data_source | Descricao | Tipos Sugeridos |
|-------------|-----------|-----------------|
| `class_occupancy` | Ocupacao (%) por turma | bar |
| `attendance_by_class` | Indice medio de presenca por turma | bar |
| `grades_distribution` | Distribuicao de medias por faixa (0-4, 4-6, 6-8, 8-10) | bar, pie |
| `learning_curve` | Evolucao das medias gerais por periodo letivo | line, area |
| `alerts_by_severity` | Alertas de frequencia agrupados por nivel (critico/alerta/ok) | donut |
| `top_absences` | Top 5 turmas com mais faltas | bar_horizontal |

#### 9.5.6 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `dashboard_widgets` | 61 | Graficos personalizados por modulo; uma row por widget |

**Schema `dashboard_widgets`**:

```sql
CREATE TABLE dashboard_widgets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  module      text        NOT NULL CHECK (module IN ('financeiro', 'academico')),
  created_by  uuid        REFERENCES profiles(id),
  title       text        NOT NULL,
  chart_type  text        NOT NULL CHECK (chart_type IN (
                            'bar', 'bar_horizontal', 'line', 'area',
                            'pie', 'donut', 'metric'
                          )),
  data_source text        NOT NULL,
  config      jsonb       NOT NULL DEFAULT '{}',
  -- config contem: { period, color_scheme, show_legend, show_grid, ... }
  position    int         NOT NULL DEFAULT 0,
  is_visible  boolean     NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Acesso por school_id (multi-tenant)
CREATE POLICY "tenant_access" ON dashboard_widgets
  USING (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()));
```

#### 9.5.7 Arquivos a Criar / Modificar

**Novos**:

| Arquivo | Descricao |
|---------|-----------|
| `src/admin/components/ChartBuilderDrawer.tsx` | Drawer criacao/edicao de widget (compartilhado) |
| `src/admin/components/ChartWidget.tsx` | Renderizador de widget com Recharts (compartilhado) |
| `src/admin/pages/academico/AcademicoDashboardPage.tsx` | Nova aba Dashboard do modulo academico |
| `supabase/migrations/61_dashboard_widgets.sql` | Tabela + RLS |

**Modificados**:

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/pages/financial/FinancialDashboardPage.tsx` | Adicionar secao "Graficos" com grid de ChartWidgets + botao adicionar |
| `src/admin/pages/academico/AcademicoPage.tsx` | Inserir aba "Dashboard" (icon `LayoutDashboard`) como primeira tab |
| `package.json` | Adicionar `"recharts": "2.15.0"` (pinado, sem caret) |

#### 9.5.8 Verificacao

1. `npm install` apos adicionar recharts — build sem erros
2. Abrir `/admin/financeiro` → aba Dashboard → clicar "+ Adicionar Grafico" → criar widget "Receita por Mes" (bar, revenue_by_month, 12 meses) → confirmar row em `dashboard_widgets`
3. Recarregar pagina → widget persiste com dados reais
4. Editar widget → config atualizada no banco
5. Remover widget → row deletada
6. Abrir `/admin/academico` → primeira aba e "Dashboard" → KPIs carregam com dados das tabelas `school_classes`, `student_attendance`, `student_results`
7. Criar widget academico → persiste com `module = 'academico'`
8. Verificar que widgets financeiros NAO aparecem no dashboard academico (filtro por `module`)

---

### 10.4C Lacuna Arquitetural — Hierarquia Seguimento → Serie → Turma

> **Origem do gap**: Fases 1–5 (Fundacao) implementaram um modelo de **dois niveis** (`school_segments` → `school_classes`) que colapsou os conceitos de *serie* e *turma* em um unico registro. A regra de negocio real exige **tres niveis**. Esta lacuna foi identificada em 2026-04-15 e afeta diretamente as Fases 9.5, 10, 11 e 12.

**Status**: ✅ Concluido — entregue em 3 PRs aplicados em 2026-04-15. **PR1 (Backbone)** aplicado em 2026-04-15: migration 61 cria `school_series`, adiciona `series_id NOT NULL` em `school_classes`, renomeia `year → school_year`. UI de Segmentos refatorada para 3 niveis com novo `SeriesDrawer`. Cascata Segmento → Serie → Turma no `CreateStudentDrawer`. Pages academico e Teacher fazem JOIN em `school_series`. **PR2 (Regras de negocio)** aplicado em 2026-04-15: migration 62 cria trigger `check_class_capacity` (bloqueio em `max_students`, override via GUC `app.capacity_override`), RPCs `create_student_with_capacity` (insere com override + audit), `move_student_with_capacity` (UPDATE de `class_id` com override + audit), e `suggest_year_progression` (sugestao avanca/repete por agregado de `student_results`). Componente `CapacityOverrideModal` integrado a `CreateStudentDrawer` e a transicao `confirmed` em `EnrollmentsPage` (corrige bug de `class_id` ausente). Nova aba **Ano Letivo** em `/admin/academico` lista sugestoes de promocao com selecao de turma do ano-alvo. **PR3 (Financeiro por serie)** segue em sequencia.

#### O gap em numeros

| Item | Situacao atual | Situacao correta |
|------|---------------|------------------|
| Tabelas de hierarquia | 2 (`segments` → `classes`) | 3 (`segments` → `series` → `classes`) |
| Conceito de "serie" | Inexistente (embutido no nome da turma) | Tabela `school_series` dedicada |
| Nome da turma | "1º Ano A" (inclui serie e letra) | "A" (apenas letra; serie e separada) |
| Ano letivo na turma | campo `year` | renomear para `school_year` |
| Coordenadores | Array em `school_segments` | Correto — nenhuma mudanca |
| Limite de capacidade | `max_students` existe | Correto, mas falta regra de override |
| Progressao de serie | Sem modelo | Nova regra: avanca/repete por `student_results` |

#### 10.4C.1 Migracao Aplicada (migration 61) — ✅ PR1

Aplicada em ambiente limpo (`SELECT count(*) FROM school_classes` retornou 0), entao `series_id` ja entra como `NOT NULL` direto.

```sql
-- 1. Nova tabela school_series
CREATE TABLE school_series (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id  UUID        NOT NULL REFERENCES school_segments(id) ON DELETE RESTRICT,
  name        TEXT        NOT NULL,          -- "1º Ano", "Maternal I"
  short_name  TEXT,                          -- "1A", "Mat.I" (display compacto)
  order_index INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (segment_id, name)
);
CREATE INDEX idx_school_series_segment ON school_series (segment_id, order_index);
ALTER TABLE school_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on school_series" ON school_series FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','coordinator')));

-- 2. Adicionar series_id em school_classes (NOT NULL — ambiente limpo)
ALTER TABLE school_classes
  ADD COLUMN series_id UUID NOT NULL REFERENCES school_series(id) ON DELETE RESTRICT;
CREATE INDEX idx_school_classes_series ON school_classes (series_id);

-- 3. Renomear year -> school_year (consistencia com student_results.school_year)
ALTER TABLE school_classes RENAME COLUMN year TO school_year;
CREATE INDEX idx_school_classes_series_year ON school_classes (series_id, school_year);
```

#### 10.4C.2 Impacto em Tabelas Filhas

Nenhuma FK precisa mudar — todas apontam para `school_classes.id` que permanece estavel. Apenas a geracao do nome exibido e a navegacao hierarquica na UI mudam.

#### 10.4C.3 Regra de Override de Capacidade — ✅ PR2 (migration 62)

```
max_students atingido → trigger check_class_capacity bloqueia INSERT/UPDATE OF class_id
Erro: capacity_exceeded com HINT "class:<uuid> current:<n> max:<n>"
Override: GUC de sessao app.capacity_override = true (bypassa o trigger)
RPCs SECURITY INVOKER que setam o GUC e validam role:
  - create_student_with_capacity(payload jsonb, force boolean)
  - move_student_with_capacity(p_student_id, p_class_id, p_force boolean)
Roles autorizados: admin / super_admin (RAISE forbidden_override caso contrario)
UI: CapacityOverrideModal — admin ve botao "Autorizar e adicionar"; coordinator/teacher ve mensagem de bloqueio
Auditoria: log_audit('capacity_override', ...) com previous_count, max_students, class_id
```

#### 10.4C.4 Regra de Progressao de Serie — ✅ PR2 (migration 62)

Ao fechar o ano letivo (`student_results.result`):

| Resultado | Acao no proximo ano |
|-----------|---------------------|
| `approved` | Aluno avanca para a serie seguinte (order_index + 1, mesmo segment) |
| `recovery` | Repete a mesma serie ate que recuperacao seja resolvida |
| `failed_grade` / `failed_attendance` | Aluno repete a mesma serie |
| `in_progress` (resultado pendente) | `pending` — sem sugestao automatica |

Implementacao: RPC `suggest_year_progression(target_year int)` agrega resultados do `target_year - 1` e retorna `{ student, current_class, current_series, segment, overall_result, suggested_action, suggested_series_id }`. **Nao aplica nada** — admin confirma manualmente cada vinculacao via aba `/admin/academico → Ano Letivo` (componente `AnoLetivoPage`). A movimentacao final usa a RPC `move_student_with_capacity` que respeita o trigger de capacidade.

#### 10.4C.5 Arquivos a Criar / Modificar

**Novos**:

| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/00000000000061_school_series_hierarchy.sql` | Tabela + RLS + indice + FK em school_classes (✅ aplicada em 2026-04-15) |
| `supabase/migrations/00000000000062_capacity_and_year_progression.sql` | Trigger `check_class_capacity` + RPCs `create_student_with_capacity`, `move_student_with_capacity`, `suggest_year_progression` (✅ aplicada em 2026-04-15) |
| `src/admin/components/CapacityOverrideModal.tsx` | Modal de autorizacao de override + helper `parseCapacityError` |
| `src/admin/pages/academico/AnoLetivoPage.tsx` | Aba "Ano Letivo" com sugestoes de promocao via `suggest_year_progression` |

**Modificados**:

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/pages/school/SegmentsPage.tsx` | Expandir UI para 3 niveis: Seguimento → Series → Turmas |
| `src/admin/types/admin.types.ts` | Adicionar interface `SchoolSeries`; atualizar `SchoolClass` (campo `series_id`, `school_year`) |
| `src/admin/pages/school/CreateStudentDrawer.tsx` | Seletor de turma deve filtrar por ano letivo corrente |
| `src/admin/pages/academico/GradeHorariaPage.tsx` | Seletor de turma exibe serie + letra + ano |
| `src/admin/pages/academico/BoletimPage.tsx` | Idem |
| `src/admin/pages/academico/AlertasFrequenciaPage.tsx` | Idem |

#### 10.4C.6 Verificacao

1. Criar serie "1º Ano" no seguimento "Fundamental I" → row em `school_series`
2. Criar turma "A" vinculada a "1º Ano" com `max_students = 30` e `school_year = 2026`
3. Nome exibido na UI: "1º Ano A 2026"
4. Adicionar 30 alunos → 31º aluno bloqueado
5. Admin com role correto autoriza override → aluno adicionado + audit log com `override: true`
6. Ao fechar ano com `approved` → sistema sugere vincular aluno ao "2º Ano A 2027"

#### 10.4C.7 Granularidade Financeira por Serie — ✅ PR3 (migration 63)

A hierarquia de 3 niveis abre granularidade nova no modulo financeiro. Antes da migration 63, planos so podiam ser segmentados por `segment_ids[]` e descontos so cobriam `plan_id`/`segment_id`/`class_id`/`student_id` — a serie estava no "vacuo" entre segmento e turma.

**Schema (migration 63)**:

- `financial_plans.series_ids uuid[]` — vinculacao de plano a uma ou mais series. Coexiste com `segment_ids[]` (um plano pode marcar segmentos inteiros, ou apenas series especificas, ou ambos).
- `financial_discounts.series_id uuid REFERENCES school_series(id) ON DELETE CASCADE` — desconto pode ter escopo de serie (`scope = 'group'` + `series_id` preenchido).

**RPC `calculate_applicable_discounts` reescrita**:

A versao antiga referenciava `v_student.segment_id` — coluna que **nunca existiu** em `students` (ela so tem `segment text` legado e `class_id`). O bug nunca quebrou em prod porque a tabela esta vazia, mas a funcao ja chamada com aluno real teria erro de coluna inexistente.

A nova versao deriva `series_id` e `segment_id` via JOIN com `school_classes` (a fonte de verdade da hierarquia 3-niveis). Ordem de especificidade explicita no `ORDER BY`:

```
student → class → series → segment → plan → global
```

A flag `is_cumulative` continua determinando se descontos somam ou se apenas o primeiro (mais especifico) entra.

**UI (PR3)**:

- `FinancialPlansPage` — novo `DrawerCard "Series"` com chips multi-select agrupados por segmento. Cards de plano exibem chips de serie (purple) ao lado dos chips de segmento (blue).
- `FinancialDiscountsPage` — novo seletor "Serie" no escopo `group`, posicionado entre Segmento e Turma. Filtra serie pelo segmento escolhido (cascata) e turma pela serie escolhida. `scopeTargetLabel` agora inclui o nome da serie.
- `FinancialContractsPage` — display do contrato exibe `{serie} {turma} {ano_letivo}` derivado via `school_classes` (carregado em `classMap`).

**Compatibilidade**:

Migration 63 e aditiva — colunas com default vazio/null. Planos e descontos existentes continuam funcionando inalterados; series_ids/series_id sao opt-in.

---

### 10.4C Fase 8.5 — ERP Financeiro Completo ✅ Concluido (2026-04-15)

**Objetivo**: Expandir o Modulo Financeiro (Fase 8) para cobrir o ciclo financeiro completo da instituicao — controle de caixas, movimentacoes avulsas, contas a receber geral (nao apenas mensalidades), contas a pagar, plano de contas hierarquico e relatorios gerenciais.

**Dependencias**: Fase 8 concluida | **Status**: ✅ Concluido — migrations 67-73 aplicadas em 2026-04-15

#### 8.5.1 Sub-modulos Entregues

| Feature | Descricao |
|---------|-----------|
| Plano de Contas | Hierarquia receita/despesa com parent_id; defaults de sistema (is_system=true) protegidos; gerenciado em Config → Financeiro |
| Formas de Pagamento | Lista configuravel em system_settings (key=payment_methods); editavel via Settings Panel |
| Controle de Caixas | Multiplos caixas por escola; ciclo abertura → sangria/suprimento → fechamento; saldo snapshot (balance_after) por movimento |
| Contas a Receber (A/R) | Separado de financial_installments (mensalidades mantidas); parcelamento automatico via RPC; recorrencia mensal/trimestral/anual; baixa manual com juros e multa; rastreamento de origem (manual/evento/matricula) |
| Contas a Pagar (A/P) | Despesas fixas e variaveis; parcelamento e recorrencia; baixa com comprovante; alertas por alert_days_before |
| Integracoes Automaticas | RPC create_enrollment_receivable: ao confirmar matricula → gera receivable com taxa de matricula; RPC create_event_receivables: ao publicar evento com taxa → gera receivable por participante |
| Relatorios Gerenciais | Sub-tabs: Fluxo de Caixa (view SQL), DRE Simplificado (por categoria), Inadimplencia (por faixa de atraso), Previsao Financeira (3 meses), Extrato por categoria/forma; exportacao CSV |

#### 8.5.2 Tabelas (Migrations 67-73)

| Tabela / Objeto | Migration | Descricao |
|----------------|-----------|-----------|
| `financial_account_categories` | 67 | Plano de contas hierarquico sem school_id (single-tenant) |
| `financial_cash_registers` | 68 | Caixas com status open/closed e current_balance |
| `financial_cash_movements` | 68 | Movimentacoes com balance_after snapshot e reference polimorfic |
| `financial_receivables` | 69 | A/R geral com parcelamento, recorrencia e source_type |
| `financial_payables` | 70 | A/P com category_type fixed/variable e alert_days_before |
| Permissoes (5 modulos) | 71 | financial-account-categories, financial-cash, financial-receivables, financial-payables, financial-reports-advanced |
| RPCs de integracao | 72 | create_enrollment_receivable, create_event_receivables |
| Views de relatorio | 73 | financial_cash_flow_view, financial_dre_view, financial_delinquency_view |

#### 8.5.3 Arquivos Frontend

| Arquivo | Descricao |
|---------|-----------|
| `FinancialCashPage.tsx` | Lista de caixas com abertura/fechamento, drawers de movimentacao e historico |
| `FinancialReceivablesPage.tsx` | KPIs, lista A/R, drawer de lancamento/baixa, parcelamento via RPC |
| `FinancialPayablesPage.tsx` | KPIs, alertas de vencimento, filtro fixo/variavel, baixa com comprovante |
| `FinancialReportsPage.tsx` | 5 sub-tabs com consultas SQL diretas + views + export CSV |
| `FinancialPage.tsx` | 4 novas tabs: Caixas, A Receber, A Pagar, Relatorios |
| `FinancialSettingsPanel.tsx` | Cards: Plano de Contas (CRUD hierarquico) + Formas de Pagamento |

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

### 10.5B Fase 10.P — Portal do Professor / Diario de Classe

**Objetivo**: Criar o portal dedicado ao professor com o Diario de Classe como nucleo — registro diario de aulas, presenca, conteudo, atividades, notas e provas — executado **em paralelo com a Fase 10** (Portal do Responsavel), pois os dados gerados aqui alimentam diretamente as visualizacoes do responsavel.

**Dependencias**: Fases 9 e 9.M concluidas (turmas com hierarquia 3 niveis, disciplinas, vinculos professor-turma-disciplina)

**Paralelo com**: Fase 10 — o Portal do Responsavel deve ser lancado ja consumindo os dados do Diario

#### 10.P.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Diario de Classe | Registro por aula: data, tipo, conteudo ministrado, objetivos, materiais, observacoes; vinculo opcional a plano de aula; visualizacao calendario com destaque de dias com registro | Alta |
| Registro de Presenca | Por entrada do diario: presente / ausente / justificado / atraso; marcar todos como presentes com 1 clique; calculo automatico de frequencia acumulada por aluno; alerta visual ao atingir limite minimo | Alta |
| Atividades e Notas | CRUD de atividades (exercicio, trabalho, prova, apresentacao, excursao, autoavaliacao); grade de notas por atividade; media calculada por peso configuravel; destaque para notas abaixo do minimo | Alta |
| Planos de Aula | Titulo, objetivo, competencias, conteudo programatico, metodologia, recursos, avaliacao prevista; status draft → published → executed; pre-preenchimento automatico do diario ao vincular plano | Alta |
| Elaboracao de Provas | Criador de provas com blocos e questoes (dissertativa, multipla escolha, verdadeiro/falso, associacao); pontuacao por questao com totalizacao automatica; gabarito para objetivas; exportacao PDF para impressao | Media |
| Visao Consolidada (Turma) | Frequencia acumulada, media por atividade, progresso conteudo planejado vs. ministrado | Media |
| Visao Individual (Aluno) | Historico completo de presenca, notas e observacoes por turma e disciplina | Media |
| Alertas e Pendencias | Aulas sem presenca nos ultimos N dias; alunos com frequencia abaixo do minimo; atividades sem notas para todos os alunos; planos sem registro correspondente | Media |
| Leitura Admin/Coordenacao | Dashboard read-only dos diarios de todas as turmas; alertas de pendencias por professor | Alta |

#### 10.P.2 Melhorias e Integracoes Identificadas

| Oportunidade | Descricao | Quando Avaliar |
|-------------|-----------|----------------|
| **Alerta WhatsApp por frequencia** | Ao atingir limite, notificar responsavel automaticamente via categoria `academico` (liga 10.P → Fase 10) | Durante implementacao |
| **Importacao de notas via CSV** | Upload de planilha professor → parse → lancar notas em lote | Durante implementacao |
| **Travamento do diario** | Entrada editavel ate 48h apos criacao; apos isso, apenas coordinator/admin pode alterar (conformidade legal) | Pos-lancamento |
| **Calculo de media configuravel** | Por disciplina: media aritmetica / ponderada / maior nota / sistema EI-EP-EF | Durante implementacao |
| **Assinatura digital do diario** | Gerar PDF assinado do diario para fins legais | Fase futura |

#### 10.P.3 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `class_diary_entries` | 74 | Registro de aula: class_id, subject_id, teacher_id, entry_date, type, content, notes, lesson_plan_id |
| `diary_attendance` | 74 | Presenca por entrada: diary_entry_id, student_id, status (present/absent/justified/late), justification |
| `class_activities` | 75 | Atividades/avaliacoes: class_id, subject_id, teacher_id, title, type, activity_date, weight, max_score, diary_entry_id |
| `activity_scores` | 75 | Notas: activity_id, student_id, score, is_exempt, notes; UNIQUE (activity_id, student_id) |
| `lesson_plans` | 76 | Planos de aula: class_id, subject_id, teacher_id, title, objective, competencies[], content, methodology, resources, assessment, planned_date, status (draft/published/executed/cancelled) |
| `class_exams` | 77 | Provas: class_id, subject_id, teacher_id, title, instructions, exam_date, total_score, activity_id |
| `exam_questions` | 77 | Questoes: exam_id, block_number, question_number, type (dissertativa/multipla_escolha/verdadeiro_falso/associacao), stem, options (JSONB), correct_answer, score |
| Permissoes | 78 | Modulos teacher-diary, teacher-activities, teacher-lesson-plans, teacher-exams; professor: CRUD proprias turmas; coordinator: read-only todos; admin: full |

> **Nota**: `lesson_plans` absorve e expande a migration 34 originalmente planejada para Fase 12. A Fase 12 NAO tera mais migration propria para planos de aula.

#### 10.P.4 RLS e Seguranca

```
class_diary_entries: professor ve/edita apenas registros onde teacher_id = auth.uid()
diary_attendance:    cascateia da entry (professor so ve presenca das proprias aulas)
class_activities:    professor ve/edita apenas activities onde teacher_id = auth.uid()
activity_scores:     cascateia da activity
lesson_plans:        professor ve/edita apenas os proprios planos
class_exams:         professor ve/edita apenas as proprias provas
exam_questions:      cascateia do exam
Coordinator/Admin:   SELECT em tudo (via profiles.role)
```

#### 10.P.5 Rotas

9 rotas no Portal do Professor — ver secao 9.8.

#### 10.P.6 Rotas Admin (leitura)

| Rota | Descricao |
|------|-----------|
| `/admin/diario` | Diario de todas as turmas — read-only (coordinator, admin+) |
| `/admin/provas` | Provas criadas pelos professores — read-only (coordinator, admin+) |

#### 10.P.7 WhatsApp

Reutiliza categoria `academico` existente (cor: `#065f46`).

| Evento | Destinatario | Template |
|--------|-------------|---------|
| Aluno atinge limite de faltas | Responsavel | `frequencia-alerta` |
| Nota lancada para atividade (opcional, configuravel) | Responsavel | `nota-lancada` |

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

### 10.7 Fase 12 — Modulo Pedagogico Avancado

**Objetivo**: Complementar o Diario de Classe (Fase 10.P) com objetivos de aprendizagem referenciados na BNCC, associacao plano-objetivo e relatorios pedagogicos avancados para coordenadores.

**Dependencias**: Fases 9 e 10.P concluidas (requer dados do diario para calcular cobertura curriculo)

> **Nota**: O Diario de Classe, Planos de Aula e Elaboracao de Provas foram extraidos para a **Fase 10.P** (executada em paralelo com a Fase 10). A migration 34 originalmente planejada para esta fase foi absorvida pela migration 76 da Fase 10.P. Esta fase foca exclusivamente em BNCC e analytics pedagogico avancado.

#### 12.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Objetivos de Aprendizagem (BNCC) | CRUD por disciplina + segmento; referencia BNCC (codigo, habilidade, competencia); associacao ao plano de aula (N:N via lesson_plan_objectives); ativo/inativo | Media |
| Relatorio de Cobertura Curricular | Por turma/segmento: % objetivos trabalhados no periodo vs. total; quais objetivos nunca foram associados a um plano executado | Media |
| Relatorios Pedagogicos Avancados | Desempenho por turma (media diario vs. media notas), alunos em risco (frequencia + nota), evolucao individual, analise comparativa entre turmas do mesmo segmento, aulas registradas vs. previstas | Media |

#### 12.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `learning_objectives` | 79 | Objetivos de aprendizagem com BNCC: subject_id, segment_id, code, description, competency, is_active |
| `lesson_plan_objectives` | 79 | N:N lesson_plans x learning_objectives |

#### 12.3 Rotas Admin

| Rota | Descricao |
|------|-----------|
| `/admin/objetivos` | Objetivos de aprendizagem / BNCC (coordinator, admin+) |

#### 12.4 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `lesson_plans` (Fase 10.P) | Objetivos associados ao plano de aula |
| `class_diary_entries` (Fase 10.P) | Dados de frequencia e conteudo para relatorios |
| `activity_scores` (Fase 10.P) | Dados de notas para relatorios avancados |
| `grades` | Metricas pedagogicas nos relatorios |

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
| **Portal do Professor dedicado** | Elevado para **Fase 10.P** (secao 10.5B) — especificacao completa disponivel, dependencias satisfeitas, execucao paralela a Fase 10 | — | → Ver Fase 10.P |
| **2FA real via WhatsApp** | Geracao/verificacao de OTP com time-window; hoje so existe scaffold de categoria | Baixa | ⏳ Pendente |
| **Relatorios agendados** | Envio periodico por e-mail (mensal/trimestral) | Baixa | ⏳ Pendente |
| **OAuth para depoimentos** | Google e Facebook providers no Supabase Auth | Baixa | ⏳ Pendente |
| **Mascaramento de dados** | CPF e telefone parcial para roles restritas | Baixa | ⏳ Pendente |
| **Biblioteca Virtual publica** | Rota `/biblioteca-virtual` no site — decidir se migra para /portal/biblioteca | Baixa | ⏳ Pendente |
| **PWA / Mobile-First** | Layout responsivo mobile-first, manifest, service worker, push notifications. Concern transversal — ver `docs/PRD_PWA_MOBILE_FIRST.md` para detalhamento completo. Nao e uma fase isolada; cada fase deve entregar componentes mobile-ready | Media | ⏳ Pendente |

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

#### Regras de Interacao
- **Drawer-first**: Formularios de criar/editar usam o componente `<Drawer>` (painel lateral deslizante) em vez de modais centralizados. Modais somente quando ha telas sobrepostas que exigem bloqueio visual central (ex: confirmacao de acao destrutiva).
- **DrawerCard**: Dentro do Drawer, cada secao do formulario e envolvida por `<DrawerCard title="..." icon={...}>` com cabecalho cinza + corpo branco, seguindo o padrao visual do sistema.
- **Menu com tab rail interna**: Modulos com multiplas sub-secoes (Financeiro, futuro Academico, Secretaria, etc.) usam uma unica entrada no sidebar + tab rail interna colapsavel (padrao identico a Configuracoes). Evita sobrecarga do menu principal.
- **Hierarquia de navegacao**: Sidebar → pagina com tabs → drawers para CRUD. Nunca sidebar com 4+ itens para o mesmo modulo.

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

- **Repo base**: `systemieven/school-platform` — codigo generico, sem dados de cliente, nunca contem `.env`
- **Primeiro cliente**: `systemieven/batista-site` — upstream → school-platform, origin → batista-site
- **Branches locais (em cada clone)**:
  - `base` rastreia `upstream/main` — so codigo generico
  - `main` rastreia `origin/main` — `base` + `.env` do cliente + merge commits dos syncs
- **Areas do app**: site (`/`), admin (`/admin`), portal (`/portal`), atendimento (`/atendimento`), responsavel (`/responsavel` — planejado)
- **Propagacao automatica**: push em school-platform abre PR automaticamente nos clientes via `propagate.yml`
- **Push local unificado**: `./scripts/push-all.sh` (detecta branch e faz merge-based sync — sem rebase, sem force-push)
- **Lovable Cloud**: integracao Supabase injeta `VITE_SUPABASE_*` apenas no preview; o build publicado le do `.env` commitado em `main`

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
| `financeiro` | `#14532d` (verde escuro) | Cobrancas, inadimplencia, pagamento confirmado | ✅ Implementado |
| `academico` | `#1e3a5f` (azul escuro) | Notas, faltas, resultado final, atividades | ✅ Implementado (migration 52) |
| `ocorrencia` | `#7c2d12` (vermelho escuro) | Bilhetes/ocorrencias escolares | ⏳ Fase 10 |
| `responsavel` | `#4c1d95` (roxo escuro) | Portal do responsavel, senha temporaria | ⏳ Fase 10 |
| `secretaria` | `#374151` (cinza) | Declaracoes, rematricula | ⏳ Fase 11 |
