# PRD v3 — Plataforma Escolar (school-platform)

> **Versao**: 3.7
> **Data**: 18 de abril de 2026
> **Status**: Documento unificado — estado atual (Fases 1-15 concluidas, Sprints 6–13 concluidos, Sprint 13.N concluido, Sprint 14.S.P concluido, Sprint 14.S.P-bis concluido, Sprint 14.S.P-ter concluido, Sprint 13.IA + 13.IA-dash concluidos (ai_agents + orchestrator multi-provider + 4 workers integrados + dashboard de consumo real via Admin APIs), Sprint 13.IA.v2 concluido (infra proativa ai_insights + 7 agentes contextuais + AiContextualNudge + pg_cron hourly/6h/12h), migrations 153-206, **Fase 16 em progresso — PR1+PR2+PR3a concluídos, PR3 replanejado** (PR1: staff autônomo + promoção opt-in via edge functions `staff-grant-access`/`staff-revoke-access` + `ColaboradoresPage`; PR2: migrations 204+205 — `job_openings` + `candidates` + `job_applications` com RPC `promote_candidate_to_staff` + trigger AFTER UPDATE + `SeletivoPage` kanban com drag-and-drop + drawers de vaga e candidato com preview PDF, aplicado em produção; PR3: migration 206 — seed `resume_screener` + `resume_extractor` (Haiku 4.5 com prompt defensivo anti-injection) + `extractPdfText.ts` lazy wrapper sobre `pdfjs-dist` 4.2.67 + botão "Analisar com IA" no drawer do candidato integrado ao `ai-orchestrator`)) + roadmap ate v1 (F6.4 Documentação)
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
    - 10.4B Fase 9.5 — Dashboards Analiticos (✅ concluido)
    - 10.4D Fase 8.5 — ERP Financeiro Completo (CONCLUIDA)
    - 10.5 Fase 10 — Portal do Responsavel
    - 10.5B Fase 10.P — Portal do Professor / Diario de Classe (paralelo a Fase 10)
    - 10.6 Fase 11 — Secretaria Digital
    - 10.6B Fase 11.B — Portal do Responsavel + Modulo de Portaria
    - 10.6C Fase 11.C — Ficha de Saude Expandida
    - 10.7 Fase 12 — Modulo Pedagogico Avancado (BNCC) ✅
    - 10.8 Fase 13 — IA e Analytics
    - 10.9 Fase 14 — Loja, PDV e Estoque ✅
    - 10.9B Fase 14.F — Estrutura Fiscal de Produtos (NF-e Prep) ✅
    - 10.9C Fase 14.S — Emissao Automatica de NFS-e
    - 10.9D Fase 14.E — Modulo de Fornecedores
    - 10.10 Melhorias Transversais
    - 10.11 F6.4 Documentacao Tecnica (ultima etapa da v1)
    - 10.12 Fase 15 — Achados e Perdidos Digital ✅
    - 10.13 Central de Migracao de Dados — Onboarding
    - 10.14 Editor Visual de Templates HTML
    - 10.18 Auditoria & Hardening de Autenticacao dos 3 Portais ✅
    - 10.19 Carrinho Hibrido — localStorage + Supabase com Merge no Login ✅
    - 10.20 Primeiro Acesso do Aluno via Responsavel (v2) ✅
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
- **150 migrations** aplicadas sequencialmente (última numeração: 173 — gaps históricos nos slots 150-172)
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
- **Force change** no primeiro acesso (`students.must_change_password`, default `false` — admin marca via reset; migration 189). Gate em `StudentProtectedRoute` redireciona para `/portal/trocar-senha`.

### 3.3 Autenticacao do Responsavel (Fase 10 — implementada)

- **Credenciais regulares**: CPF + senha (Supabase Auth); e-mail ficticio `{cpf}@responsavel.portal` (sufixo configuravel via `CLIENT_DEFAULTS.guardian.email_suffix`).
- **Contexto React isolado**: `GuardianAuthContext` com `GuardianProtectedRoute`.
- **Multiplos filhos**: 1 responsavel ↔ N alunos via `student_guardians`; seletor de filho ativo no topo do portal.
- **Primeiro acesso / esqueci a senha** (mesmo fluxo unificado, edge function `guardian-request-access` `verify_jwt=false`):
  1. Responsavel informa CPF + telefone na tab "Primeiro acesso" de `/responsavel/login`.
  2. Edge function valida o par contra `student_guardians` (match liberal de DDI), checa `chat/check` na UazAPI e — se confirmado — gera senha provisoria, cria/atualiza `auth.users` + `guardian_profiles` (ou faz reset, no caso esqueci-a-senha) e marca `must_change_password=true`.
  3. Senha provisoria sai pelo template `senha_temporaria` via UazAPI `/send/text` direto da edge function (sem expor para o cliente).
  4. **Anti-enumeracao**: a mesma resposta generica cobre `cpf_not_found` e `phone_mismatch`. **Anti-abuso**: 3 envios bem-sucedidos/CPF/h e 10 tentativas/IP/10min auditados em `guardian_access_attempts` (migration 190).
  5. Numero sem WhatsApp → resposta especifica orientando procurar a secretaria (link `/agendar-visita`).
- **Force change**: `guardian_profiles.must_change_password` (default `true` desde a migration 75); gate em `GuardianProtectedRoute` redireciona para `/responsavel/trocar-senha`.

### 3.3B Autenticacao do Professor

- **Credenciais**: e-mail real + senha (Supabase Auth, mesmo `auth.users` do admin com `profiles.role='teacher'`).
- **Contexto React isolado**: `ProfessorAuthContext` com `ProfessorProtectedRoute`.
- **Force change**: reusa `profiles.must_change_password`; gate redireciona para `/professor/trocar-senha`.
- **Senha provisoria / reset**: hoje passa pelos mesmos `create-admin-user` / `reset-user-password` da gestao de usuarios admin. Fluxo dedicado de "esqueci a senha" no portal do professor (analogo ao do responsavel) ainda **⏳ pendente** — ver §10.18 step 3.

### 3.3C Tela compartilhada de troca obrigatoria

- Componente `src/shared/components/PortalChangePasswordPage.tsx` reutilizado pelos tres portais (aluno/responsavel/professor); cada portal expoe um wrapper fino em `pages/trocar-senha/TrocarSenhaPage.tsx` que injeta `session`, `signOut`, `clearMustChangePassword` e o `redirectTo` correspondente.
- Submissao chama o edge function `change-password`, que aplica a politica vigente em `system_settings.password_policy`, grava `password_history` e atualiza em paralelo `profiles.must_change_password`, `guardian_profiles.must_change_password` e `students.must_change_password` (zera o flag em qualquer dos tres conforme o user logado).

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

#### 4.17.11 Plano de Contas

> ✅ Concluído (migrations 67–73, 2026-04-14)

**Tabela**: `financial_account_categories`

Hierarquia pai/filho via `parent_id` (ate 2 niveis), tipos `receita` e `despesa`, codigo contabil opcional. Campo `is_system` protege registros padrao contra exclusao.

```sql
CREATE TABLE IF NOT EXISTS financial_account_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('receita', 'despesa')),
  parent_id   UUID        REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  code        TEXT,                              -- codigo contabil opcional (ex.: "1.1.1")
  is_system   BOOLEAN     NOT NULL DEFAULT FALSE, -- defaults protegidos: nao podem ser excluidos
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Defaults pre-inseridos (`is_system=true`): **Receitas** → Mensalidades, Taxas e Eventos, Matriculas, Outras Receitas; **Despesas Fixas** → Aluguel, Folha de Pagamento, Contratos de Servico; **Despesas Variaveis** → Material de Consumo, Eventos e Passeios, Manutencao.

**RLS**: admin/super_admin — CRUD completo; coordinator — somente leitura.

Gerenciado em **Configuracoes → Financeiro → Plano de Contas** com arvore hierarquica inline.

#### 4.17.12 Controle de Caixas

> ✅ Concluído (migrations 67–73, 2026-04-14)

**Tabelas**: `financial_cash_registers` e `financial_cash_movements`

Multiplos caixas por escola. Ciclo de vida: abertura (`opening`) → movimentacoes/sangria/suprimento → fechamento (`closing`).

```sql
CREATE TABLE IF NOT EXISTS financial_cash_registers (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT          NOT NULL,
  description          TEXT,
  responsible_user_id  UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  status               TEXT          NOT NULL DEFAULT 'closed'
                                     CHECK (status IN ('open', 'closed')),
  current_balance      NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_cash_movements (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id      UUID          NOT NULL REFERENCES financial_cash_registers(id) ON DELETE RESTRICT,
  type                  TEXT          NOT NULL CHECK (type IN (
                                        'opening', 'closing', 'sangria', 'suprimento', 'inflow', 'outflow'
                                      )),
  sub_type              TEXT          CHECK (sub_type IN (
                                        'recebimento', 'devolucao', 'taxa_evento',
                                        'taxa_passeio', 'taxa_diversa', 'despesa_operacional'
                                      )),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after         NUMERIC(12,2) NOT NULL,  -- snapshot do saldo apos este movimento
  description           TEXT          NOT NULL,
  payer_name            TEXT,
  payment_method        TEXT,         -- cash, pix, credit_card, debit_card, transfer, boleto, other
  account_category_id   UUID          REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  event_id              UUID,         -- FK opcional para events
  reference_id          UUID,         -- FK polimórfica: receivable ou payable
  reference_type        TEXT          CHECK (reference_type IN ('receivable', 'payable')),
  receipt_url           TEXT,
  receipt_path          TEXT,
  recorded_by           UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  movement_date         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

**RLS**: acesso restrito a admin/super_admin; coordinators sem acesso (operacao sensivel).

#### 4.17.13 Contas a Receber

> ✅ Concluído (migrations 67–73, 2026-04-14)

**Tabela**: `financial_receivables` — ortogonal a `financial_installments` (mensalidades via contratos permanecem intactas). Cobre qualquer recebivel nao-contratual: taxas, eventos, manual, etc.

```sql
CREATE TABLE IF NOT EXISTS financial_receivables (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_name            TEXT          NOT NULL,
  payer_type            TEXT          NOT NULL DEFAULT 'external'
                                      CHECK (payer_type IN ('student', 'responsible', 'external')),
  student_id            UUID          REFERENCES students(id) ON DELETE SET NULL,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_category_id   UUID          REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  description           TEXT          NOT NULL,
  due_date              DATE          NOT NULL,
  payment_method        TEXT,
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'cancelled')),
  amount_paid           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at               TIMESTAMPTZ,
  late_fee_pct          NUMERIC(5,2)  NOT NULL DEFAULT 0, -- % multa por atraso
  interest_rate_pct     NUMERIC(5,4)  NOT NULL DEFAULT 0, -- % juros ao dia
  -- Parcelamento: registros filhos apontam para o pai via parent_id
  parent_id             UUID          REFERENCES financial_receivables(id) ON DELETE CASCADE,
  installment_number    INTEGER,
  total_installments    INTEGER,
  -- Recorrencia
  is_recurring          BOOLEAN       NOT NULL DEFAULT FALSE,
  recurrence_interval   TEXT          CHECK (recurrence_interval IN ('monthly', 'quarterly', 'yearly')),
  recurrence_end_date   DATE,
  -- Rastreabilidade de integracao
  source_type           TEXT          NOT NULL DEFAULT 'manual'
                                      CHECK (source_type IN ('manual', 'event', 'enrollment', 'cash_movement')),
  source_id             UUID,
  notes                 TEXT,
  created_by            UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

- **Parcelamento automatico**: `total_installments > 1` → RPC `generate_receivable_installments` cria registros filhos com `parent_id`
- **Recorrencia**: `is_recurring` + `recurrence_interval` + `recurrence_end_date`
- **Baixa com juros/multa**: calculados sobre `amount` no momento da liquidacao com base em `interest_rate_pct` (ao dia) e `late_fee_pct`
- **RLS**: admin/super_admin — CRUD; coordinator — somente leitura

#### 4.17.14 Contas a Pagar

> ✅ Concluído (migrations 67–73, 2026-04-14)

**Tabela**: `financial_payables` — despesas da escola com credores externos ou funcionarios.

```sql
CREATE TABLE IF NOT EXISTS financial_payables (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  creditor_name         TEXT          NOT NULL,
  creditor_type         TEXT          NOT NULL DEFAULT 'supplier'
                                      CHECK (creditor_type IN ('supplier', 'employee', 'other')),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  account_category_id   UUID          REFERENCES financial_account_categories(id) ON DELETE SET NULL,
  category_type         TEXT          NOT NULL CHECK (category_type IN ('fixed', 'variable')),
  description           TEXT          NOT NULL,
  due_date              DATE          NOT NULL,
  payment_method        TEXT,
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  amount_paid           NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at               TIMESTAMPTZ,
  receipt_url           TEXT,
  receipt_path          TEXT,
  -- Parcelamento: mesmo padrao de financial_receivables
  parent_id             UUID          REFERENCES financial_payables(id) ON DELETE CASCADE,
  installment_number    INTEGER,
  total_installments    INTEGER,
  -- Recorrencia
  is_recurring          BOOLEAN       NOT NULL DEFAULT FALSE,
  recurrence_interval   TEXT          CHECK (recurrence_interval IN ('monthly', 'quarterly', 'yearly')),
  recurrence_end_date   DATE,
  -- Alertas de vencimento
  alert_days_before     INTEGER       NOT NULL DEFAULT 3,
  notes                 TEXT,
  created_by            UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
```

- **Categorizacao**: `category_type` (`fixed`/`variable`) para classificacao fixa vs variavel no DRE
- **Alertas**: `alert_days_before` (padrao 3 dias) — banner de alerta na tela de A/P
- **Parcelamento e recorrencia**: mesmo modelo de A/R via `generate_payable_installments`
- **Baixa com comprovante**: `receipt_url` + `receipt_path`
- **RLS**: admin/super_admin — CRUD; coordinator — somente leitura

#### 4.17.15 Integracoes Automaticas

> ✅ Concluído (migrations 67–73, 2026-04-14)

RPCs `SECURITY DEFINER` que geram receivables automaticamente a partir de eventos do sistema:

| RPC | Trigger | Resultado |
|---|---|---|
| `create_enrollment_receivable(p_enrollment_id)` | Confirmar pre-matricula | 1 receivable com `source_type='enrollment'`; valor lido de `system_settings` (category=`financial`, key=`enrollment_fee`); retorna `NULL` se taxa = 0; idempotente |
| `create_event_receivables(p_event_id)` | Publicar evento com `registration_fee > 0` | 1 receivable por participante confirmado com `source_type='event'`; categoria padrao "Taxas e Eventos"; idempotente por `(source_id, student_id)` |

Ambas as RPCs verificam existencia antes de inserir (idempotencia) e usam a categoria padrao correta do plano de contas (`financial_account_categories`).

#### 4.17.16 Relatorios Gerenciais

> ✅ Concluído (migrations 67–73, 2026-04-14)

Tres views SQL consolidam dados de `financial_receivables`, `financial_payables`, `financial_cash_movements` e `financial_installments`:

| View | Descricao |
|---|---|
| `financial_cash_flow_view` | Entradas e saidas por data: A/R pagas + installments pagos + A/P pagas + movimentacoes de caixa (exceto snapshots de abertura/fechamento) |
| `financial_dre_view` | DRE simplificado — receitas vs despesas agrupadas por categoria do plano de contas com totais e contagem de lancamentos |
| `financial_delinquency_view` | Inadimplencia — receivables e installments vencidos em aberto, ordenados por `days_overdue` DESC |

Sub-tabs em `FinancialReportsPage`:

| Sub-tab | View/Fonte | Descricao |
|---|---|---|
| Fluxo de Caixa | `financial_cash_flow_view` | Entradas e saidas consolidadas com filtro de periodo |
| DRE Simplificado | `financial_dre_view` | Receitas vs Despesas por categoria do plano de contas |
| Inadimplencia | `financial_delinquency_view` | Devedores ordenados por dias em atraso |
| Previsao Financeira | Calculada client-side | Projecao de recebimentos e pagamentos futuros (`pending` do periodo) |
| Extrato por Categoria | Query direta | Movimentacoes filtradas por categoria do plano de contas |

Exportacao CSV disponivel em todas as sub-tabs. Filtros globais: periodo, categoria, forma de pagamento.

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

**Modelo efetivo (migrations 26, 143, 144, 145, 146, 148, 149):**

1. **Base por role** — `role_permissions(role, module_key, can_view/create/edit/delete/import)` define o default da função.
2. **Override por usuário** — `user_permission_overrides(user_id, module_key, can_*, is_deny)`.
   - `is_deny = false` (default): override é **aditivo** sobre o role — concede capacidades extras.
   - `is_deny = true`: override é **subtrativo** — revoga as capacidades marcadas, vencendo o role.
3. **`super_admin` bypass** — sempre `true`, registrado em `audit_logs` via trigger (migration 144).
4. **`modules.is_active = false`** — desliga o módulo para todos os roles, inclusive admin (mas não super_admin).

**Função canônica:** `has_module_permission(user, module_key, action)` (SECURITY DEFINER, migration 144). Todas as RLS de tabelas sensíveis usam essa função — frontend (`PermissionsContext`) e backend têm a mesma fonte de verdade. ✅ Estendida para `audit_logs` na migration 149.

**Tenancy para role `teacher`** (migration 145): em `students`, `absence_communications` e `exit_authorizations`, teacher só enxerga/edita registros cujo `class_id` esteja em `class_disciplines` com `teacher_id = auth.uid()`. Admin/coordinator/super_admin não são afetados.

**Decomposição granular de Configurações (migration 148)** ✅: as 13 abas de `/admin/configuracoes` deixam de ser gateadas pela chave do módulo subjacente (ex.: `academico`, `nfse-config`) e passam a usar chaves dedicadas `settings-*` — `settings-institutional`, `settings-academico`, `settings-visits`, `settings-attendance`, `settings-ferramentas`, `settings-fiscal`, `settings-contact`, `settings-financial`, `settings-enrollment`, `settings-notifications`, `settings-security`, `settings-site`, `settings-whatsapp`. Seed concede apenas a `super_admin`; qualquer outro role (inclusive admin) precisa ser liberado explicitamente via UI de Permissões. Fecha o gap em que um professor com acesso ao módulo Acadêmico configurava períodos letivos e fórmulas de média.

**Higiene de overrides (migration 146)** ✅: elimina linhas "mirror" (override idêntico ao role default = no-op) e "phantom" (grant em módulo admin-only herdado de downgrade de role) deixadas pelo bug legado do save do EditUserDrawer. UI corrigida em `UsersPage.tsx` grava apenas o **diff** vs role default, nunca mais cria mirror/phantom.

**Realtime invalidation:** mudanças em `role_permissions`, `user_permission_overrides` ou `modules` disparam `postgres_changes` → `PermissionsContext` faz refetch debounced (250 ms). Sessões ativas perdem acesso em < 1 s sem refresh manual.

**Verificação:** `supabase/tests/permissions_verification.sql` executa fixtures + asserts em transação (ROLLBACK automático). Cobre mirror/phantom/deny/tenancy/bypass.

**Padrão anyModuleKeys — itens de menu umbrella (2026-04-17)** ✅: o campo `anyModuleKeys?: readonly string[]` em `NavItem` e a variante homônima em `ModuleGuard` implementam a semântica "OR granular" para páginas que agregam várias sub-tabs (Configurações, Gestão, Acadêmico, Loja, Secretaria). O item de menu e a rota ficam visíveis iff o usuário tem `view` em **ao menos uma** das chaves listadas; a própria página filtra suas tabs internamente por permissão. Código canônico em `src/admin/lib/umbrella-modules.ts` (`SETTINGS_SUBTAB_MODULE_KEYS`, `GESTAO_*`, `ACADEMICO_*`, `LOJA_*`, `SECRETARIA_*`, `FINANCIAL_*`). Elimina o bug em que um role com permissão granular num único sub-módulo (ex.: `academico`) via access também a todas as abas do umbrella que partilhavam a mesma chave (`settings`).

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

### 7.3 Migrations Aplicadas (102)

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
| 67 | `financial_account_categories` | 14/04 | Plano de contas hierarquico (financial_account_categories) |
| 68 | `financial_cash` | 14/04 | Caixas e movimentacoes de caixa (financial_cash_registers, financial_cash_movements) |
| 69 | `financial_receivables` | 14/04 | Contas a receber geral (financial_receivables) |
| 70 | `financial_payables` | 14/04 | Contas a pagar (financial_payables) |
| 71 | `financial_erp_permissions` | 14/04 | 5 novos modulos ERP financeiro inseridos em modules + role_permissions |
| 72 | `financial_integration_rpcs` | 14/04 | RPCs de integracao financeira (close_cash_register, link_installment_to_receivable) |
| 73 | `financial_report_views` | 14/04 | Views SQL de relatorios financeiros (dre, fluxo de caixa, inadimplencia) |
| 74 | `dashboard_widgets` | 15/04 | Graficos personalizaveis por modulo (financeiro / academico) — RLS via profiles.role |
| 75 | `guardian_portal` | 15/04 | Portal do Responsavel: guardian_profiles, student_occurrences, activity_authorizations, authorization_responses; adiciona role 'responsavel' |
| 76 | `guardian_permissions` | 15/04 | Modulos e role_permissions para Portal do Responsavel (Fase 10) |
| 77 | `class_diary` | 15/04 | Diario de Classe (Fase 10.P): class_diary_entries, diary_attendance |
| 78 | `class_activities` | 15/04 | Atividades e Notas (Fase 10.P): class_activities, activity_scores |
| 79 | `lesson_plans` | 15/04 | Planos de Aula (Fase 10.P): lesson_plans com vinculo a turma, disciplina e professor |
| 80 | `class_exams` | 15/04 | Elaboracao de Provas (Fase 10.P): class_exams, exam_questions |
| 81 | `teacher_portal_permissions` | 15/04 | Modulos e role_permissions para Portal do Professor (Fase 10.P) |
| 82 | `document_templates` | 15/04 | Declaracoes e Solicitacoes (Fase 11): document_templates (HTML + variaveis) e document_requests |
| 83 | `student_health` | 15/04 | Ficha de Saude do Aluno (Fase 11): student_health_records |
| 84 | `reenrollment` | 15/04 | Rematricula Online (Fase 11): reenrollment_campaigns, reenrollment_applications |
| 85 | `student_transfers` | 15/04 | Transferencias e Movimentacoes de Alunos (Fase 11): student_transfers |
| 86 | `secretaria_permissions` | 15/04 | Modulos e role_permissions para Secretaria Digital (Fase 11) |
| 87 | `fix_module_gaps` | 15/04 | Reinsere modulos das migrations 76, 81 e 86 que usaram coluna errada; adiciona absence_reason_options e authorized_persons |
| 88 | `absence_communications` | 15/04 | Comunicacoes de falta (Fase 11.B): modulo absence-communications |
| 89 | `exit_authorizations` | 15/04 | Autorizacoes de saida excepcional (Fase 11.B): authorized_persons, exit_authorization_requests |
| 90 | `portaria_permissions` | 15/04 | Modulos portaria e exit-authorizations (Fase 11.B) |
| 91 | `health_expanded` | 15/04 | Ficha de Saude Expandida (Fase 11.C): novos campos em student_health_records + student_medical_certificates + health_record_update_requests |
| 92 | `store_categories` | 16/04 | Fase 14 — Categorias da loja (store_categories) |
| 93 | `store_products` | 16/04 | Fase 14 — Produtos, variantes e imagens (store_products, store_product_variants, store_product_images) |
| 94 | `store_inventory` | 16/04 | Fase 14 — Movimentacoes de estoque (store_inventory_movements) |
| 95 | `store_orders` | 16/04 | Fase 14 — Pedidos e itens (store_orders, store_order_items) |
| 96 | `store_pickup_protocols` | 16/04 | Fase 14 — Protocolos de retirada (store_pickup_protocols) |
| 97 | `store_permissions` | 16/04 | Fase 14 — Modulos e role_permissions da loja (store-products, store-orders, store-pdv, store-inventory, store-reports) |
| 98 | `store_whatsapp_bucket` | 16/04 | Fase 14 — Categoria WhatsApp 'pedidos' + bucket product-images |
| 99 | `store_orders_payment_link` | 16/04 | Colunas payment_link, pix_code, boleto_url em store_orders |
| 100 | `store_order_whatsapp_templates` | 16/04 | 9 templates WhatsApp para pipeline de pedidos da loja |
| 101 | `webhook_store_order_support` | 16/04 | Coluna store_order_id em gateway_webhook_log para suporte a pagamentos de pedidos |
| 102 | `checkout_sessions` | 16/04 | Tabela checkout_sessions para checkout proprio /pagar/:token |
| 103 | `lost_found_tables` | 16/04 | Fase 15 — Tabelas lost_found_items e lost_found_events com RLS e trigger updated_at |
| 104 | `lost_found_permissions` | 16/04 | Fase 15 — Modulo lost-found no sistema de permissoes (super_admin/admin full, coordinator criar+editar, user criar+ver) |
| 105 | `lost_found_settings` | 16/04 | Fase 15 — Defaults em system_settings (tipos, locais, discard_days=30, show_photo=true) |
| 106 | `whatsapp_send_log` | 16/04 | Sprint 3 prep — Tabela whatsapp_send_log para deduplicacao cross-modulo de envios WhatsApp |
| 107 | `learning_objectives` | 16/04 | Fase 12 (Sprint 5) — learning_objectives (BNCC) + lesson_plan_objectives N:N; permissao objetivos-bncc |
| 108 | `webauthn` | 16/04 | Sprint 6 — webauthn_credentials + webauthn_challenges (TTL 5min) para biometria no Portal do Responsavel |
| 109 | `fiscal_profiles` | 16/04 | Fase 14.F (Sprint 7) — Perfis fiscais reutilizaveis (templates de configuracao tributaria); mesmos campos que product_fiscal_data exceto store_product_id |
| 110 | `product_fiscal_data` | 16/04 | Fase 14.F (Sprint 7) — Dados fiscais 1:1 com store_products (NCM, CST, aliquotas, gera_nfe, obs_fiscal, fiscal_profile_id FK nullable) |
| 111 | `company_fiscal_config` | 16/04 | Fase 14.F (Sprint 7) — Config singleton do emitente NF-e (dados do emitente, regime tributario, serie, numeracao, CFOPs padrao, integracao com provider) |
| 112 | `nfe_entry_items` | 16/04 | Fase 14.F (Sprint 7) — nfe_entries (cabecalho de importacao XML) + nfe_entry_items (itens com campos fiscais extraidos) |
| 113 | `fiscal_permissions` | 16/04 | Fase 14.F (Sprint 7) — Modulos store-fiscal e store-fiscal-config + role_permissions |
| 114 | `company_nfse_config` | — | Fase 14.S — Config singleton do emitente NFS-e: inscricao municipal, municipio de prestacao, ambiente, serie, proximo numero, aliq_iss_padrao, retencoes federais padrao, optante_simples, provider, token_api (criptografado), webhook_url, certificado_pfx (criptografado), senha_pfx (criptografada), status_integracao |
| 115 | `nfse_category_config` | — | Fase 14.S — Colunas de config NFS-e em financial_account_categories: gera_nfse BOOL, codigo_servico, cnae, item_lista_lc116, descricao_servico_template, aliq_iss, tem_retencao, aliq_pis_ret, aliq_cofins_ret, aliq_csll_ret, aliq_ir_ret, aliq_iss_ret |
| 116 | `guardian_fiscal_fields` | — | Fase 14.S — Campos fiscais em guardian_profiles: cpf_cnpj, tipo_pessoa (fisica/juridica), logradouro_fiscal, numero_fiscal, complemento_fiscal, bairro_fiscal, cep_fiscal, municipio_fiscal, uf_fiscal, email_fiscal; flag fiscal_data_complete gerada por trigger |
| 117 | `nfse_emitidas` | — | Fase 14.S — Tabela principal de NFS-e emitidas: numero, serie, data_emissao, competencia, tomador JSONB snapshot, descricao_servico, valor_servico, deducoes, valor_liquido, aliq_iss, iss_retido, iss_a_recolher, retencoes_federais JSONB, provider_nfse_id, link_pdf, xml_retorno TEXT, status (autorizada/cancelada/substituida/rejeitada/pendente), installment_id FK nullable, receivable_id FK nullable, categoria_id FK, substituida_por UUID FK nullable, emitida_por UUID FK, created_at |
| 118 | `nfse_emission_log` | — | Fase 14.S — Log imutavel de tentativas de emissao: nfse_id FK nullable, tentativa INT, iniciado_por UUID, iniciado_por_tipo (user/system), dados_enviados JSONB, resposta JSONB, codigo_retorno TEXT, status (success/error/pending), created_at |
| 119 | `nfse_permissions` | — | Fase 14.S — Modulos nfse-emitidas, nfse-config, nfse-apuracao + role_permissions |
| 120 | `nfse_whatsapp_templates` | — | Fase 14.S — Categoria WhatsApp 'fiscal' (cor verde-escuro) + templates nfse_autorizada e nfse_cancelada com variaveis link_nfse e numero_nfse |
| 121 | `fornecedores` | — | Fase 14.E — plano original (substituido por migrations 131–132 aplicadas) |
| 122 | `fornecedor_contas_bancarias` | — | Fase 14.E — plano original (substituido por migrations 131–132 aplicadas) |
| 123 | `fornecedores_fk_updates` | — | Fase 14.E — plano original (FKs e RPC integrados na migration 132) |
| 124 | `fornecedores_permissions` | — | Fase 14.E — plano original (permissoes integradas na migration 132) |
| 125 | `import_batches` | — | OP-1 — Lotes de importacao: module_key, file_name, template_id FK, status, records_total/imported/skipped/rejected, created_by, timestamps |
| 126 | `import_batch_logs` | — | OP-1 — Log linha a linha por lote: batch_id FK, row_index, row_data JSONB, rejection_reasons TEXT[] |
| 127 | `migration_module_status` | — | OP-1 — Estado de migracao por modulo (singleton por modulo): status (available/in_progress/completed/unlocked), last_batch_id FK, completed_at, unlocked_at, unlocked_by FK |
| 128 | `migration_permissions` | — | OP-1 — Modulo import-manager no grupo operacional, acesso exclusivo super_admin; can_import TRUE so para super_admin |
| 129 | `document_templates_align` | — | TV-1 — Alinha schema de document_templates com contract_templates: ADD COLUMN style_config JSONB DEFAULT '{}', converte variables TEXT[] para JSONB DEFAULT '[]', adiciona valores 'nfse_recibo' e 'recibo_pagamento' ao CHECK de document_type |
| 130 | `template_starter_seeds` | — | TV-1 — Seeds de templates iniciais: 1 contrato padrao, 1 recibo padrao, 1 declaracao_matricula padrao (HTML completo com cabecalho, rodape, logo, placeholders pre-populados) |
| 131 | `fornecedores` | 17/04 | Fase 14.E (Sprint 9) — Tabela principal de fornecedores: tipo_pessoa, cnpj_cpf, razao_social, nome_fantasia, ie, im, suframa, optante_simples, contatos, endereco completo, dados_fiscais, condicoes_comerciais, categoria, tags, status |
| 132 | `fornecedor_contas_bancarias` | 17/04 | Fase 14.E (Sprint 9) — Contas bancarias por fornecedor: banco, agencia, conta, tipo_conta, tipo_chave_pix, chave_pix, favorecido, is_default |
| 133 | `store_payment_surcharges` | 17/04 | Sprint 9.6 — Tabela store_payment_surcharges: acrescimo por forma de pagamento (tipo, percentual, valor_fixo, descricao, is_active) |
| 134 | `surcharges_permissions` | 17/04 | Sprint 9.6 — Modulo store-payment-surcharges + role_permissions; ADD COLUMN surcharge_amount em store_orders |
| 135 | `nfe_payable_bridge` | 17/04 | Sprint 9.6 — F-1: ADD COLUMN nfe_entry_id FK em financial_payables; trigger que cria A/P automaticamente ao importar NF-e de entrada (NfeEntradasPage → financial_payables) |
| 136 | `cash_movement_fixes` | 17/04 | Sprint 9.6 — F-2/F-3/F-6: ADD 'order' ao CHECK de reference_type em financial_cash_movements; corrige inserts de PDV, baixa A/R, baixa A/P e parcela paga para incluir cash_register_id e balance_after |
| 137 | `installments_start_month` | 17/04 | Sprint 9.6 — A-7: parametro p_start_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE) em generate_installments_for_contract; parcelas iniciam no mes da matricula |
| 138 | `webhook_receivable_bridge` | 17/04 | Sprint 9.6 — F-4: apos confirmar pagamento no payment-gateway-webhook, cria financial_receivables com source_type='store_order' e source_id=order_id via upsert idempotente (ON CONFLICT DO NOTHING) |
| 139 | `store_orders_cash_views` | 17/04 | Sprint 9.6 — F-5: inclui store_orders como fonte de receita em financial_cash_flow_view e financial_dre_view; A-6: filtro de school_year em AlertasFrequenciaPage |
| 140 | `academic_pipeline` | 17/04 | Sprint 9.7 — A-1: discipline_id no upsert de chamada (AttendanceTab); A-2: tabela exam_results (aluno x prova x nota); discipline_id e period em class_exams; A-4: trigger pos-insert em grades que dispara calculate-grades em background |
| 141 | `disciplines_canonical` | 17/04 | Sprint 9.8 — A-3: discipline_id em class_diary_entries; disciplines como tabela canonica; A-5: DiarioEntradaPage busca disciplinas de disciplines, salva discipline_id + subject_id, auto-sugere com base em class_schedules do dia |
| 142 | `whatsapp_templates_slug_names` | 17/04 | Slugs legíveis para templates WhatsApp |
| 143 | `user_permissions_additive_only` | 17/04 | Overrides aditivos only (revertido parcialmente na 144, que reintroduz `is_deny`) |
| 144 | `granular_rls_hardening` | 17/04 | **Auditoria de permissões** — helper `has_module_permission`, coluna `is_deny`, RLS reescrito em 13 tabelas críticas, fechamento de `USING(true)` do baseline, seeds de 9 chaves `academic-*`, trigger de bypass super_admin, realtime publication |
| 145 | `tenancy_scoping` | 17/04 | Helpers `is_admin_like` e `teacher_sees_student`; RLS de `students`/`absence_communications`/`exit_authorizations` escopado ao vínculo `class_disciplines.teacher_id` para role `teacher` |
| 146 | `cleanup_mirror_and_phantom_overrides` | 17/04 | ✅ Limpeza one-shot de overrides "mirror" (iguais ao role default) e "phantom" (grants admin-only em roles teacher/user/student) gerados pelo bug legado de save do EditUserDrawer. `UsersPage.tsx` pós-fix grava apenas o diff vs role default. |
| 147 | `fix_module_text_accents` | 17/04 | ✅ Correção de labels e descrições em `modules` (acentuação, cedilha, "Configurações" vs "Config ..."): Parcelas/Cobranças, Relatórios Financeiros, Ocorrências, Diário de Classe, Elaboração de Provas, Declarações, Rematrícula, Transferências, Configurações NFS-e/Loja/Fiscais, etc. |
| 148 | `settings_granular_modules` | 17/04 | ✅ **13 módulos `settings-*` granulares** — uma chave por aba de `/admin/configuracoes` (institutional, academico, visits, attendance, ferramentas, fiscal, contact, financial, enrollment, notifications, security, site, whatsapp). Seed concede apenas a super_admin; admins e demais roles recebem acesso via UI de Permissões. Desacopla "usar módulo" de "configurar módulo". |
| 149 | `audit_logs_rls_granular` | 17/04 | ✅ RLS de `audit_logs` usa `has_module_permission(auth.uid(), 'audit', 'view')` em vez de `profiles.role IN ('super_admin','admin')` hardcoded. Permite conceder `audit:view` a qualquer role pela UI com efeito imediato na leitura. |
| 150 | `data_migration_hub` | 17/04 | ✅ **Sprint 10 (OP-1)** — infraestrutura da Central de Migração: `import_runs` + `import_rows` + `import_templates`, lock por módulo, helpers de auditoria. Base para todos os importadores de `/admin/migracao`. |
| 151 | `segments_hierarchy_import_rows` | 17/04 | ✅ Hierarquia Segmentos → Séries → Turmas com unicidade por escopo; imports de Série/Turma exigem segmento já cadastrado. Suporta os wizards Sprint 10 PR2c. |
| 152 | `drop_appointments_from_migration` | 17/04 | ✅ Remove módulo `appointments` do escopo da Central de Migração (não vital em ERPs escolares — eventos são transacionais e vivem por fluxo, não por import em lote). |
| 153 | `push_subscriptions` | 17/04 | ✅ **Sprint 13.N.1** — Web Push: tabela `push_subscriptions` (endpoint UNIQUE, p256dh, auth, user_id, user_type, revoked_at, last_seen_at) com RLS (dono gerencia, admin SELECT/UPDATE). Seed `system_settings.push.vapid_public_key`. |
| 154 | `whatsapp_templates_send_push` | 17/04 | ✅ **Sprint 13.N.3** — flag `whatsapp_templates.send_push BOOLEAN DEFAULT true` habilita fan-out de push via `message-orchestrator` quando `auto-notify` dispara templates. |
| 155 | `increment_nfse_numero_rpc` | 17/04 | ✅ **Sprint 14.S.P.1** — RPC `increment_nfse_numero()` SECURITY DEFINER: reserva atomicamente o próximo número da NFS-e (UPDATE ... RETURNING) evitando race em emissões simultâneas. Executada pelo `nfse-emitter` antes de inserir em `nfse_emitidas`. |
| 156 | `nfse_auto_emit_on_payment` | 17/04 | ✅ **Sprint 14.S.P.2** — `company_nfse_config.auto_emit_on_payment BOOLEAN DEFAULT false` (disparo automático de NFS-e em baixa de parcela, via client-side em `handlePay`) + `nfse_emitidas.motivo_cancelamento TEXT` (gravado pela Edge Function `nfse-cancel`). |
| 157 | `company_nfce_config` | 17/04 | ✅ **Sprint 14.S.P-bis PR1** — Tabela singleton `company_nfce_config` para NFC-e (modelo 65): `ambiente`, `serie`, `proximo_numero`, `csc`, `id_csc`, `provider` ('nuvem_fiscal'\|'outro'), `api_token_enc`, `api_base_url`, `webhook_url`, `webhook_secret`, `integration_status`, `auto_emit_on_payment`. RLS admin/super_admin ALL + coordinator SELECT. Trigger `set_nfce_config_updated_at`. RPC atômica `increment_nfce_numero()` SECURITY DEFINER. Separada de `company_nfse_config` porque SEFAZ estadual ≠ prefeitura (ambientes/séries/credenciais independentes). |
| 158 | `nfce_emitidas` | 17/04 | ✅ **Sprint 14.S.P-bis PR1** — `nfce_emitidas` com FK `order_id` → `store_orders` (SET NULL), `chave_nfce`, `protocolo`, `emitente`/`consumidor`/`itens` JSONB, valores, `qrcode_url`, `link_danfe`, status (pendente/autorizada/cancelada/rejeitada/denegada/inutilizada), `motivo_rejeicao`, `motivo_cancelamento`. `nfce_emission_log` análogo ao NFS-e. RLS admin ALL + coordinator SELECT. Também adiciona `store_orders.consumer_cpf_cnpj` + `consumer_name` (opcionais — CPF padrão vem de `students.guardian_id` → `guardian_profiles.cpf`). |
| 159 | `company_nfe_config` | 17/04 | ✅ **Sprint 14.S.P-ter PR1** — Tabela singleton `company_nfe_config` para NF-e (modelo 55): `ambiente`, `serie`, `proximo_numero`, `provider` ('nuvem_fiscal'\|'outro'), `api_token_enc`, `api_base_url`, `webhook_url`, `webhook_secret`, `integration_status`, `last_test_*`. Sem CSC/idCSC (NF-e não usa QRCode SEFAZ) e sem `auto_emit` (operação sempre manual). RLS admin/super_admin ALL + coordinator SELECT. RPC atômica `increment_nfe_numero()` SECURITY DEFINER. Certificado A1 reaproveitado da NFS-e (mesmo CNPJ no vault Nuvem Fiscal). |
| 160 | `nfe_emitidas` | 17/04 | ✅ **Sprint 14.S.P-ter PR1** — `nfe_emitidas` com FK `nfe_entry_id` → `nfe_entries` (SET NULL), `tipo_operacao` CHECK ('devolucao') preparado para expansão futura, `chave_nfe`, `protocolo`, `emitente`/`destinatario`/`itens`/`transp`/`referencia` JSONB, valores, `link_danfe`, `link_xml`, status (pendente/autorizada/cancelada/rejeitada/denegada/inutilizada), `motivo_rejeicao`, `motivo_cancelamento`, `autorizada_em` (para check de janela SEFAZ de 24h). `nfe_emission_log` análogo. RLS admin ALL + coordinator SELECT. |
| 161 | `ai_agents` | 17/04 | ✅ **Sprint 13 PR1** — Tabela de agentes de IA configuráveis: `slug UNIQUE`, `name`, `description`, `provider` CHECK ('anthropic'\|'openai'), `model`, `system_prompt`, `user_prompt_template` (com `{{var}}` substituído no orquestrador), `temperature` (0-2), `max_tokens` (1-16384), `enabled`. Seed inicial de 4 agentes: `op1_mapping`, `attendance_triage`, `discount_suggestion`, `dashboard_insights`. RLS admin/super_admin ALL. Trigger `set_ai_agents_updated_at`. |
| 162 | `ai_usage_log` | 17/04 | ✅ **Sprint 13 PR1** — Log imutável de chamadas ao `ai-orchestrator`: `agent_slug`, `provider`, `model`, `caller_user_id`, `input_tokens`, `output_tokens`, `latency_ms`, `status` ('ok'\|'error'), `error_message`, `context_hash`. Índices em `created_at DESC` + `(agent_slug, created_at DESC)` para o painel de observabilidade. RLS admin/super_admin SELECT (inserts apenas via service_role nas edge functions). |
| 163 | `settings-ia` module | 17/04 | ✅ **Sprint 13 PR1** — Adiciona módulo granular `settings-ia` em `modules` (posição 213) + grant para super_admin em `role_permissions`. Padrão da migration 148. Libera aba "IA (Agentes)" em `/admin/configuracoes?tab=ia`. |
| 164 | `company_ai_config` | 17/04 | ✅ **Sprint 13 PR1.5** — Singleton (`UNIQUE INDEX ON ((true))`) com `anthropic_api_key TEXT`, `openai_api_key TEXT`, `updated_by`, timestamps + trigger `set_ai_config_updated_at`. RLS admin/super_admin ALL. Seed de linha vazia. Permite gerenciar as chaves de provider pela UI do admin (mesmo padrão dos providers fiscais), sem depender de secrets do dashboard Supabase. |
| 165 | `ai_usage_snapshots` | 17/04 | ✅ **Sprint 13.IA-dash PR1** — Snapshot diário por provider do consumo de IA: `provider` ('anthropic'\|'openai'), `snapshot_date DATE`, `tokens_input`/`tokens_output BIGINT`, `requests_count INT`, `total_spent_usd NUMERIC`, `raw_payload JSONB`, `fetched_at TIMESTAMPTZ`. UNIQUE `(provider, snapshot_date)`. RLS admin/super_admin SELECT (inserts apenas via service_role do `ai-billing-sync`). Colunas `balance_usd`/`auto_recharge_*` dropadas na migration 171 (provider não expõe saldo via API). |
| 166 | `ai_recharges` | 17/04 | ⚠️ **Dropada na 171** — Criada no PR1 para histórico de recargas (manual/auto/inferred) mas removida quando decidimos que recarga manual baseada em heurística de queda de `total_spent_usd` gerava falsa sensação de precisão (saldo é compartilhado entre workspaces/projetos e só é confiável no console do provider). |
| 167 | `company_ai_config` (alter) | 17/04 | ✅ **Sprint 13.IA-dash PR1** — Adiciona `anthropic_admin_api_key TEXT`, `openai_admin_api_key TEXT`, `openai_organization_id TEXT`, `balance_alert_threshold NUMERIC`. Chaves **admin** são separadas das chaves de inference (usadas em `ai-worker-*`). Coluna `balance_alert_threshold` dropada na migration 171. |
| 168 | RPC `ai_usage_stats` | 17/04 | ✅ **Sprint 13.IA-dash PR1** — RPC `ai_usage_stats(p_from, p_to, p_provider?, p_agent_slug?)` SECURITY DEFINER retornando JSON `{kpis, daily, top}` com agregações de `ai_usage_log` + custo estimado por modelo (tabela de preços embutida). Base do `AiUsageDashboard`. |
| 169 | `pg_cron` job | 17/04 | ✅ **Sprint 13.IA-dash PR1** — `cron.schedule('ai_billing_sync_daily', '1 0 * * *', ...)` dispara `ai-billing-sync` via `net.http_post` às 00:01 UTC, passando `x-trigger-secret` de `system_settings('internal','trigger_secret')`. |
| 170 | `company_ai_config` (alter) | 17/04 | ✅ **Sprint 13.IA-dash PR3** — Adiciona `anthropic_workspace_id TEXT`. Quando informada, o `ai-billing-sync` envia `workspace_ids[]=<id>` para a Anthropic Admin API, escopando o consumo a um Workspace específico em vez da organização inteira. UI no campo "Workspace ID (opcional)" no card "Chaves de API" do `AiAgentsPanel`. |
| 171 | `ai_drop_balance_tracking` | 17/04 | ✅ **Sprint 13.IA-dash PR3** — `DROP TABLE ai_recharges CASCADE` + remove colunas `balance_usd`/`auto_recharge_enabled`/`auto_recharge_threshold`/`auto_recharge_amount` de `ai_usage_snapshots` + `balance_alert_threshold` de `company_ai_config`. Motivo: nem Anthropic nem OpenAI expõem saldo via Admin API (só usage + cost). Manter cards de "saldo estimado" baseado em recargas inferidas passava falsa precisão — saldo real é compartilhado entre workspaces/projetos e só confiável no console do provider. Dashboard mantém apenas `total_spent_usd`, `tokens_input/output`, `requests_count` (dados reais do `cost_report`). |
| 174 | `ai_insights` | 17/04 | ✅ **Sprint 13.IA.v2 PR1** — Caixa de entrada do assistente proativo: `agent_slug FK ai_agents`, `severity` CHECK ('low'\|'medium'\|'high'\|'critical'), `status` CHECK ('new'\|'seen'\|'dismissed'\|'resolved'), `audience TEXT[]`, `recipient_id FK profiles` (personal), `related_module/entity_type/entity_id`, `title`, `summary`, `payload JSONB`, `actions JSONB`, `context_hash`, timestamps. UNIQUE INDEX `(agent_slug, context_hash) WHERE status='new'` para dedup. GIN em audience, índice por status+severity. RLS: admin/coordinator ALL, teacher por `audience && ['teacher']`, guardian/student por `recipient_id=auth.uid()`. INSERT só via service_role. Publicada em `supabase_realtime`. |
| 175 | `ai_event_bindings` | 17/04 | ✅ **Sprint 13.IA.v2 PR1** — Mapeia `event_type → agent_slug` com `debounce_hours` e `enabled`. UNIQUE `(event_type, agent_slug)`. RLS admin-only. Alter `ai_agents` adicionando `run_on_login BOOL`, `run_on_event TEXT[]`, `run_on_cron TEXT`, `debounce_hours INT`, `audience TEXT[]` — suporte a disparos proativos (event-driven + cron + pre-compute no login). |
| 176 | `calculate_academic_risk_rpc` | 17/04 | ✅ **Sprint 13.IA.v2 PR2** — RPC `calculate_academic_risk(student_id)` SECURITY DEFINER agregando frequência últimos 30 dias, notas mais baixas do bimestre corrente e justificativas recentes. Consumida pelo agente `academic_pulse` e disponível para invocação manual. |
| 177 | `academic_pulse_seed` | 17/04 | ✅ **Sprint 13.IA.v2 PR2** — Seed do agente `academic_pulse` (provider Anthropic Haiku 4.5, `run_on_cron='hourly'`, audience `['coordinator','teacher']`, `debounce_hours=1`) + binding `cron.academic_pulse` em `ai_event_bindings`. Varre alunos ativos e consolida riscos `>= medium` em insights por coordenador/professor. |
| 178 | `portal_agents_seed` | 17/04 | ✅ **Sprint 13.IA.v2 PR3** — Seed de 3 agentes dos portais: `student_study_buddy` (cron 6h, audience `['student']`, dicas de estudo + conteúdo corrente do diário); `guardian_pulse` (cron 12h, audience `['guardian']`, resumo de faltas/parcelas/eventos); `lost_found_match` (event-driven, audience `['student','guardian']`). |
| 179 | `lost_found_ai_trigger` | 17/04 | ✅ **Sprint 13.IA.v2 PR3** — Trigger AFTER INSERT em `lost_found_items` chamando `ai-event-dispatcher` via `net.http_post` (event_type `lost_found.new_item`). Segue padrão `notify_auto_trigger`. Condicional à existência da tabela para compatibilidade com ambientes antigos. |
| 180 | `financial_anomaly_rpcs` | 17/04 | ✅ **Sprint 13.IA.v2 PR4** — RPCs `delinquency_snapshot()` (agrega inadimplência por faixa + tendência 7/30 dias) e `admin_pulse_snapshot()` (KPIs cross-módulo: leads, matrículas, tickets abertos, alertas financeiros). Consumidas por `financial_anomaly_scout` e `admin_pulse`. |
| 181 | `admin_financial_agents_seed` | 17/04 | ✅ **Sprint 13.IA.v2 PR4** — Seed de `financial_anomaly_scout` (cron 1h + event-driven em `financial_installments.status`, audience `['admin']`) e `admin_pulse` (run_on_login + cron 1h, audience `['admin']`). Trigger AFTER UPDATE em `financial_installments.status` → `ai-event-dispatcher`. |
| 182 | `secretary_pulse_rpc_seed` | 17/04 | ✅ **Sprint 13.IA.v2 PR5** — RPC `detect_registration_issues()` (documentos expirando, matrículas incompletas, campos obrigatórios faltantes) + seed `secretary_pulse` (cron 1h, audience `['admin']`). |
| 183 | `ai_scheduled_runner_crons` | 17/04 | ✅ **Sprint 13.IA.v2 PR5** — 3 jobs `pg_cron` (`ai_runner_hourly` `3 * * * *`, `ai_runner_6h` `5 */6 * * *`, `ai_runner_12h` `7 */12 * * *`) disparando `ai-scheduled-runner` via `net.http_post` com `x-trigger-secret` de `system_settings('internal','trigger_secret')`. Cada job passa `{cadence}` no body; runner faz fan-out por cadência. Idempotente (unschedule prévio por jobname). |
| 184 | `dashboard_principal_widgets` | 18/04 | ✅ Estende CHECK de `dashboard_widgets.module` para incluir `'principal'` + nova tabela `dashboard_widget_prefs` (visibilidade/ordem dos widgets estáticos do registry). RLS espelhada da migration 74 (admin/super_admin edit, coordinator read). |
| 185 | `hr_modules_seed` | 18/04 | 🟡 **Fase 16 PR1** — Módulos granulares `rh-colaboradores` (grupo `rh`, icon `Users`, position 300) e `rh-seletivo` (icon `Briefcase`, position 301). Defaults em `role_permissions`: admin all true; coordinator colaboradores view/edit, seletivo só view; teacher/user tudo false. |
| 186 | `staff` | 18/04 | 🟡 **Fase 16 PR1** — Tabela standalone `staff` (independente de `profiles`): `profile_id UUID UNIQUE NULL FK profiles ON DELETE SET NULL`, dados pessoais (CPF UNIQUE, RG, CNH não, birth_date, email com CHECK de formato), endereço completo, `position NOT NULL`, `department`, `hire_date NOT NULL`, `termination_date`, `employment_type CHECK ('clt'|'pj'|'estagio'|'terceirizado')`, contato de emergência, avatar, `is_active`, notes. Trigger `sync_staff_to_profile_on_update` mantém `profiles.full_name/email/phone/avatar_url` espelhado enquanto `profile_id IS NOT NULL`. RLS: admin/super_admin ALL + demais roles via `get_effective_permissions('rh-colaboradores')` + self-service (`profile_id = auth.uid()`). |
| 188 | `fiscal_granular_modules` | 18/04 | ✅ Quebra `settings-fiscal` em 4 sub-módulos independentes (`settings-fiscal-nfe`, `settings-fiscal-nfse`, `settings-fiscal-nfce`, `settings-fiscal-perfis`) com defaults em `role_permissions`. UI de configurações reorganizada: NF-e (Produtos) e NF-e (Emissão) fundidas em "NF-e", "Perfis Fiscais" vira sub-aba. |
| 189 | `must_change_password_students` | 18/04 | ✅ **Auditoria Auth (step 1)** — `ALTER TABLE students ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false`. Alinha o portal do aluno com o flag já existente em `profiles` e `guardian_profiles`; `StudentAuthContext` carrega o campo e `StudentProtectedRoute` redireciona para `/portal/trocar-senha` quando `true`. Edge function `change-password` (v36) faz UPDATE em paralelo nas 3 tabelas conforme o user logado. |
| 191 | `teacher_access_attempts` | 18/04 | ✅ **Auditoria Auth (step 3)** — Tabela `teacher_access_attempts` (espelho da 190 com `email` em vez de `cpf`/`phone`; CHECK em `result`: `sent\|email_not_found\|no_phone\|no_whatsapp\|rate_limited\|whatsapp_send_failed\|invalid_input\|wa_not_configured`). Usada pelo edge function `professor-request-access` para rate-limit (3 envios/email/h, 10 tentativas/IP/10min) e auditoria. RLS habilitado sem policies — service_role only. |
| 190 | `guardian_access_attempts` | 18/04 | ✅ **Auditoria Auth (step 2)** — Tabela `guardian_access_attempts` (`cpf`, `phone`, `ip_address`, `user_agent`, `result CHECK (sent\|cpf_not_found\|phone_mismatch\|no_whatsapp\|rate_limited\|whatsapp_send_failed\|invalid_input\|wa_not_configured)`) usada pelo edge function `guardian-request-access` para rate-limit (3 envios/CPF/h, 10 tentativas/IP/10min) e auditoria. RLS habilitado sem policies — service_role only. |
| 192 | `store_carts` | 18/04 | ✅ **Carrinho Hibrido (§10.19)** — `store_carts(id UUID PK, guardian_id UUID UNIQUE NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE, items JSONB NOT NULL DEFAULT '[]', updated_at TIMESTAMPTZ DEFAULT now())`. Snapshot 1:1 do carrinho do responsavel autenticado. JSONB items: `{variantId, productName, variantDescription, sku, quantity, unitPrice}`. RLS: `guardian_id = auth.uid()` (`guardian_profiles.id` JA E `auth.users.id`); admin/super_admin SELECT separado. Trigger `set_updated_at`. |
| 193 | `student_access_attempts` | 18/04 | ✅ **Primeiro Acesso do Aluno v2 (§10.20)** — `student_access_attempts(id UUID PK, student_id UUID REFERENCES students(id) ON DELETE SET NULL, granted_by_guardian_user_id UUID, ip_address TEXT, user_agent TEXT, channel TEXT CHECK ('guardian_grant'\|'self_legacy'), result TEXT CHECK ('sent'\|'student_not_found'\|'no_guardian_phone'\|'no_whatsapp'\|'rate_limited'\|'whatsapp_send_failed'\|'invalid_input'\|'wa_not_configured'\|'unauthorized'), created_at TIMESTAMPTZ DEFAULT now())`. Auditoria do edge function `student-grant-access` (gate via responsavel autenticado) + fallback legado. Indices por `student_id`, `granted_by_guardian_user_id` e `ip_address`. RLS sem policies (service_role only). Edge function deployada (v1, verify_jwt=true) + UI: `GrantStudentAccessButton` no DashboardPage do responsavel + banner CTA na aba "Primeiro acesso" do `/portal/login`. |
| 194 | `fix_guardian_rls_user_id_bug` | 18/04 | ✅ **Bugfix RLS** — corrige policies em `absence_communications` (088), `exit_authorizations` (089), `health_record_update_requests` (091), `store_orders` + `store_order_items` (095) e `store_pickup_protocols` (096) que filtravam por `guardian_profiles WHERE user_id = auth.uid()` (coluna inexistente — `guardian_profiles.id` JA E `auth.users.id`). Policies originais ou erravam em execucao ou nunca retornavam linhas, bloqueando responsaveis autenticados de verem proprios pedidos/faltas/saude. Substituido por `guardian_id = auth.uid()` direto. |
| 195 | `fix_guardian_rls_cleanup` | 18/04 | ✅ **Bugfix RLS (cleanup)** — a 194 nao casou com os nomes reais de algumas policies originais (088 "guardian view own ...", 089 idem, 091 "guardian_view_own_*", 096 "pickup_protocols_*"), entao ficaram conviventes a quebrada original + a nova. Esta migration remove ambas e recria com os nomes originais corretos. Verificado via `pg_policies`: 8 policies guardian em estado limpo. |
| 187 | `staff_documents_bucket` | 18/04 | 🟡 **Fase 16 PR1** — Bucket privado `hr-documents` (10MB, PDF/DOC/DOCX/JPEG/PNG) + tabela `staff_documents` (`document_type CHECK ('contrato'|'rg'|'cpf'|'comprovante_residencia'|'carteira_trabalho'|'diploma'|'outro')`, `file_path`, `filename`, `mime_type`, `size_bytes`, `expires_at`). RLS via módulo `rh-colaboradores` + self-service (próprio colaborador vê próprios docs via EXISTS em `staff`). Path convention `hr-documents/{staff_id}/{uuid}.{ext}`. |
| 173 | `teacher_dashboard_access` | 17/04 | ✅ **Dashboard registry-driven** — libera `dashboard.can_view=true` para role `teacher` no seed de `role_permissions`. Antes, teacher batia no redirect do `<ModuleGuard moduleKey="dashboard">` mesmo tendo acesso a submódulos (teacher-diary, teacher-exams, occurrences). O novo `DashboardPage` único filtra widgets por `has_module_permission` + `requireRole`, então teacher passa a ver `Minhas aulas de hoje`, `Diário pendente`, `Provas a corrigir`, `Minhas turmas` e `Ocorrências recentes` (tenancy RLS da migration 145 continua escopando por `teacher_sees_student`). |
| 201 | `dashboards_secretaria_area_professor` | 18/04 | ✅ **Dashboards Secretaria + Área do Professor** — estende `CHECK` de `dashboard_widgets.module` e `dashboard_widget_prefs.module` para `{financeiro, academico, principal, secretaria, area-professor}`. Adiciona módulo granular `secretaria-dashboard` (permissão admin/super_admin; coordinator read-only). Alinha o dashboard da Área do Professor ao padrão visual (KPI cards com chip colorido + hover shadow + `<DashboardChartGrid module="area-professor"/>`). Cria aba **"Visão Geral"** como primeira em `/admin/secretaria` com 5 KPIs (declarações pendentes, fichas de saúde pendentes, rematrícula aberta, transferências no mês, declarações emitidas mês) + chart builder. Novo componente `KpiCard` compartilhado e 6 loaders de dados em `ChartWidget` (declaracoes_by_status, declaracoes_by_month, transfers_by_type, rematricula_funnel, teacher_plans_by_month, teacher_exams_by_status; `attendance_by_class` e `class_occupancy` reaproveitados com RLS filtrando por `teacher_id`). |
| 202 | `fiscal_provider_oauth` | 18/04 | ✅ **Sprint Fiscal OAuth2 PR1** — Cria `fiscal_provider_credentials` (singleton `UNIQUE(provider)`: `client_id`, `client_secret_enc`, `environment` CHECK('sandbox'\|'production'), `scopes`, `updated_by`, timestamps + trigger `set_updated_at`, RLS admin/super_admin ALL) e `fiscal_provider_token_cache` (`provider PK`, `environment`, `access_token`, `expires_at`, `refreshed_at`; RLS habilitado sem policies — service_role only). Marca `company_nfe_config.api_token_enc`, `company_nfce_config.api_token_enc` e `company_nfse_config.api_token_enc` como **DEPRECATED** e NULLABLE — autenticação passa a ser OAuth2 client_credentials contra `https://auth.nuvemfiscal.com.br/oauth/token`, com token de 30 dias cacheado pelo helper `_shared/nuvemFiscal.ts` (margem de 5min antes da expiração + retry em 401). |
| 203 | `fiscal_provider_module` | 18/04 | ✅ **Sprint Fiscal OAuth2 PR2** — Adiciona módulo granular `settings-fiscal-provider` (grupo `settings`, position 212) com defaults super_admin ALL + admin ALL (exceto delete). Libera controle granular de acesso à aba **Configurações › Fiscal › Provedor** (credenciais OAuth + painel de cotas), separado dos módulos específicos NF-e/NFC-e/NFS-e. Amplia `fiscal_provider_credentials.scopes` default para `'empresa nfe nfce nfse cnpj cep conta'` (escopo `conta` necessário para `GET /conta/cotas`) e aplica retroativamente às credenciais já salvas. |
| 204 | `job_openings` | 18/04 | ✅ **Fase 16 PR2** — Tabela `job_openings` (vagas abertas pela escola): `title`, `department`, `location`, `description` (HTML), `requirements` (texto plano, usado pelo prompt do `resume_screener` no PR3), `employment_type CHECK ('clt'|'pj'|'estagio'|'terceirizado')`, `salary_range_min/max`, `status CHECK ('draft'|'published'|'paused'|'closed')`, `opened_at/closed_at`. Trigger `set_job_opening_timestamps` auto-seta `opened_at` no primeiro `published` e `closed_at` no `closed`. RLS via módulo `rh-seletivo` + admin ALL + política SELECT anônima quando `status='published'` (preparação para `/trabalhe-conosco` no PR4). |
| 205 | `candidates_and_applications` | 18/04 | ✅ **Fase 16 PR2** — `candidates` (UNIQUE email, CPF UNIQUE, CNH, LinkedIn/portfolio, endereço, `extracted_payload JSONB` reservado para PR3) + `job_applications` (FK opening+candidate UNIQUE, `stage CHECK ('novo'|'triagem'|'entrevista'|'proposta'|'contratado'|'descartado')`, `stage_position`, `source`, `resume_path`, campos do screener (`screener_score/summary/payload/screened_at`), campos do interviewer (`interview_report` markdown + `interview_payload` JSONB), `rejected_reason`, `hired_staff_id UUID NULL FK staff ON DELETE SET NULL`, `hired_at`). RPC `promote_candidate_to_staff(p_application_id UUID)` SECURITY DEFINER — copia dados do candidate+vaga para `staff` (idempotente). Trigger `trg_job_applications_promote` AFTER UPDATE OF stage WHEN `NEW.stage='contratado' AND OLD.stage<>'contratado'` cria staff automaticamente. |
| 206 | `rh_resume_agents_seed` | 18/04 | ✅ **Fase 16 PR3** — Seed idempotente em `ai_agents` com `resume_screener` (Haiku 4.5, temperature=0.2, max_tokens=800, retorna `{score_0_100, pros[], cons[], recommendation, reasoning}`) e `resume_extractor` (Haiku 4.5, temperature=0.1, max_tokens=1200, retorna JSON estruturado com identificação, contato, endereço, `experience[]`, `education[]`, `skills[]`). Ambos os prompts usam wrapper defensivo `### USER RESUME (untrusted) … ### END RESUME` contra prompt injection. `ON CONFLICT (slug) DO UPDATE` permite re-seed ao ajustar prompts. Consumido pelo botão "Analisar com IA" do `CandidatoDrawer` via `ai-orchestrator`. |
| 207 | `rh_careers_schema_alter` | 18/04 | ✅ **Fase 16 PR3** — `job_openings.area` CHECK `('pedagogica','administrativa','servicos_gerais')` + `job_applications`: `area` obrigatório, `job_opening_id` NULLable (reserva), `pre_screening_status` CHECK `('pending','running','completed','abandoned')`, `pre_screening_session_id UUID`. `DROP CONSTRAINT job_applications_job_opening_id_candidate_id_key` + partial UNIQUE `(job_opening_id, candidate_id) WHERE job_opening_id IS NOT NULL` (permite múltiplas reservas do mesmo CPF). |
| 208 | `pre_screening_sessions` | 18/04 | ✅ **Fase 16 PR3** — Tabela de sessão anônima do chat público: `token TEXT UNIQUE` (32-byte base64url via `gen_random_bytes`), `status CHECK ('active','completed','abandoned','expired')`, `messages JSONB` (histórico `{role,text,at}`), `expires_at DEFAULT now()+30min`. `application_id UUID FK ON DELETE CASCADE`. Função `expire_stale_pre_screening_sessions()` para mover sessões vencidas. RLS service-role only (admin leitura adicionada no PR8/migration 219). |
| 209 | `pre_screening_interviewer_seed` | 18/04 | ✅ **Fase 16 PR3** — Agente `pre_screening_interviewer` (Haiku 4.5 ou Sonnet 4.5, temperature=0.4, max_tokens=1500). System prompt conduz 4-6 turnos coletando DISC + STAR + motivação + disponibilidade + expectativa salarial. Ao `should_finalize=true`, retorna markdown + payload JSON estruturado (`disc_profile`, `star_scores`, `fit_summary`, `recommendation`). Wrapper anti-injection reforçado. |
| 211 | `settings_rh_and_careers_content` | 18/04 | ✅ **Fase 16 PR3** — Módulo `settings-rh` (grupo settings, super_admin/admin ALL) + seed default `system_settings.content.careers` (hero_title/subtitle, areas_descriptions, reserva_copy, thank_you, lgpd_consent_text, rate_limit, session_ttl). |
| 212 | `rh_extracted_payload` | 18/04 | ✅ **Fase 16 PR3** — `job_applications.extracted_payload JSONB` NULL — armazena o JSON do `resume_extractor` (identificação, endereço, experiência, formação, skills). Separado de `screener_payload` (vs vaga) e `interview_payload` (DISC/STAR). |
| 213 | `careers_pr3_hardening` | 18/04 | ✅ **Fase 16 PR3.1** — Endereça gaps §10.17.A: (a) `cron.schedule('*/15 * * * *')` para `expire_stale_pre_screening_sessions`; (b) trilha LGPD em `job_applications` (`lgpd_consent_at TIMESTAMPTZ`, `lgpd_consent_version TEXT` com hash sha256, `lgpd_consent_ip TEXT`); (c) `promote_candidate_to_staff` reescrita para aceitar reserva (`job_opening_id IS NULL`) com parâmetros opcionais `p_position/p_department/p_employment_type` + fallback por `area`. |
| 214 | `best_fit_selector_seed` | 18/04 | ✅ **Fase 16 PR4** — Agente `best_fit_selector` em `ai_agents` (Haiku 4.5, wrapper defensivo) + RPC `list_reserva_candidates_for_job(p_job_id UUID)` que agrega candidaturas reserva da mesma área da vaga. Consumido pela nova aba **Reserva** do `VagaDrawer` — ranqueia top-5 candidatos com score+pros+cons e CTA "Mover para triagem". |
| 215 | `bulk_import_staff_grants` | 18/04 | ✅ **Fase 16 PR5** — `UPDATE role_permissions SET can_create=true WHERE role IN ('admin','super_admin') AND module_key='rh-colaboradores'` (pré-requisito da importação em massa). Edge function `bulk-import-staff` INSERTa em `staff` sem criar `auth.users`/`profiles`; wizard no hub `/admin/migracao` usa `ModuleImportWizard` padrão OP-1. |
| 216 | `rh_dashboard_module` | 18/04 | ✅ **Fase 16 PR6** — Módulo granular `rh-dashboard` (grupo `rh`, position 299, ícone `LayoutDashboard`) + grants (super_admin ALL, admin/coordinator view-only). Habilita umbrella `/admin/rh` com sub-tabs Dashboard/Colaboradores/Processo seletivo (padrão Gestão/Financeiro/Acadêmico). |
| 217 | `appearance_vagas_seed` | 18/04 | ✅ **Fase 16 PR7** — Seed idempotente de `system_settings.appearance.vagas` com `{badge:'Oportunidades', title:'Trabalhe Conosco', highlight:'Conosco', subtitle, video_url, image_url}`. Alimenta hero full-height de `/trabalhe-conosco` seguindo padrão whitelabel das demais páginas institucionais. Sub-aba **Vagas** em Config → Site → Aparência. |
| 218 | `anon_read_branding_appearance_navigation` | 18/04 | ✅ **Fase 16 PR7** — Expande policy `SELECT` anônima em `system_settings` para `category IN ('branding','appearance','navigation','content')` com `key` whitelisted. Unifica a leitura pré-login das 4 categorias que alimentam a SPA pública. Substitui policies fragmentadas das migrations 34/35/36. |
| 219 | `pre_screening_sessions_rls` | 18/04 | ✅ **Fase 16 PR8** — Corrige gap crítico: migration 208 habilitou RLS sem policies, bloqueando admins autenticados (aba "Chat" do `CandidatoDrawer` vazia em produção). Policies `pre_screening_sessions_admin_all` (`profiles.role IN (super_admin,admin)`) + `pre_screening_sessions_select_by_perm` (`get_effective_permissions('rh-seletivo', can_view)`). Edge functions via service-role continuam passando. |
| 220 | `rh_pipeline_notifications` | 19/04 | ✅ **Fase 16 PR9** — Notificações WhatsApp automáticas no pipeline: `whatsapp_templates.category` CHECK estendido com `'rh-seletivo'`; `job_applications.notified_stages TEXT[]` (dedup); seed `system_settings.general.site_url` + `hr.required_docs`; trigger `trg_notify_on_rh_stage_change` (BEFORE UPDATE OF stage) dispara `auto-notify` via `pg_net.http_post` e marca `notified_stages` na mesma transação; 4 templates pt-BR (`rh_stage_entrevista/proposta/contratado/descartado`) com variáveis `candidate_first_name, job_title, school_name, schedule_url, careers_url, business_hours_text, required_docs_list`. Categoria `rh-seletivo` também em `whatsapp_template_categories` (aparece no editor de templates). |
| 221 | `candidates_cpf_as_natural_key` | 19/04 | ✅ **Fase 16 PR10** — `DROP CONSTRAINT candidates_email_key` — CPF (UNIQUE desde 205) vira a chave humana do candidato; email pode mudar ao longo do tempo. Suporte no app: `src/lib/cpf.ts` + `supabase/functions/_shared/cpf.ts` com validador de checksum Receita Federal; `careers-intake` usa `upsertCandidateByCpf`; `CandidatoDrawer` expõe CPF/RG/birth_date/endereço com backfill a partir de `extracted_payload` do CV. |

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
| `student_health_records` | student_id, blood_type, allergies TEXT[], allergy_categories JSONB, food_restrictions, medications JSONB, can_receive_medication, chronic_conditions, emergency_contact_*, health_plan | Ficha de saude (Fase 11); expandida em Fase 11.C |
| `student_medical_certificates` | student_id, issue_date, valid_until, doctor_name, doctor_crm, file_path, is_active, superseded_by | Atestados de aptidao fisica com historico (Fase 11.C) |
| `health_record_update_requests` | student_id, guardian_id, proposed_data JSONB, current_snapshot JSONB, status | Propostas de atualizacao do responsavel (Fase 11.C) |
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

### 8.1 Edge Functions Implementadas (21)

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
| `change-password` | JWT (auth) | — | Troca de senha com validacao de politica e historico; UPDATE paralelo em `profiles` / `guardian_profiles` / `students` para zerar `must_change_password` conforme role logado |
| `guardian-request-access` | Nenhum (publico) | 3/CPF/h + 10/IP/10min | Primeiro acesso / esqueci-a-senha do portal do responsavel: valida CPF+telefone em `student_guardians`, gera senha provisoria, cria/atualiza `auth.users` + `guardian_profiles`, envia template `senha_temporaria` via UazAPI direto. Anti-enumeracao + auditoria em `guardian_access_attempts` |
| `professor-request-access` | Nenhum (publico) | 3/email/h + 10/IP/10min | Esqueci-a-senha do portal do professor: valida e-mail em `profiles` (role=teacher, ativo), checa WhatsApp do `phone` cadastrado, reseta senha + marca `must_change_password=true`, envia `senha_temporaria` via UazAPI. Anti-enumeracao + auditoria em `teacher_access_attempts` |
| `geocode-address` | JWT (admin+) | — | Proxy Google Maps Geocoding API; converte endereco em lat/lng |
| `google-static-map` | JWT (admin+) | — | Proxy Google Static Maps API; retorna PNG com marcador + circulo |
| `financial-notify` | Trigger secret (pg_cron) | — | Regua de cobranca automatica diaria (08:00 BRT); le billing_stages configuravel; agrupa por etapa em campanha via UazAPI `/sender/advanced`; dedup via `financial_notification_log` |
| `payment-gateway-proxy` | JWT (admin+) | — | Proxy multi-gateway com Adapter Pattern; acoes: createCustomer, createCharge, getCharge, cancelCharge; adapters: Asaas (V1) |
| `payment-gateway-webhook` | Secret URL param | — | Recebe webhooks de gateways; normaliza via adapter; atualiza installments e store_orders; idempotente via `gateway_webhook_log`; verify_jwt=false |
| `generate-document` | JWT (admin+) | — | Renderiza template HTML com variaveis → gera PDF; salva em Storage; retorna signed URL (Fase 11) |
| `calculate-grades` | JWT (admin+) | — | Calcula medias e resultado final por turma/periodo usando a grade_formula do segmento (Fase 9) |
| `checkout-proxy` | Token publico (session = auth) | — | Backend do checkout proprio /pagar/:token; acoes: createSession, getSession, pollStatus, payWithCard; PIX / Cartao / Boleto (Fase 14) |

**Rate Limiting**: Endpoints publicos usam rate limiter in-memory com sliding window por IP (`_shared/rate-limit.ts`). Resposta 429 inclui headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Endpoints protegidos por JWT nao precisam de rate limiting adicional.

### 8.2 Edge Functions Planejadas

| Funcao | Auth | Rate Limit | Fase | Descricao |
|--------|------|------------|------|-----------|
| `create-guardian-user` | JWT (super_admin) | — | 10 | Cria usuario Supabase Auth para responsavel + `guardian_profiles`; gera senha temporaria |
| `occurrence-notify` | Trigger secret | — | 10 | Disparado ao inserir em `student_occurrences`; envia WhatsApp ao responsavel do aluno |
| `nfse-emitter` | JWT (admin+) / Trigger secret | — | 14.S | Engine de emissao NFS-e: monta payload, valida tomador, chama API do provider, registra em `nfse_emitidas`; suporta emissao automatica (trigger) e manual (admin) |
| `nfse-webhook` | Secret URL param | — | 14.S | Recebe callbacks do provider (autorizacao, rejeicao, cancelamento, substituicao); atualiza `nfse_emitidas.status`; idempotente via `nfse_emission_log` |
| `nfse-retry-job` | pg_cron | — | 14.S | Job agendado que reprocessa emissoes com status `pendente` ou `rejeitada` dentro do limite de tentativas configuravel |
| `nfse-certificado` | JWT (admin / super_admin) | 17/04 | 14.S.P.1.5 | Proxy para upload/consulta/remocao do certificado A1 na Nuvem Fiscal (`PUT/GET/DELETE /empresas/{cnpj}/certificado`). Evita expor API token no frontend. Valida role admin via `profiles.role`. |
| `nfse-cancel` | JWT (admin / super_admin) | 17/04 | 14.S.P.2 | Cancela NFS-e autorizada: chama `POST /nfse/{id}/cancelamento` na Nuvem Fiscal, atualiza `nfse_emitidas.status='cancelada'` + `motivo_cancelamento` + `cancelada_em`, registra tentativa em `nfse_emission_log`. |
| `nfce-emitter` | service-role / JWT | 17/04 | 14.S.P-bis.PR2 | Motor de emissao NFC-e (modelo 65) a partir de `store_orders`: carrega config + emitente + itens com `product_fiscal_data` (NCM/CFOP/CSOSN/PIS/COFINS) + CPF do consumidor (override em `store_orders.consumer_cpf_cnpj` ou, por padrao, `students.guardian_id → guardian_profiles.cpf_cnpj`); reserva numero via RPC atomica; monta payload `infNFe` v4.00 (ICMSSN102/PISAliq/COFINSAliq, pagamento por `tPag` mapeado); chama `POST /nfce` (Nuvem Fiscal) e persiste em `nfce_emitidas` + `nfce_emission_log`. Inclui `action: "test"` para ping do painel. |
| `nfce-webhook` | Secret URL param | 17/04 | 14.S.P-bis.PR2 | POST `?secret=...` recebe callbacks de status/autorizacao assincrona; parser dedicado Nuvem Fiscal (id, status, chave, protocolo, url_pdf/xml, qrcode) + generico; atualiza `nfce_emitidas` (chave_nfce/protocolo/link_danfe/link_xml/qrcode_url/status) e loga em `nfce_emission_log`. |
| `nfce-cancel` | JWT (admin / super_admin) | 17/04 | 14.S.P-bis.PR2 | Cancela NFC-e autorizada via `POST /nfce/{id}/cancelamento` com `justificativa` (minimo 15 caracteres, exigencia SEFAZ); atualiza `status='cancelada'` + `motivo_cancelamento` + `cancelada_por`; registra no log e em `audit_logs`. |
| `nfe-emitter` | service-role / JWT | 17/04 | 14.S.P-ter.PR2 | Motor de emissao NF-e modelo 55 (devolucao) a partir de `nfe_entries`: carrega `company_nfe_config` + `company_fiscal_config` (emitente) + `nfe_entries` + `nfe_entry_items` (com `itens_selecionados` opcional) + `fornecedores` (destinatario via `cnpj_cpf = nfe_entries.emitente_cnpj`); reserva numero via `increment_nfe_numero()`; monta `infNFe` v4.00 com `mod: 55`, `finNFe: 4`, `NFref.refNFe` apontando para `chave_acesso` original, CFOP `5202`/`6202` conforme comparacao de UF emit/dest, ICMSSN102/PISAliq/COFINSAliq; chama `POST /nfe` (Nuvem Fiscal) e persiste em `nfe_emitidas` + `nfe_emission_log`. Preenche `autorizada_em` em autorizacoes. `action: "test"` para ping. |
| `nfe-webhook` | Secret URL param | 17/04 | 14.S.P-ter.PR2 | POST `?secret=...` recebe callbacks assincronos da Nuvem Fiscal para NF-e; parser dedicado (id, status, chave, protocolo, url_pdf/xml) + generico; atualiza `nfe_emitidas` (chave_nfe/protocolo/link_danfe/link_xml/status/autorizada_em/xml_retorno) e loga em `nfe_emission_log`. |
| `nfe-cancel` | JWT (admin / super_admin) | 17/04 | 14.S.P-ter.PR2 | Cancela NF-e autorizada via `POST /nfe/{id}/cancelamento`; justificativa 15-255 chars; valida janela SEFAZ de 24h (`autorizada_em + 24h > now()`); atualiza `status='cancelada'` + `motivo_cancelamento` + `cancelada_em` + `cancelada_por`; registra no log e em `audit_logs`. |
| `ai-orchestrator` | JWT (autenticado) | 17/04 | Sprint 13.PR1 | Carrega `ai_agents` por `agent_slug`, renderiza `user_prompt_template` com `{{var}}` substituição recursiva a partir de `context`, dispatcha para `ai-worker-anthropic` ou `ai-worker-openai` conforme `provider`, loga em `ai_usage_log` (tokens, latência, status, context_hash). Body: `{ agent_slug, context?, dry_run? }`. Retorna `{ text, input_tokens, output_tokens, latency_ms, agent_slug, provider, model }`. |
| `ai-worker-anthropic` | service_role (interno) | 17/04 | Sprint 13.PR1 | Wrapper para `POST https://api.anthropic.com/v1/messages` (anthropic-version `2023-06-01`). Body: `{ model, system, user, temperature, max_tokens }`. Retorna `{ text, input_tokens, output_tokens }` normalizado. Exige secret `ANTHROPIC_API_KEY`. |
| `ai-worker-openai` | service_role (interno) | 17/04 | Sprint 13.PR1 | Wrapper para `POST https://api.openai.com/v1/chat/completions`. Body: `{ model, system, user, temperature, max_tokens }`. Retorna `{ text, input_tokens, output_tokens }` normalizado a partir de `usage.prompt_tokens`/`completion_tokens`. Exige secret `OPENAI_API_KEY`. |
| `ai-billing-sync` | X-Trigger-Secret (cron) OU JWT admin | 17/04 | Sprint 13.IA-dash PR2 | Consulta APIs admin oficiais (Anthropic `/v1/organizations/usage_report/messages`+`/cost_report` com `workspace_ids[]` opcional, OpenAI `/v1/organization/usage/completions`+`/costs`) para o dia solicitado; UPSERT em `ai_usage_snapshots` por `(provider, snapshot_date)` com `tokens_input/output`, `requests_count`, `total_spent_usd`, `raw_payload`. Body: `{ provider?, date?, force? }`. Pula provider com `status='skipped'` quando admin key ausente. Disparado diariamente às 00:01 UTC via `pg_cron`. Bloco de inferência de recarga removido na limpeza do PR3 (migration 171). |
| `ai-billing-manual-refresh` | `verify_jwt=false` (validação interna de admin/super_admin) | 17/04 | Sprint 13.IA-dash PR2+PR3 | Thin wrapper que delega para `ai-billing-sync` com `force=true`, passando `x-trigger-secret` internamente. Rate-limit de **1 chamada / 5 minutos** baseada no `fetched_at` mais recente em `ai_usage_snapshots` (retorna 429 com `retry_after_seconds`). Invocado pelo botão "Atualizar agora" no `AiUsageDashboard`. |
| `ai-event-dispatcher` | X-Trigger-Secret (trigger/cron) OU JWT admin | 17/04 | Sprint 13.IA.v2 PR1 | Backbone do modo event-driven: recebe `{event_type, entity_type?, entity_id?, payload?}`, carrega bindings enabled em `ai_event_bindings`, aplica debounce via `context_hash` em `ai_insights` (janela `debounce_hours`), invoca `ai-orchestrator` com `{agent_slug, context}`, parseia verdict JSON (`should_alert`, `severity`, `audience`, `recipient_id`, `title`, `summary`, `payload`, `actions`) e UPSERT em `ai_insights` com `onConflict='agent_slug,context_hash'+ignoreDuplicates`. Dispara `push-send` quando severity ∈ {high, critical}. |
| `ai-login-refresh` | JWT (admin/super_admin) | 17/04 | Sprint 13.IA.v2 PR1 | Chamado fire-and-forget pelo `AdminAuthContext.onAuthStateChange` após `SIGNED_IN`; carrega agentes WHERE `run_on_login=true AND enabled=true`, filtra por role do usuário via `audience`, faz fan-out para `ai-event-dispatcher` com `event_type='login_refresh.<slug>'`. Pre-computa insights personalizados para aparecer no inbox em < 5s após login via Realtime. |
| `ai-scheduled-runner` | X-Trigger-Secret (pg_cron) OU JWT admin | 17/04 | Sprint 13.IA.v2 PR1 | Runner multi-cadência: body `{cadence?, run_agent?}`. Busca `ai_agents` WHERE `run_on_cron=cadence AND enabled=true`, faz fan-out para `ai-event-dispatcher` com `event_type='cron.<slug>'`. Cada agente faz seu próprio fan-out interno (ex: `student_weekly_summary` itera alunos dentro do prompt/RPC, dispatcher cria 1 insight por destinatário via `recipient_id`). |
| `fiscal-provider-test` | JWT (admin / super_admin) | 18/04 | Sprint Fiscal OAuth2 PR1 | Teste de credenciais OAuth2: força um token exchange (`client_credentials`) contra `auth.nuvemfiscal.com.br/oauth/token` reusando o helper `_shared/nuvemFiscal.ts`, persiste no cache e retorna `{ok, environment, expires_at}` ou `{ok:false, error, status?}`. Consumido pelo botão "Testar Conexão" no `FiscalProviderCredentialsPanel`. |
| `fiscal-provider-quotas` | JWT (admin / super_admin) | 18/04 | Sprint Fiscal OAuth2 PR2 | `GET /conta/cotas` na Nuvem Fiscal via helper compartilhado (injeta bearer OAuth + retry em 401). Retorna `{ok, data: [{nome, consumo, limite}], fetched_at}` normalizado. Alimenta o card "Consumo e cotas" no `FiscalProviderCredentialsPanel` com barras de progresso (emerald < 70%, amber 70-89%, red ≥ 90%) e rótulos pt-BR por `nome` de cota. Auto-load no mount + botão de refresh. |
| `_shared/nuvemFiscal.ts` | Import shared (Deno) | 18/04 | Sprint Fiscal OAuth2 PR1 | Módulo compartilhado consumido por todas as Edge Functions que falam com Nuvem Fiscal (`nfe-emitter`, `nfe-cancel`, `nfce-emitter`, `nfce-cancel`, `nfse-emitter`, `nfse-cancel`, `nfse-certificado`, `nfse-retry-job`, `fiscal-provider-test`, `fiscal-provider-quotas`). Expõe `getNuvemFiscalToken(service, {forceRefresh})`, `nuvemFiscalFetch(service, path, init)` (injeta `Authorization: Bearer <token>`, resolve baseURL conforme `environment` sandbox/production, repete 1x em 401 com token fresco) e `testNuvemFiscalConnection(service)`. Cache via `fiscal_provider_token_cache` com margem de 5 min. |

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

### 9.1B Loja Publica (6 rotas — Fase 14)

Rotas publicas com o Layout do site (Navbar + Footer). Nenhuma requer autenticacao.

| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/loja` | LojaPublicaPage | Catalogo publico de produtos |
| `/loja/categoria/:slug` | CategoriaPage | Produtos filtrados por categoria |
| `/loja/produto/:slug` | ProdutoPage | Detalhe do produto com variantes |
| `/loja/carrinho` | CarrinhoPage | Carrinho de compras |
| `/loja/checkout` | CheckoutPage | Selecao de metodo de pagamento → redireciona para /pagar/:token |
| `/loja/pedido/:orderNumber` | ConfirmacaoPedidoPage | Acompanhamento do pedido apos confirmacao |

### 9.1C Checkout Proprio (1 rota — Fase 14)

Rota standalone sem Layout (sem Navbar/Footer). Publica: o token na URL funciona como autenticacao.

| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/pagar/:token` | PagarPage | Checkout branded: PIX / Cartao / Boleto — backend via Edge Function checkout-proxy |

### 9.2 Atendimento Publico (2 rotas)

| Rota | Componente | Descricao |
|------|-----------|-----------|
| `/atendimento` | AtendimentoPublico | Check-in por QR Code |
| `/painel-atendimento` | PainelAtendimento | Display TV/monitor |

### 9.3 Admin — Rotas Implementadas (21 rotas)

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
| `/admin/loja` | LojaPage (tab rail: Dashboard, Produtos, Pedidos, PDV, Relatorios) | admin+ |
| `/admin/loja/pdv` | PDVPage | admin+ |
| `/admin/loja/pedidos/:orderId` | OrderDetailPage | admin+ |

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
| `/admin/portaria` | Modulo de Portaria — frequencia e autorizacoes de saida | admin+, portaria | 11.B |
| `/admin/faltas` | Fila de comunicacoes de falta do responsavel | admin+, coordinator | 11.B |
| `/admin/autorizacoes-saida` | Fila de autorizacoes de saida excepcional | admin+, coordinator | 11.B |
| `/admin/secretaria` (tab Fichas de Saúde expandida) | Atestados, alertas vencimento, fila de atualizacoes do responsavel | admin+, coordinator | 11.C |

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
| `/responsavel/faltas` | FaltasPage | Comunicar falta programada ou justificativa (Fase 11.B) |
| `/responsavel/autorizacoes-saida` | AutorizacoesSaidaPage | Autorizar saida excepcional com confirmacao de senha (Fase 11.B) |
| `/responsavel/saude` | SaudePage | Visualizar ficha + submeter atualizacoes + upload atestado + status (Fase 11.C) |

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
| 8.5 | ERP Financeiro Completo (Caixas, A/R, A/P, Relatorios) | ✅ Concluido (migrations 67–73, 2026-04-14) | Alta | 8 |
| 9 | Academico Completo | ✅ Concluido (UI + backend + WhatsApp) | Critica | 7 |
| 9.M | Migracao Arquitetural: Seguimento→Serie→Turma | ✅ Concluido (migrations 61-63, 2026-04-15) | Critica | 1-5 (gap) |
| 9.5 | Dashboards Analiticos (Financeiro + Academico) | ✅ Concluido (migration 74, Recharts, 2026-04-15) | Alta | 8 + 9 |
| 9.6 | Pipeline Financeiro — Pontes criticas (NF-e→A/P, baixas→caixa, PDV, pedido online, parcelas, store_orders nas views) | ✅ Concluido (migrations 133–139, 2026-04-17) | Critica | 8.5 + 9 + 14 |
| 9.7 | Pipeline Academico — Frequencia por disciplina, resultados de provas, recalculo automatico de boletim | ✅ Concluido (migration 140, 2026-04-17) | Critica | 9 + 10.P |
| 9.8 | Consolidacao de Disciplinas — `disciplines` como tabela canonica; diario vinculado a disciplina; auto-sugestao na grade horaria | ✅ Concluido (migration 141, 2026-04-17) | Alta | 9 + 10.P |
| 10 | Portal do Responsavel | ✅ Concluido (migrations 75-76, 2026-04-15) | Critica | 8 + 9 + 9.M |
| 10.P | Portal do Professor / Diario de Classe | ✅ Concluido (migrations 77-81, 2026-04-15) | Alta | 9 + 9.M *(paralelo a Fase 10)* |
| 11 | Secretaria Digital | ✅ Concluido (migrations 82-86, Edge Function generate-document, 2026-04-15) | Alta | 10 |
| 11.B | Portal do Responsavel + Modulo de Portaria (Comunicacao de Faltas, Autorizacoes de Saida, Portaria) | ✅ Concluido (migrations 87–90, 2026-04-16) | Alta | 10 + 10.P + 11 |
| 11.C | Ficha de Saude Expandida (atestado fisico, atualizacoes pelo responsavel, visao restrita professor, alertas de vencimento) | ✅ Concluido (commit c08d37d, 2026-04-16) | Alta | 11 + 10 |
| 12 | Modulo Pedagogico Avancado (BNCC + Relatorios) | ✅ Concluido (migration 107, Sprint 5, 2026-04-16) | Media | 9 + 10.P |
| 13 | IA e Analytics | ✅ Concluido (Sprint 13.IA + 13.IA-dash, migrations 161-171, 2026-04-17) | Media | 8 + 9 + 10 |
| 14 | Loja, PDV e Estoque | ✅ Concluido (migrations 92–102, 2026-04-16) | Alta | 8.5 + 10 |
| 14+ | Checkout proprio `/pagar/:token` | ✅ Concluido (migration 102 checkout_sessions, 2026-04-16) | Alta | 14 |
| 14.F | Estrutura Fiscal de Produtos (NF-e prep) | ✅ Concluido (migrations 109–113, Sprint 7, 2026-04-16) | Media | 14 |
| 14.S | Estrutura NFS-e (tabelas, UI, stub do emitter) | ✅ Concluido (migrations 114–117, NfseEmitidas.tsx, 2026-04-17) | Media-Alta | 14.F + 8.5 + 10 |
| 14.S.P | Integracao NFS-e com provider real (Nuvem Fiscal) | ✅ Concluido (2026-04-17) — PR1: migration 155 `increment_nfse_numero()` RPC atomica; `nfse-emitter` com dispatcher por `cfg.provider` e cliente Nuvem Fiscal (`POST /nfse/dps`, payload DPS NFS-e Nacional LC 214/2024); `nfse-webhook` com parser dedicado. PR1.5: Edge Function `nfse-certificado` (proxy upload/consulta/remocao do A1 na Nuvem Fiscal) + card "Certificado Digital A1" no `NfseSettingsPanel`. PR2: migration 156 `auto_emit_on_payment` + `motivo_cancelamento`; toggle de auto-emissao em `NfseSettingsPanel`; auto-trigger best-effort em `handlePay` apos baixa; Edge Function `nfse-cancel`; drawer de `NfseEmitidas` com acoes condicionais (Reenviar PDF, Cancelar, Emitir novamente). | Media-Alta | 14.S |
| 14.S.P-bis | NFC-e via Nuvem Fiscal (PDV/Loja) | ✅ **Concluido (2026-04-17)**. PR1: migrations 157-158 (`company_nfce_config` singleton com CSC+idCSC, RPC `increment_nfce_numero()`, `nfce_emitidas` FK `store_orders`, `nfce_emission_log`, `store_orders.consumer_cpf_cnpj/consumer_name`) + `NfceSettingsPanel` como sub-tab "NFC-e (Consumidor)" em Fiscal. PR2: Edge Functions `nfce-emitter` (envelope `infNFe` v4.00 com ICMSSN102/PIS/COFINS + mapeamento de pagamento `tPag`, CPF via `student → guardian_profiles.cpf_cnpj` com override em `order.consumer_cpf_cnpj`), `nfce-webhook` (parser Nuvem Fiscal + generico), `nfce-cancel` (justificativa 15–255 chars). Auto-trigger em `PDVPage.handleFinalize` apos `orderStatus='payment_confirmed'`. Sem certificado proprio: Nuvem Fiscal reusa o A1 da NFS-e (mesmo CNPJ). PR3: `NfceEmitidasTab` registrada em `LojaPage` (tab "NFC-e Emitidas", moduleKey `store-orders`, ícone Receipt) — listagem com stats cards, filtros (status/mes/busca por consumidor/CPF/numero), drawer de detalhes com acoes condicionais (Cancelar com justificativa 15+, Reemitir em pendente/rejeitada, DANFE e QRCode em autorizada), blocos de motivo_rejeicao + motivo_cancelamento + cancelada_em. | Media | 14.S.P + 14 |
| 14.S.P-ter | NF-e modelo 55 via Nuvem Fiscal (devolução ao fornecedor) | ✅ **Concluido (2026-04-17)** — PR1: migrations 159-160 (`company_nfe_config` singleton, RPC `increment_nfe_numero()`, `nfe_emitidas` FK `nfe_entries` com JSONB destinatario/itens/transp/referencia, `nfe_emission_log`) + `NfeSettingsPanel` registrado como sub-tab "NF-e (Emissão)" em Fiscal ao lado de "NF-e (Produtos)"/"NFS-e"/"NFC-e". Escopo v1 restrito a `tipo_operacao='devolucao'` (referencia `chave_acesso` da NF-e original); CHECK deixa aberto para expansão futura. PR2: Edge Functions `nfe-emitter` (envelope `infNFe` v4.00 com `mod: 55`, `finNFe: 4` devolução, `NFref.refNFe` para chave da NF-e original, CFOP `5202`/`6202` conforme UF emit/dest, ICMSSN102/PIS/COFINS, lookup fornecedor via `cnpj_cpf = nfe_entries.emitente_cnpj`), `nfe-webhook` (parser Nuvem Fiscal + generico, preenche `autorizada_em` em autorizações), `nfe-cancel` (justificativa 15-255 chars + check de janela SEFAZ de 24h via `autorizada_em + 24h`). Certificado A1 reusa o vault da NFS-e. PR3: `NfeEmitidasPage` registrada em `FinancialPage` (tab "NF-e Emitidas (Devolução)", moduleKey `fornecedores`, ícone FileSignature) — listagem com stats cards (total/autorizadas/pendentes/rejeitadas), filtros (status/mes/busca por fornecedor/CNPJ/numero), drawer de detalhes com DANFE/XML + chave original referenciada, cancelar condicional a janela SEFAZ de 24h via helper `within24h`. Em `NfeEntradasPage` botão "Emitir devolução" (ícone `Undo2`) abre drawer com card "NF-e de origem" + textarea de motivo (validação 15-255 chars inline) e invoca `nfe-emitter` com `{ nfe_entry_id, motivo_devolucao, initiated_by }`. | Media | 14.S.P + 14.F |
| 14.E | Modulo de Fornecedores | ✅ Concluido (migrations 131–132, Sprint 9, 2026-04-17) | Media | 14.F + 8.5 |
| 15 | Achados e Perdidos Digital | ✅ Concluido (migrations 103–105, 2026-04-16) | Media | 6 + 9 + 10 |
| OP-1 | Central de Migracao de Dados (Onboarding) | ✅ Concluido (2026-04-17) — PR1–PR5 + Sprint 10-UX. PR1: infraestrutura (migration 150, hub `/admin/migracao`, lock por modulo). PR2a: refator para `ModuleImportWizard` generico + lock pos-sucesso. PR2b: Contatos, Fornecedores, Produtos. PR2c: Segmentos → Series → Turmas (migration 151). PR3: Contas a Receber e Contas a Pagar. PR4: Lancamentos de Caixa; migration 152 remove `appointments` do escopo (nao vital em ERPs escolares). PR5: Colaboradores — extensao do wizard com step opcional "Revisar" via `perRowOverrides` (admin define `role` por linha, com "aplicar a todos"); Edge Function `bulk-import-users` cria auth rows com senha temporaria + `must_change_password=true`. **Sprint 10-UX**: grupos em `SettingsCard` bicolor, timeline horizontal com avatars redondos, dependencias sequenciais (grupo trava ate o anterior concluir; dentro do grupo cada etapa aguarda a anterior), avatar final por grupo com `%` ou check verde ao completar, breadcrumb "Migração" com acentuacao. **10 importadores ativos, zero modulos pendentes.** | Alta | Todas as tabelas-alvo existentes |
| TV-1 | Editor Visual de Templates HTML | ✅ Concluido (2026-04-17) — PR1: `HtmlTemplateEditor` em TipTap 3.22.3 com toolbar + chips de variaveis. PR2: integrado em `FinancialTemplatesPage` (contract_templates). PR3: integrado em `SecretariaPage` (document_templates). Saida HTML limpa, zero mudanca de schema, renderer atual inalterado. | Media | contract_templates + document_templates + generate-document |
| Sprint 13.N | PWA Push Notifications | ✅ Concluido (2026-04-17) — PR1 (13.N.1): migration 153 `push_subscriptions` (endpoint UNIQUE, p256dh, auth, user_id+user_type, revoked_at, RLS: proprio usuario CRUD, admin SELECT/UPDATE), seed `system_settings.push.vapid_public_key`, secrets `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT`, Edge Function `push-send` (npm:web-push@3.6.7, assina VAPID JWT, filtra por `user_ids` ou `subscription_ids`, marca revoked em 404/410, atualiza `last_seen_at`). PR2 (13.N.2): `vite-plugin-pwa` alternado para `injectManifest` com `src/sw.ts` custom (workbox-precaching@7.4.0 + handlers `push` e `notificationclick` com foco de janela existente via `clients.matchAll`), hook `usePushSubscription(userType)` (permission, subscribe com VAPID do DB + upsert por endpoint, unsubscribe com `revoked_at`), componente `PushNotificationsCard` (estados supported/granted/denied/loading com Bell/BellOff/Loader2) integrado em `ProfilePage.tsx` (student) e `PerfilPage.tsx` (guardian). PR3 (13.N.3): migration 154 adiciona `whatsapp_templates.send_push BOOLEAN DEFAULT true`; `message-orchestrator` aceita bloco opcional `push: { user_ids, notification }` e faz fan-out paralelo chamando `push-send` apos o dispatch do WhatsApp, retornando `push_sent/push_failed/push_revoked`; `auto-notify` resolve `user_ids` a partir do telefone via `guardian_profiles` (comparacao por digitos com fallback endsWith para mascaras) e injeta o bloco quando `template.send_push` e verdadeiro; UI `TemplatesPage` ganha toggle "Enviar push junto com WhatsApp" dentro de "Disparo Automatico". | Media | push_subscriptions + whatsapp_templates.send_push + MessageOrchestrator |
| Sprint 13 | PWA + Mobile-First | ✅ Concluido (2026-04-17) — PR1: `vite-plugin-pwa@1.2.0`, manifest base, icones SVG (`pwa-icon.svg` + `pwa-icon-maskable.svg`), workbox precache ~5 MiB, `devOptions.enabled=false`. PR2: manifest dinamico — `vite.config.ts` com `loadEnv()` (build-time por cliente) + `BrandingContext` injetando `<meta theme-color>` + `<link rel="manifest">` via Blob URL (runtime a partir de `system_settings`). PR3: meta tags iOS (`apple-mobile-web-app-*`, `apple-touch-icon`, `mask-icon`), hook `useInstallPrompt` (captura `beforeinstallprompt`, detecta iOS/Android/desktop/standalone), componente `InstallAppCard` com prompt nativo/instrucao Safari/confirmacao, integrado nos perfis dos Portais do Aluno e Responsavel. PR4: `PortariaPage` mobile-first — busca `type="search"` full-width empilhando botao em `<sm`, touch targets ≥44px, avatars 44–48px, dialogo de confirmar saida com botoes `flex-1` (Cancelar/Confirmar). | Media | BrandingContext + system_settings |
| Sprint 13.IA | IA e Analytics (orquestrador + workers multi-provider) | ✅ **Concluido (2026-04-17)** — PR1+PR1.5+PR2+PR3+PR4 integrados. PR1 inicial: — PR1: migrations 161-163 (`ai_agents` com seed dos 4 agentes op1_mapping/attendance_triage/discount_suggestion/dashboard_insights, `ai_usage_log` imutavel, modulo granular `settings-ia`). Edge Functions `ai-orchestrator` (JWT, lookup por slug, templating `{{var}}`, dispatch por provider, log em `ai_usage_log`), `ai-worker-anthropic` (POST `api.anthropic.com/v1/messages`) e `ai-worker-openai` (POST `api.openai.com/v1/chat/completions`). `AiAgentsPanel` registrada como aba "IA (Agentes)" em Configuracoes — lista com toggle enabled/disabled, drawer de edicao (provider select Anthropic/OpenAI, model input, temperature/max_tokens, system_prompt e user_prompt_template com chips das variaveis detectadas) + card "Testar agente" que invoca orquestrador com contexto JSON ad-hoc, card "Uso recente" com ultimas 20 chamadas. **PR1.5 (2026-04-17)**: migration 164 (`company_ai_config` singleton com `anthropic_api_key`/`openai_api_key` + trigger `updated_at`, RLS admin/super_admin); `ai-orchestrator` lê as chaves de `company_ai_config` e envia no body do worker (sem dependência de env var); `ai-worker-anthropic` e `ai-worker-openai` aceitam `api_key` no body (fallback env var mantido para compatibilidade); `AiAgentsPanel` ganha card "Chaves de API" no topo com inputs mascarados (Eye/EyeOff) + Salvar no padrão admin, permitindo ao cliente gerenciar credenciais sem tocar no dashboard Supabase. **PR2 (2026-04-17)**: botão "Mapear com IA" no step 2 do `ModuleImportWizard` invoca `op1_mapping` com `{headers, sample_rows, target_fields}`; parser de JSON `{mapping: {coluna: field}}` aplica seleção automática e marca campos sugeridos como `high` confidence. Fallback silencioso para `autoDetectMappingFor` em caso de erro. **PR3 (2026-04-17)**: card "Sugestão IA" no `AttendanceDetailsDrawer` (acima de QuickActions) invoca `attendance_triage` com `{visit_reason, description, history}` (resolve `visit_reason/notes` de `visit_appointments` + resumo das últimas 5 senhas do visitante); renderiza `{categoria_sugerida, prioridade: baixa|media|alta, acoes_rapidas[]}` com badge colorido por prioridade e lista de ações rápidas. **PR4 (2026-04-17)**: agente `discount_suggestion` — card "Sugestão de desconto (IA)" dentro do drawer de pagamento em `FinancialInstallmentsPage` invoca o orquestrador com `{installment_value, payment_history (12 últimas parcelas), applicable_discounts (RPC `calculate_applicable_discounts`)}`; resposta `{valor_sugerido, percentual_sugerido, justificativa}` é exibida em card roxo com botão "Aplicar ao valor pago" (subtrai `valor_sugerido` do `amount` original). Agente `dashboard_insights` — widget `AiInsightsWidget` (lazy render, botão "Gerar insights") no `DashboardPage` (full-width abaixo de UpcomingVisitsWidget) invoca o orquestrador com `{date, metrics_summary}` agregando stats/pipelines/WA/overdue; resposta parseada como JSON array/`bullets[]` ou fallback por linha-a-linha renderiza 3 bullets. Sprint 13.IA concluída. | Media | Secrets Anthropic/OpenAI + modulo granular |
| Sprint 13.IA-dash | Dashboard de Uso/Consumo IA (configuracoes/ia como root) | ✅ **Concluido (2026-04-17)** — PR1: migrations 165-169 aplicadas em produção (`ai_usage_snapshots` com UNIQUE provider+snapshot_date, `company_ai_config` extendida com admin keys + `openai_organization_id`, RPC `ai_usage_stats(from,to,provider?,agent_slug?)` SECURITY DEFINER retornando `{kpis,daily,top}` com custo estimado por modelo, job `pg_cron` `ai_billing_sync_daily` agendado para 00:01 UTC via `net.http_post` com `x-trigger-secret`). `AiAgentsPanel` ganha campos Anthropic Admin Key, OpenAI Admin Key, Organization ID no card "Chaves de API" com toggle Eye/EyeOff e divisor explicativo separando inference keys das admin keys. **PR2**: Edge Function `ai-billing-sync` (`verify_jwt=false`, auth dual via `x-trigger-secret` para cron ou JWT admin para chamada manual; fetch paralelo de usage+cost por provider, agrega tokens_input/output/requests_count/total_spent_usd, UPSERT em `ai_usage_snapshots`, pula providers sem admin key com `status='skipped'`). Edge Function `ai-billing-manual-refresh` (`verify_jwt=false` com validação interna de admin/super_admin, rate-limit de 5min por `fetched_at` do último snapshot respondendo 429 com `retry_after_seconds`, delega para `ai-billing-sync` via fetch interno). **PR3**: refactor de `AiAgentsPanel` em sub-abas ("Visão geral"/"Agentes"/"Chaves de API") com sub-tabs lifted para o header do `SettingsPage` (padrão border-wrapped pill `bg-brand-primary text-brand-secondary`). Novo componente `AiUsageDashboard` com KPIs de período, card "Custo Diário" (gráfico de barras), top 10 agentes e botão "Atualizar agora" invocando `ai-billing-manual-refresh`. Migration 170 adiciona `anthropic_workspace_id` (filtra consumo a um Workspace da Anthropic via `workspace_ids[]`). **Pivot de escopo (2026-04-17)**: migration 171 drop `ai_recharges` + colunas `balance_*`/`auto_recharge_*`/`balance_alert_threshold` — nem Anthropic nem OpenAI expõem saldo via Admin API, e a heurística de recarga inferida passava falsa sensação de precisão (saldo real é compartilhado entre workspaces/projetos e só confiável no console do provider). Dashboard final mantém apenas consumo real (`total_spent_usd`, tokens, requests) com link "Ver saldo no console" por provider. Toggle Anthropic/OpenAI no card "Chaves" movido para cima do card com padrão border-wrapped brand-secondary. Sprint 13.IA-dash concluída. Detalhes em §10.8B.

Roadmap original: — PR1: migrations 165-169 (`ai_usage_snapshots`, `ai_recharges`, extender `company_ai_config` com admin keys, RPC `ai_usage_stats`, job `pg_cron` 00:01). PR2: Edge Functions `ai-billing-sync` + `ai-billing-manual-refresh` (consomem Anthropic Admin API `/v1/organizations/usage_report` + OpenAI `/v1/organization/usage` e `/costs`). PR3: refactor `AiAgentsPanel` em sub-abas (Visão geral default, Agentes, Chaves) + novo `AiUsageDashboard` (KPIs periodo, saldo estimado por provider, top agentes, gráfico histórico, filtros Hoje/Semana/Mês/Personalizado). PR4 opcional: registro manual de recargas + alertas de saldo baixo. **Dependências de integração**: ⚠️ saldo em tempo real e auto-recarga **não têm API pública** em nenhum dos dois providers — dashboard lê tokens/custo via admin keys e estima saldo via snapshots + recargas manuais; auto-recarga fica read-only com deep link para o console do provider. Exige Admin API keys separadas das keys de inference (Anthropic: Organization Admin Key; OpenAI: `sk-admin-*` + `OpenAI-Organization` header). | Media | Admin API keys Anthropic/OpenAI + pg_cron + net.http_post |
| Sprint 13.IA.v2 | Agentes Proativos Contextuais (event-driven + cron + nudge por rota) | ✅ **Concluído (2026-04-18)** — PR1-PR5 entregues, migrations 174-183. PR1 (infra): `ai_insights` + `ai_event_bindings`, 3 edge functions (`ai-event-dispatcher`, `ai-login-refresh`, `ai-scheduled-runner`), hook `useAiInsights`, `AiInsightsInbox` + `AiComposeMessage`, integração no `AdminAuthContext`/`AdminHeader`. PR2 (acadêmico): RPC `calculate_academic_risk` + agente `academic_pulse` (cron hourly) + `AiContextualNudge` (FAB bottom-right com `useAiRouteContext`, scoped por rota/role, NudgeBoundary defensivo). PR3 (portais): `student_study_buddy` (cron 6h), `guardian_pulse` (cron 12h), `lost_found_match` (trigger INSERT em `lost_found_items`) + hook `usePortalAiInsights` + montagem nos layouts do aluno e responsável. PR4 (financeiro): RPCs `delinquency_snapshot`/`admin_pulse_snapshot` + `financial_anomaly_scout` (cron 1h + trigger em `financial_installments.status`) + `admin_pulse` (run_on_login + cron 1h). PR5 (secretaria): RPC `detect_registration_issues` + `secretary_pulse` (cron 1h) + migration 183 com 3 jobs `pg_cron` (hourly/6h/12h) despachando para `ai-scheduled-runner`. Detalhes em §10.8C. | Media | Sprint 13.IA + 13.IA-dash |
| Fase 16 | Módulo RH — Cadastro expandido + Processo seletivo + Captação pública + 3 agentes IA (`resume_screener`, `resume_extractor`, `pre_screening_interviewer`) | 🟡 **Em progresso (2026-04-18)** — plano aprovado em 5 PRs (folha de pagamento adiada para v2). ✅ **PR1 concluído** (migrations 185-187 aplicadas em produção, edge functions `staff-grant-access` v1 + `staff-revoke-access` v1 publicadas em `dinbwugbwnkrzljuocbs` com `verify_jwt=true`, `ColaboradoresPage` + drawer multi-tab + grupo "RH" na sidebar + rota `/admin/rh/colaboradores`). ✅ **PR2 concluído** (migrations 204-205 aplicadas, `SeletivoPage` com sub-tabs Vagas + Pipeline, kanban horizontal de 6 colunas com drag-and-drop HTML5 nativo, `VagaDrawer` + `CandidatoDrawer` com preview PDF inline e card de Análise IA, RPC `promote_candidate_to_staff` + trigger AFTER UPDATE cria staff automaticamente ao mover para `contratado`, rota `/admin/rh/seletivo` + item na sidebar). ⚠️ **PR3 replanejado** (2026-04-18) — PR3a entregue (migration 206 seeds `resume_extractor` + `resume_screener` Haiku 4.5 com wrapper anti-injection; `src/lib/extractPdfText.ts` + `vite.config.ts` target `es2022` para TLA do pdfjs-dist 4.x) mas escopo original (botão "Analisar com IA" manual) estava invertido. Novo PR3 = **captação pública automática** (`/trabalhe-conosco` com seleção de área → vaga publicada ou cadastro reserva → form + upload → `resume_extractor` em background → chat com `pre_screening_interviewer` → candidatura aparece pronta no kanban em `triagem`). Botão manual do `CandidatoDrawer` será removido. Novas migrations 207-209, 211 (210 = `nfe_stock_ledger` do Financeiro). **PR4 pendente**: captação pública `/trabalhe-conosco` (migrations 191-195, edge functions `careers-intake` + `careers-interview-turn`, agente `pre_screening_interviewer` com DISC/Big Five/MBTI/STAR, Config > Site > Carreiras e Config > RH). **PR5 opcional**: importação em massa de colaboradores (migration 196, `bulk-import-staff`). Detalhes em §10.17. | Media | Cadastro de colaboradores (OP-1 PR5), Sprint 13.IA (ai-orchestrator), Fase 7 (Whitelabel system_settings) |
| Fase 17 | Analytics Avançada (`cash_flow_forecast`, `satisfaction_analyzer`, `agenda_optimizer`, `stock_demand_forecast`) | ⏳ Pendente (pós-v1) | Baixa-Media | Sprint 13.IA.v2 |
| DASH-1 | Dashboards por Permissao (1 dashboard compartilhado, blocos auto-filtrantes) | ✅ Concluido (2026-04-17) | Media-Alta | Permissoes granulares (migration 143) |

**Dependencias**: Fase 9.5 pode ser desenvolvida imediatamente (8+9 concluidos). Fases 10 e 10.P compartilham as mesmas dependencias (9+9.M) e devem ser desenvolvidas **em paralelo** — o Portal do Professor gera os dados (frequencia, notas, conteudo) que o Portal do Responsavel exibe. Fase 11 depende de 10. Fase 12 (agora limitada a BNCC e relatorios avancados) depende de 10.P. Fase 13 depende de 8+9+10 (dados suficientes para insights). Fase 14 depende de 8.5 (caixas e financeiro) e de 10 (portal do responsavel para checkout autenticado).

**Fase 11.B** pode ser desenvolvida em paralelo com Fase 12 — compartilha dependencias com 10 e 10.P mas nao com BNCC/pedagogico. A feature de indicador no diario (DiarioEntradaPage) requer coordenacao com a equipe que mantiver Fase 10.P.

**Fase 11.C** expande a `student_health_records` criada na Fase 11 (migration 83) — pode ser desenvolvida logo apos Fase 11 sem bloquear 11.B ou 12.

**Decisao de arquitetura (11.B)**: Portaria acessa o sistema como `user` com permissao granular no modulo `portaria` — sem novo role no CHECK constraint. RLS das novas tabelas usa `JOIN role_permissions` em vez de `role IN (...)`.

**Pre-requisitos transversais** (antes das fases 9-12):
- ✅ Renomear tabela `attendance` → `student_attendance` (migration 43)
- ✅ Criar tabela `student_guardians` N:N (migration 44)
- ✅ Adicionar `testimonials` ao seed da tabela `modules` (migration 45)

**Notas de manutencao recentes (2026-04-17)**
- ✅ **Migration 142** (`whatsapp_templates_slug_names`): forca formato slug imutavel para `whatsapp_templates.name` (CHECK constraint `^[a-z0-9_]+$`), evitando que renomeacoes via UI quebrem lookups de codigo. Ver `src/admin/lib/whatsappTemplateIds.ts`.
- ✅ **Migration 143** (`user_permissions_additive_only`): troca COALESCE por OR em `get_effective_permissions`, tornando `user_permission_overrides` puramente aditivo. Limpou 19 linhas "vazias" deixadas pelo save antigo do drawer de usuario. `UsersPage.tsx` agora filtra flags `false` antes do INSERT. Trade-off documentado: nao da mais para "negar explicitamente" um modulo a um user que o role libera — virá com coluna `is_deny` no futuro se necessario.
- ✅ **SelectDropdown rollout** (PRs #18/#19/#20): selects nativos dentro de drawers do admin substituidos pelo componente `SelectDropdown` (FormField.tsx) com icone `AlignJustify` a esquerda + `ChevronDown` a direita + `appearance-none` no `<select>`. Padroniza UX e sinaliza visualmente que e uma lista.

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

### 10.4D Fase 8.5 — ERP Financeiro Completo ✅ Concluido (2026-04-15)

> ✅ **CONCLUÍDA** — Migrations 67–73 aplicadas, todos os componentes UI implementados (2026-04-14).

**Objetivo**: Expandir o Modulo Financeiro (Fase 8) para cobrir o ciclo financeiro completo da instituicao — controle de caixas, movimentacoes avulsas, contas a receber geral (nao apenas mensalidades), contas a pagar, plano de contas hierarquico e relatorios gerenciais.

#### Implementação

**Migrations aplicadas:**
| # | Arquivo | Descrição |
|---|---|---|
| 67 | `financial_account_categories` | Plano de contas hierárquico |
| 68 | `financial_cash` | Caixas e movimentações |
| 69 | `financial_receivables` | Contas a receber |
| 70 | `financial_payables` | Contas a pagar |
| 71 | `financial_erp_permissions` | Módulos e permissões (5 novos módulos) |
| 72 | `financial_integration_rpcs` | RPCs: create_enrollment_receivable, create_event_receivables |
| 73 | `financial_report_views` | Views: cash_flow_view, dre_view, delinquency_view |

**Componentes criados:**
- `FinancialCashPage.tsx` — Caixas com ciclo abertura/fechamento
- `FinancialReceivablesPage.tsx` — A/R geral com parcelamento e recorrência
- `FinancialPayablesPage.tsx` — A/P com alertas de vencimento
- `FinancialReportsPage.tsx` — 5 sub-tabs (Fluxo de Caixa, DRE, Inadimplência, Previsão, Extrato)
- `FinancialSettingsPanel.tsx` — 2 novos cards: Plano de Contas e Formas de Pagamento

**Tipos TypeScript** adicionados em `src/admin/types/admin.types.ts`:
`FinancialAccountCategory`, `FinancialCashRegister`, `FinancialCashMovement`, `FinancialReceivable`, `FinancialPayable` + todos os status/label/color maps.

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
| `document_templates` | 82 | Templates de declaracao com HTML + variaveis |
| `document_requests` | 82 | Solicitacoes e status (pending → approved → generated → delivered) |
| `student_health_records` | 83 | Ficha de saude por aluno (base); expandida em Fase 11.C (migration 91) |
| `reenrollment_campaigns` | 84 | Campanhas de rematricula |
| `reenrollment_applications` | 84 | Processos individuais de rematricula |

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

### 10.6B Fase 11.B — Portal do Responsavel + Modulo de Portaria

> ✅ **CONCLUÍDA** — Migrations 88–90 aplicadas (2026-04-16).

#### O que foi construído

**Migrations:**
- `00000000000088_absence_communications.sql` — tabelas `absence_reason_options` e `absence_communications`; ALTER TABLE `diary_attendance` adiciona FK `absence_communication_id`; RLS completo
- `00000000000089_exit_authorizations.sql` — tabelas `authorized_persons` e `exit_authorizations`; trigger append-only no `audit_log`; RLS com JOIN em `role_permissions`
- `00000000000090_portaria_permissions.sql` — inserção dos módulos `absence-communications`, `exit-authorizations` e `portaria` na tabela `modules`; permissões por role; categoria WhatsApp `portaria`

**Componentes UI criados (admin):**
- `src/admin/pages/school/FaltasComunicacoesPage.tsx` — fila de comunicações de falta com análise e vínculo ao diário
- `src/admin/pages/school/AutorizacoesSaidaAdminPage.tsx` — fila de autorizações excepcionais de saída com confirmação de senha
- `src/admin/pages/school/PortariaPage.tsx` — módulo de portaria: frequência do dia e confirmação de retiradas autorizadas

**Funcionalidades entregues:**
- Responsável comunica falta programada ou justificativa pelo portal (`/responsavel/faltas`)
- Coordenador/admin analisa e vincula comunicação ao registro de `diary_attendance`
- Responsável solicita autorização de saída excepcional com confirmação por senha e log de auditoria imutável (`/responsavel/autorizacoes-saida`)
- Portaria consulta frequência do dia e confirma saída autorizada com timestamp e usuário
- Permissão granular via `role_permissions` (módulo `portaria`) — sem novo role no schema

**Nota:** Tier 1 de biometria (WebAuthn) ficou pendente para sprint pós-11.B; único nível entregue foi Tier 2 (senha via `validate-guardian-password`).

---

**Objetivo**: Conectar o portal do responsavel ao modulo academico e ao novo modulo de portaria, cobrindo comunicacao de faltas (programadas e justificativas), autorizacoes de saida excepcional com confirmacao por senha e log de auditoria imutavel, pessoas autorizadas fixas no cadastro do aluno e controle operacional de entrada/saida na portaria.

**Dependencias**: Fase 10 (guardian_profiles, student_guardians), Fase 10.P (class_diary_entries + diary_attendance para vincular falta justificada), Fase 11 (padrao de modulos/permissoes da secretaria como referencia)

**Paralelo com**: Pode ser desenvolvida em paralelo com Fase 12 (pedagogico) — nao compartilham dependencias de dados.

#### 11.B.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Comunicacao de Faltas (Responsavel) | Formulario com calendario (falta programada = data futura, justificativa = data passada), tipo, motivo seletor configuravel, texto livre, anexo opcional | Alta |
| Fila de Analise de Faltas (/academico) | Coordenador aceita/recusa; aceita → registra justificativa no diario; recusa → notificacao ao responsavel com mensagem | Alta |
| Indicador no Diario de Classe | Professor ve falta justificada aceita com resumo do motivo (somente leitura) | Alta |
| Autorizacao de Saida Excepcional (Responsavel) | Dados do terceiro + foto opcional + confirmacao por senha + log imutavel | Alta |
| Fila de Autorizacoes (/academico) | Coordenador autoriza ou recusa; autorizada fica disponivel na portaria | Alta |
| Pessoas Autorizadas Fixas (Cadastro Aluno) | CRUD inline no perfil do aluno: nome, CPF, telefone, foto; visivel na portaria como referencia permanente | Media |
| Modulo de Portaria | Busca frequencia do dia; cards de autorizacoes ativas; confirmacao de saida com timestamp + usuario; notificacao ao responsavel | Alta |

#### 11.B.2 Integracao com Modulos Existentes

| Modulo | Ponto de Integracao | Observacao |
|--------|--------------------|----|
| `student_occurrences` (migration 75) | Tipo `absence_justification` ja existe — o novo `absence_communications` e separado, pois o fluxo e diferente (responsavel inicia; status de aprovacao; vinculo ao diario). O tipo `absence_justification` em `student_occurrences` pode ser descontinuado ou mantido para ocorrencias internas | Sem conflito de schema |
| `diary_attendance` (migration 77) | Ao aceitar uma comunicacao de falta, o coordenador vincula o registro ao `diary_attendance` do aluno na data informada. Campo nullable `absence_communication_id UUID REFERENCES absence_communications` adicionado via ALTER | Requer ALTER na migration 11.B |
| `activity_authorizations` (migration 75) | Modelo diferente (escola → responsavel para autorizar atividades). `exit_authorizations` e responsavel → escola para autorizar saida — fluxo inverso, nova tabela | Sem conflito |
| Portal do Responsavel (`/responsavel/*`) | Duas novas rotas: `/responsavel/faltas` e `/responsavel/autorizacoes-saida` | Requer nova entrada no sidebar |
| `students` (tabela existente) | `authorized_persons` referencia por `student_id`; nao altera a tabela `students` em si | FK reversa |
| Sistema de permissoes granulares (`role_permissions`) | Portaria nao e um novo role — usuarios `user` recebem `can_view + can_edit` no modulo `portaria` via admin. RLS das tabelas de portaria usa JOIN em `role_permissions` em vez de `role IN (...)` | Sem ALTER TABLE profiles; consistente com ModuleGuard do frontend |
| WhatsApp (categoria existente) | Notificacoes por mudanca de status em ambos os fluxos (falta aceita/recusada; autorizacao aceita/recusada/saida efetivada) | Nova categoria `portaria` |

#### 11.B.3 Tabelas

> **Nota de numeracao**: migration 87 foi usada em 2026-04-15 para `fix_module_gaps` (correcao de lacunas no cadastro de modulos). As migrations desta fase iniciam em 88.

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `absence_communications` | 88 | Comunicacoes de falta do responsavel (falta programada + justificativa); status: sent → analyzing → accepted/rejected |
| `absence_reason_options` | 88 | Opcoes configuráveis de motivo de ausencia; CRUD pelo admin em Config > Academico |
| `authorized_persons` | 89 | Pessoas fixas autorizadas a retirar aluno — vinculadas ao cadastro permanente |
| `exit_authorizations` | 89 | Autorizacoes excepcionais de saida; dados do terceiro; confirmacao senha; log imutavel JSONB; efetivacao na portaria |
| ALTER `diary_attendance` | 88 | ADD COLUMN `absence_communication_id UUID REFERENCES absence_communications` |
| Modulos + permissoes portaria | 90 | INSERT INTO modules e role_permissions para portaria, absence-communications, exit-authorizations |

**Schema `absence_communications` (migration 88):**
```sql
CREATE TABLE absence_communications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id         UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  comm_type           TEXT NOT NULL CHECK (comm_type IN ('programmed', 'justification')),
  absence_type        TEXT NOT NULL CHECK (absence_type IN ('full_day', 'delay')),
  absence_date        DATE NOT NULL,
  reason_key          TEXT NOT NULL,  -- saude | compromisso_medico | viagem | familiar | outro
  justification       TEXT NOT NULL,
  attachment_url      TEXT,
  attachment_path     TEXT,
  status              TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','analyzing','accepted','rejected')),
  reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  rejection_message   TEXT,
  diary_attendance_id UUID REFERENCES diary_attendance(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE diary_attendance
  ADD COLUMN IF NOT EXISTS absence_communication_id UUID
    REFERENCES absence_communications(id) ON DELETE SET NULL;
```

**Schema `absence_reason_options` (migration 88):**
```sql
CREATE TABLE absence_reason_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,                    -- nome do icone Lucide (opcional)
  color       TEXT,                    -- cor hex para badge (opcional)
  is_active   BOOLEAN NOT NULL DEFAULT true,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds iniciais
INSERT INTO absence_reason_options (key, label, position) VALUES
  ('saude',              'Saude',              1),
  ('compromisso_medico', 'Compromisso Medico', 2),
  ('viagem',             'Viagem',             3),
  ('familiar',           'Questao Familiar',   4),
  ('outro',              'Outro',              5);
```

> CRUD inline em *Config > Academico* — card "Motivos de Ausencia". Segue padrao `SettingsCard` existente. Admin pode adicionar, reordenar e desativar opcoes sem migration.

**Schema `authorized_persons` (migration 89):**
```sql
CREATE TABLE authorized_persons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name    TEXT NOT NULL,
  cpf          TEXT NOT NULL,
  phone        TEXT NOT NULL,
  photo_url    TEXT,
  photo_path   TEXT,
  relationship TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema `exit_authorizations` (migration 89):**
```sql
CREATE TABLE exit_authorizations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id               UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  -- Dados do terceiro
  third_party_name          TEXT NOT NULL,
  third_party_cpf           TEXT NOT NULL,
  third_party_phone         TEXT NOT NULL,
  third_party_rel           TEXT NOT NULL
                              CHECK (third_party_rel IN ('tio_a','primo_a','vizinho_a','amigo_a','conhecido_a','outro')),
  third_party_photo_url     TEXT,
  third_party_photo_path    TEXT,
  -- Periodo
  valid_from                DATE NOT NULL,
  valid_until               DATE NOT NULL,
  period                    TEXT CHECK (period IN ('morning','afternoon','full_day')),
  -- Seguranca
  password_confirmed_at     TIMESTAMPTZ NOT NULL,
  -- Fluxo
  status                    TEXT NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested','analyzing','authorized','rejected','completed','expired')),
  reviewed_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at               TIMESTAMPTZ,
  rejection_reason          TEXT,
  -- Efetivacao na portaria
  exited_at                 TIMESTAMPTZ,
  exit_confirmed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Log imutavel (append-only via trigger)
  audit_log                 JSONB NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Nota de seguranca**: `audit_log` e append-only via trigger BEFORE UPDATE que bloqueia qualquer reducao do array. A efetivacao na portaria adiciona `{event:'exit_confirmed', at:now(), by:user_id, user_name}` ao JSONB antes de atualizar `exited_at`.

#### 11.B.4 Acesso de Portaria via Permissoes Granulares

Nenhum novo role e adicionado ao CHECK constraint de `profiles`. O acesso ao modulo de portaria e controlado exclusivamente pelo sistema de permissoes granulares existente (`role_permissions`):

- Usuarios com role `user` recebem `can_view=true, can_edit=true` no modulo `portaria` via painel de admin (Usuarios → Permissoes)
- A mesma logica se aplica ao modulo `exit-authorizations`
- Admins e coordinators continuam com acesso completo via suas permissoes de role

**RLS das tabelas de portaria** usa subquery em `role_permissions` em vez de checar `role IN (...)` diretamente:

```sql
-- Exemplo de policy para exit_authorizations (leitura por portaria)
CREATE POLICY "portaria view exit_authorizations"
  ON exit_authorizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN role_permissions rp ON rp.role = p.role
      WHERE p.id = auth.uid()
        AND rp.module_key = 'portaria'
        AND rp.can_view = true
    )
  );
```

Este padrao e consistente com o `ModuleGuard` do frontend — ambos consultam `role_permissions` como fonte de verdade, sem duplicar logica de autorização em campos de role.

**Migration 90** nao inclui mais `ALTER TABLE profiles` — apenas os `INSERT INTO modules` e `INSERT INTO role_permissions` para os tres novos modulos.

#### 11.B.5 Edge Functions

| Funcao | Descricao |
|--------|-----------|
| `validate-guardian-password` | Valida senha do responsavel antes de gravar autorizacao de saida excepcional — Tier 2 do fluxo de re-autenticacao |
| `get-reauth-challenge` | Gera e armazena challenge efemero (TTL 2 min) para re-autenticacao WebAuthn — Tier 1; implementado em sprint de melhorias apos 11.B |
| `notify-exit-confirmed` | Envia notificacao WhatsApp ao responsavel quando portaria confirma saida (hora + nome do usuario de portaria) |

**Re-autenticacao em dois niveis (Autorizacao de Saida Excepcional):**

| Nivel | Tecnologia | Condicao de ativacao | Status |
|-------|-----------|---------------------|--------|
| Tier 1 — Biometria | WebAuthn (`navigator.credentials.get` com autenticador de plataforma) | `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() === true` AND credencial registrada em `/responsavel/perfil` | Implementar em sprint de melhorias pos-11.B |
| Tier 2 — Senha | Modal de senha → Edge Function `validate-guardian-password` → `supabase.auth.signInWithPassword` | Fallback universal; unico nivel entregue na Fase 11.B | ✅ Entregue em 11.B |

O registro de credencial WebAuthn e gerenciado em `/responsavel/perfil` como opt-in ("Ativar autenticacao biometrica"). A arquitetura de re-auth nao muda entre Tier 1 e Tier 2 — apenas a camada de verificacao e substituida. Nenhuma breaking change na migration ou na tabela `exit_authorizations`.

#### 11.B.6 Rotas Admin

| Rota | Componente | Roles | Descricao |
|------|-----------|-------|-----------|
| `/admin/faltas` | FaltasComunicacoesPage | admin+, coordinator | Fila de analise + aceitar/recusar; historico por aluno; opcoes de motivo configuradas em Config > Academico |
| `/admin/autorizacoes-saida` | AutorizacoesSaidaAdminPage | admin+, coordinator | Fila de autorizacoes excepcionais + log de auditoria |
| `/admin/portaria` | PortariaPage | admin+, portaria | Busca frequencia + cards autorizacoes ativas + confirmar saida |

#### 11.B.7 Rotas Portal do Responsavel

| Rota | Pagina | Descricao |
|------|--------|-----------|
| `/responsavel/faltas` | FaltasPage | Formulario (falta programada ou justificativa) + historico de comunicacoes + status |
| `/responsavel/autorizacoes-saida` | AutorizacoesSaidaPage | Formulario de autorizacao excepcional com confirmacao por senha + historico |

#### 11.B.8 WhatsApp

**Nova categoria**: `portaria` (cor: `#1e40af` azul-escuro)

| Evento | Destinatario | Template |
|--------|-------------|---------|
| Comunicacao de falta recebida (confirmacao) | Responsavel | `falta-recebida` |
| Falta aceita pela coordenacao | Responsavel | `falta-aceita` |
| Falta recusada — documentacao necessaria | Responsavel | `falta-recusada` |
| Autorizacao de saida aprovada | Responsavel | `autorizacao-aprovada` |
| Autorizacao de saida recusada | Responsavel | `autorizacao-recusada` |
| Saida do aluno efetivada na portaria | Responsavel | `saida-efetivada` (inclui hora + identificacao do usuario) |

#### 11.B.9 Ajuste no Modulo Academico

**DiarioEntradaPage (professor)**: Adicionar indicador visual nas celulas de falta do aluno quando `diary_attendance.absence_communication_id` nao e NULL. Tooltip com motivo resumido. O professor ve mas nao pode alterar o status da justificativa.

**FaltasComunicacoesPage (/admin/academico ou /admin/faltas)**: Fila com cards expandiveis mostrando dados do aluno, turma, data, tipo, motivo, justificativa e anexo. Acoes: Aceitar (select do registro diary_attendance para vincular) e Recusar (campo de mensagem obrigatorio).

#### 11.B.10 Verificacao

1. Responsavel envia falta programada → aparece em `/admin/faltas` com status `analyzing`
2. Coordenador aceita vinculando ao diary_attendance → status `accepted`; professor ve indicador no DiarioEntradaPage
3. Responsavel ve status `aceita` no portal `/responsavel/faltas`
4. Responsavel cria autorizacao excepcional → confirmacao de senha (Edge Function) → status `requested`
5. Coordenador autoriza → status `authorized`; card aparece em `/admin/portaria`
6. Portaria confirma saida → `exited_at` + `audit_log` atualizado; responsavel recebe notificacao WhatsApp
7. `audit_log` nao pode ser reduzido (trigger append-only)
8. `tsc -b` sem erros apos implementacao
9. `SELECT * FROM modules WHERE module_key IN ('portaria','absence-communications','exit-authorizations')` → 3 linhas

---

### 10.6C Fase 11.C — Ficha de Saude Expandida

> ✅ **CONCLUÍDA** — Commit c08d37d, 2026-04-16.

#### O que foi construído

**Migration:**
- `00000000000091_health_expanded.sql` — ALTER TABLE `student_health_records` adiciona `food_restrictions`, `allergy_categories JSONB`, `can_receive_medication BOOLEAN`, `medication_guidance`; tabelas `student_medical_certificates` (com trigger de superseding) e `health_record_update_requests` (com trigger de aplicação automática ao confirmar); VIEW `student_health_records_teacher_view` com campos não-sensíveis; bucket Storage `atestados` (privado, 10 MB); módulo `health-records-management`; keys de `system_settings` para configuração de alertas e campos obrigatórios

**Componentes UI:**
- `src/admin/pages/school/StudentDetailPage.tsx` — nova aba `StudentHealthTab` com sub-tabs "Ficha de Saúde" e "Atestados"; drawer de adição de atestado médico com upload para bucket `atestados`
- `src/admin/pages/secretaria/SecretariaPage.tsx` — aba Fichas de Saúde expandida com novos campos e fila de atualizações pendentes do responsável
- `src/admin/pages/settings/AcademicoSettingsPanel.tsx` — card de configuração de saúde (campos obrigatórios, dias de alerta, permitir atualização pelo responsável)

**Portal do Responsável:**
- `src/responsavel/pages/saude/SaudePage.tsx` — visualização completa da ficha; formulário de atualização com diff antes/depois; upload de atestado; acompanhamento de status das solicitações em tempo real (`/responsavel/saude`)

**Campos e tabelas de saúde entregues:**
- Campos novos em `student_health_records`: restrições alimentares, categorias de alergia, autorização de medicamento em horário escolar, orientação de administração
- `student_medical_certificates`: histórico de atestados com médico + CRM; trigger automático de superseding; status calculado (válido/vencido)
- `health_record_update_requests`: fluxo de proposta → revisão → aplicação automática via trigger ao confirmar; snapshot para diff
- VIEW `student_health_records_teacher_view`: professores veem apenas alergias, condições, medicamentos e restrições alimentares — sem dados de emergência ou plano de saúde

---

**Objetivo**: Expandir a ficha de saude do aluno (base criada em Fase 11/migration 83) com categorizacao de alergias, restricoes alimentares, orientacoes de medicamentos, controle de atestado medico para atividades fisicas com historico de versoes e status calculado, fila de atualizacoes do responsavel com revisao obrigatoria pela secretaria, visao restrita para professores e painel de alertas de vencimento.

**Dependencias**: Fase 11 (tabela `student_health_records` e tab Fichas de Saude na SecretariaPage), Fase 10 (guardian_profiles + portal do responsavel para o fluxo de atualizacoes)

**Expansao de**: `student_health_records` (migration 83) — sem quebra de schema; todos os campos sao aditivos

#### 11.C.1 Sub-modulos

| Feature | Descricao | Prioridade |
|---------|-----------|------------|
| Ficha de Saude Expandida | Alergias categorizadas (alimentar/medicamentosa/ambiental/outras), restricoes alimentares, orientacao de medicamentos em horario escolar, campos can_receive_medication | Alta |
| Atestado de Aptidao Fisica | Tabela com historico de versoes; status calculado (valido/vencido/pendente); upload Storage; medico + CRM; alerta de vencimento | Alta |
| Atualizacoes pelo Responsavel | Responsavel submete proposta de atualizacao; secretaria confirma ou rejeita antes de efetivar; historico de tentativas | Alta |
| Visao Restrita do Professor | VIEW `student_health_records_teacher_view` com apenas alergias, condicoes, medicamentos, restricoes alimentares; sem dados de emergencia, plano de saude ou autorizacoes | Alta |
| Configuracoes (Config > Academico) | Exigir atestado por segmento; antecedencia do alerta; campos obrigatorios; permitir atualizacao pelo responsavel | Media |
| Painel de Alertas (Secretaria) | Cards de atestados vencidos/proximos do vencimento + atestados pendentes em segmentos que exigem + medicamentos sem orientacao de administracao | Alta |
| Relatorio de Pendencias | Listagem filtravel com exportacao CSV/Excel; filtra por segmento, status, tipo de pendencia | Media |
| Portal do Responsavel `/responsavel/saude` | Visualizacao completa; formulario de atualizacao com diff antes/depois; upload de atestado; status em tempo real | Alta |

#### 11.C.2 Integracao com Modulos Existentes

| Modulo | Ponto de Integracao | Observacao |
|--------|--------------------|----|
| `student_health_records` (migration 83) | ALTER TABLE adiciona: `food_restrictions TEXT`, `allergy_categories JSONB [{type, description}]`, `can_receive_medication BOOLEAN DEFAULT true`, `medication_guidance TEXT` | Campos existentes preservados — migracao aditiva |
| `SecretariaPage.tsx` (Fase 11) | Tab "Fichas de Saude" expandida: novos campos, aba de atestado, fila de atualizacoes pendentes, painel de alertas | Amplia funcionalidade existente |
| `StudentDetailPage.tsx` (admin) | Nova aba/secao "Saude" no perfil do aluno com ficha completa + historico de atestados + atualizacoes recentes | Requer nova aba no detalhe do aluno |
| Portal do Responsavel | Nova rota `/responsavel/saude` no sidebar (apos Rematricula) | Novo item de navegacao |
| Config > Academico (`AcademicoSettingsPanel`) | Novo card "Ficha de Saude" com toggles por segmento para exigencia de atestado + campos de configuracao | Segue padrao SettingsCard existente |
| `system_settings` | Keys: `health.require_certificate_segments UUID[]`, `health.certificate_alert_days INT DEFAULT 30`, `health.required_fields TEXT[]`, `health.allow_guardian_updates BOOLEAN DEFAULT true` | Padrao existente (billing_stages, installment_configs) |
| pg_cron (migration existente 65) | Novo job diario `check_certificate_expiry`: varre `student_medical_certificates` onde `valid_until BETWEEN now() AND now() + alert_days`, insere em `alert_notifications` se ainda nao existe alerta para o par (student, certificate) no periodo | Reutiliza infraestrutura de cron ja existente |
| Supabase Storage | Bucket `atestados` (privado, 10 MB, PDF + image/*) — upload direto via RLS do portal do responsavel sem Edge Function intermediaria; signed URLs de 30 dias para leitura | Mesmo padrao do bucket `student-photos` (upload direto) |

#### 11.C.3 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| ALTER `student_health_records` | 90 | ADD COLUMNS: food_restrictions, allergy_categories JSONB, can_receive_medication BOOLEAN, medication_guidance |
| `student_medical_certificates` | 90 | Atestados com historico de versoes; status calculado; upload; medico + CRM |
| `health_record_update_requests` | 90 | Propostas de atualizacao do responsavel com snapshot para diff + status de revisao |
| `student_health_records_teacher_view` | 90 | VIEW RLS para professores com apenas campos nao-sensiveis |
| system_settings keys + modulo config | 91 | Chaves de configuracao + ajuste de permissoes |

**Schema `student_medical_certificates` (migration 91):**
```sql
CREATE TABLE student_medical_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  issue_date        DATE NOT NULL,
  valid_until       DATE NOT NULL,
  doctor_name       TEXT NOT NULL,
  doctor_crm        TEXT NOT NULL,
  file_path         TEXT,                    -- Storage bucket 'atestados'
  file_url          TEXT,
  file_url_expires_at TIMESTAMPTZ,
  observations      TEXT,
  -- Status calculado: valido = valid_until >= today; vencido = valid_until < today
  -- (nao armazenado — computado na query ou via generated column)
  uploaded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_via      TEXT NOT NULL DEFAULT 'admin'
                      CHECK (uploaded_via IN ('admin','guardian_portal')),
  is_active         BOOLEAN NOT NULL DEFAULT true,   -- false quando substituido
  superseded_by     UUID REFERENCES student_medical_certificates(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_student ON student_medical_certificates(student_id);
CREATE INDEX idx_certificates_valid_until ON student_medical_certificates(valid_until)
  WHERE is_active = true;
```

> **Status calculado**: `CASE WHEN valid_until >= CURRENT_DATE THEN 'valid' WHEN valid_until < CURRENT_DATE THEN 'expired' ELSE 'pending' END`. Nao armazenado — evita inconsistencias. O pg_cron gera alertas, nao muda o status.

**Schema `health_record_update_requests` (migration 91):**
```sql
CREATE TABLE health_record_update_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id       UUID NOT NULL REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  proposed_data     JSONB NOT NULL,   -- snapshot completo dos campos propostos
  current_snapshot  JSONB NOT NULL,   -- snapshot dos dados vigentes no momento da proposta
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','rejected')),
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**VIEW `student_health_records_teacher_view` (migration 91):**
```sql
CREATE VIEW student_health_records_teacher_view AS
SELECT
  id, student_id,
  has_allergies, allergies, allergy_categories, allergy_notes,
  has_special_needs, special_needs, learning_difficulties,
  chronic_conditions,
  food_restrictions,
  uses_medication, medications,
  can_receive_medication, medication_guidance,
  updated_at
FROM student_health_records;

ALTER VIEW student_health_records_teacher_view OWNER TO authenticated;
-- RLS na VIEW via security_invoker + policy em student_health_records para role='teacher'
```

> **Nota**: Os campos `health_plan`, `health_plan_number`, `emergency_contact_*`, `authorized_photo`, `authorized_first_aid`, `authorized_evacuation` e `notes` sao **excluidos** da view. O professor ve apenas dados operacionais para o dia a dia (alergias, condicoes, medicamentos, restricoes alimentares, necessidades especiais).

#### 11.C.4 Configuracoes (system_settings)

| Key | Tipo | Padrao | Descricao |
|-----|------|--------|-----------|
| `health.require_certificate_segments` | `UUID[]` | `[]` | Segmentos que exigem atestado de aptidao fisica |
| `health.certificate_alert_days` | `INT` | `30` | Dias de antecedencia para alerta de vencimento |
| `health.required_fields` | `TEXT[]` | `['blood_type']` | Campos obrigatorios para cadastro completo |
| `health.allow_guardian_updates` | `BOOLEAN` | `true` | Habilita envio de atualizacoes pelo portal |

Config card em *Config > Academico* — segue padrao `SettingsCard`. Campos:
- Toggle individual por segmento cadastrado (fetch de `school_segments`)
- Slider numerico para antecedencia do alerta (1-90 dias)
- Checklist de campos obrigatorios
- Toggle global para atualizacoes pelo responsavel

#### 11.C.5 Edge Functions / Jobs

| Funcao / Job | Tipo | Descricao |
|---|---|---|
| pg_cron `check_certificate_expiry` | Job diario 08:00 | Varre certificados ativos; compara `valid_until` com `now() + alert_days`; insere em `alert_notifications` se ja nao existe alerta ativo para o par (student_id, certificate_id) |
| pg_cron `deactivate_expired_certs` | Job diario 00:05 | (Opcional) Marca `is_active=false` em certificados onde `valid_until < CURRENT_DATE - 90 days` — limpeza de historico antigo |
| Trigger `on_certificate_upload` | AFTER INSERT | Marca como `is_active=false` o certificado anterior do mesmo aluno e preenche `superseded_by` no registro antigo |
| Trigger `on_update_request_confirmed` | AFTER UPDATE status='confirmed' | Copia campos de `proposed_data` para `student_health_records` do aluno |

#### 11.C.6 Permissoes

| Perfil | student_health_records | student_medical_certificates | health_record_update_requests |
|--------|----------------------|------------------------------|-------------------------------|
| super_admin / admin | CRUD completo | CRUD completo | Visualizar + confirmar/rejeitar |
| coordinator | CRUD completo | CRUD completo | Visualizar + confirmar/rejeitar |
| teacher | VIEW restrita (`student_health_records_teacher_view`) — somente leitura | Sem acesso | Sem acesso |
| responsavel | SELECT proprio filho (via RLS student_guardians) | SELECT + INSERT (upload atestado) | INSERT + SELECT proprios |
| portaria | SELECT restrito (apenas alergias + medicamentos) | SELECT (validade apenas) | Sem acesso |

**Modulo adicionado**: `health-records-management` (secretaria/admin gerenciam) + ajuste em `secretaria-saude` para incluir permissao de confirmacao de atualizacoes.

#### 11.C.7 Rotas e Frontend

| Camada | Componente | Alteracao |
|--------|-----------|-----------|
| `/admin/secretaria` (tab Fichas de Saude) | `SecretariaFichasSaudeTab` | Expandir drawer com novos campos; adicionar sub-tab Atestados; adicionar sub-tab Atualizacoes Pendentes; adicionar painel de alertas acima da tabela |
| `/admin/alunos/:studentId` | `StudentDetailPage` | Nova aba "Saude" na 4a posicao: Resumo | Academico | Financeiro | **Saude** | Documentos | Observacoes; ficha completa + historico de atestados + atualizacoes recentes |
| `/responsavel/saude` | `SaudePage` (nova) | Visualizacao completa da ficha; formulario de proposta de atualizacao com diff antes/depois; upload de atestado; status atual |
| `/admin/configuracoes` > Academico | `AcademicoSettingsPanel` | Novo card "Ficha de Saude" com todos os toggles de configuracao |

#### 11.C.8 WhatsApp

| Evento | Destinatario | Template |
|--------|-------------|---------|
| Atestado vencido ou proximo do vencimento | Responsavel | `atestado-vencimento` |
| Atualizacao da ficha de saude confirmada pela secretaria | Responsavel | `saude-atualizada` |
| Atualizacao recusada — documentacao insuficiente | Responsavel | `saude-recusada` |
| Upload de novo atestado pelo responsavel | Secretaria (notificacao interna) | notificacao interna (alert_notifications) |

#### 11.C.9 Oportunidades de Melhoria Identificadas

| Oportunidade | Descricao | Prioridade |
|---|---|---|
| **Integracao com Fase 11.B (Portaria)** | Portaria visualiza alergias e medicamentos criticos do aluno na tela de confirmacao de saida — dado ja disponivel na view restrita do professor | Alta |
| **Integracao com Atendimento (Fase 1-5)** | Em atendimentos presenciais, exibir alerta discreto se aluno possui alergia ou condicao relevante no perfil | Baixa |
| **Notificacao de atualizacao pendente** | Badge na SecretariaPage quando ha atualizacoes pendentes de revisao (realtime via Supabase channels) | Media |
| **Exportacao LGPD** | Incluir ficha de saude na exportacao de dados pessoais do aluno via painel LGPD (se existir) | Media |
| **Campo "autorizado a receber medicamento"** | Futuro: vincular ao fluxo de registros de administracao de medicamentos pela enfermaria (modulo de saude escolar mais completo — Fase 14+) | Baixa |

#### 11.C.10 Verificacao

1. Aba "Saude" visivel no detalhe do aluno em `/admin/alunos/:id`
2. Novos campos (food_restrictions, allergy_categories, can_receive_medication) salvos e recuperados corretamente
3. Upload de atestado → bucket `atestados` → signed URL gerada → status calculado `valid`
4. Atestado vencido → status `expired` calculado automaticamente sem job (query-time)
5. pg_cron gera alerta antes do vencimento conforme `health.certificate_alert_days`
6. Responsavel submete atualizacao → aparece em fila na SecretariaPage
7. Secretaria confirma → `proposed_data` copiado para `student_health_records`; responsavel notificado
8. Professor acessa `student_health_records_teacher_view` — nao ve `health_plan`, `emergency_contact_*` nem `notes`
9. Config > Academico → card "Ficha de Saude" salva toggles em `system_settings`
10. Relatorio de pendencias exporta CSV/Excel com filtros aplicados

---

### 10.7 Fase 12 — Modulo Pedagogico Avancado

> ✅ **CONCLUÍDA** — Migration 107, Sprint 5, 2026-04-16.

**Objetivo**: Complementar o Diario de Classe (Fase 10.P) com objetivos de aprendizagem referenciados na BNCC, associacao plano-objetivo e relatorios pedagogicos avancados para coordenadores.

**Dependencias**: Fases 9 e 10.P concluidas (requer dados do diario para calcular cobertura curriculo)

> **Nota**: O Diario de Classe, Planos de Aula e Elaboracao de Provas foram extraidos para a **Fase 10.P** (executada em paralelo com a Fase 10). A migration 34 originalmente planejada para esta fase foi absorvida pela migration 76 da Fase 10.P. Esta fase foca exclusivamente em BNCC e analytics pedagogico avancado.

#### 12.1 Sub-modulos Entregues

| Feature | Descricao | Status |
|---------|-----------|--------|
| Objetivos de Aprendizagem (BNCC) | CRUD por disciplina + segmento; codigo BNCC, competencia, ativo/inativo; aba Fiscal no drawer com toggle no header | ✅ |
| Associacao Plano-Objetivo | N:N lesson_plans x learning_objectives; checkboxes no drawer do plano de aula (Portal do Professor) | ✅ |
| Cobertura Curricular | Por turma/disciplina: % objetivos cobertos em planos executados; progress bars por objetivo | ✅ |
| Relatorios Pedagogicos Avancados | Por turma: frequencia media, nota media por disciplina, alunos em risco (freq < 75% ou media < 5.0) | ✅ |
| Dashboard BNCC | KPIs (objetivos ativos, associacoes, planos com objetivos, cobertura %); grafico por segmento; top-5 objetivos mais usados | ✅ |

#### 12.2 Tabelas

| Tabela | Migration | Descricao |
|--------|-----------|-----------|
| `learning_objectives` | 107 | Objetivos de aprendizagem: subject_id, segment_id, school_year INT, code TEXT, title, description, competency, is_active |
| `lesson_plan_objectives` | 107 | N:N lesson_plans x learning_objectives |

#### 12.3 Acesso Admin

O modulo BNCC esta integrado como aba dentro de `/admin/academico` (tab rail lateral). A rota standalone `/admin/objetivos` foi removida.

| Localizacao | Descricao |
|-------------|-----------|
| `/admin/academico` → aba BNCC | Container com sub-abas horizontais: Dashboard · Objetivos · Cobertura BNCC · Relatorios Pedagogicos |

#### 12.4 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `lesson_plans` (Fase 10.P) | Drawer de plano de aula exibe checkboxes de objetivos BNCC filtrados por disciplina/segmento; salva em lesson_plan_objectives |
| `class_diary_entries` (Fase 10.P) | Dados de frequencia usados nos relatorios pedagogicos (freq media por aluno/turma) |
| `activity_scores` (Fase 10.P) | Notas usadas no calculo de media e identificacao de alunos em risco |
| `school_segments` / `school_series` | Filtros de segmento e ano/serie no cadastro de objetivos; selector de serie carregado dinamicamente pelo segment_id |

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

### 10.8B Sprint 13.IA-dash — Dashboard de Uso e Consumo de IA (proposto)

**Objetivo**: transformar a aba **Configurações → IA (Agentes)** em uma experiência com **dashboard como tela raiz**, agregando telemetria interna (`ai_usage_log`) + dados de billing dos providers (Anthropic/OpenAI). A lista de agentes e o card de chaves migram para sub-abas internas (ex.: "Visão geral", "Agentes", "Chaves de API"). Oferecer visão total de consumo, saldo e histórico sem precisar abrir os consoles externos.

#### 13.IA-dash.1 Escopo funcional

| Bloco | Conteúdo | Fonte |
|---|---|---|
| KPIs de período | Tokens (input/output), chamadas, latência média, taxa de erro, custo estimado | `ai_usage_log` (interno) |
| Saldo / crédito | Saldo atual Anthropic + OpenAI, último valor de recarga, data | API externa (ver dependências) |
| Recargas | Histórico das últimas 10 recargas (valor, data, método) | API externa |
| Auto-recarga | Status (on/off), threshold, valor de recarga, botão "abrir console do provider" | API externa (limitado) |
| Agentes mais usados | Top 10 por chamadas / por custo / por tokens | `ai_usage_log` |
| Gráfico histórico | Série temporal diária (tokens, custo, chamadas) | `ai_usage_snapshots` (nova) |
| Filtros | Hoje / Semana / Mês / Personalizado + por provider + por agente | UI |

#### 13.IA-dash.2 Arquitetura

```
┌───────────────────────────────────────────┐
│ UI /admin/configuracoes?tab=ia             │
│ - Sub-tab "Visão geral" (dashboard root)   │
│ - Sub-tab "Agentes" (painel atual)         │
│ - Sub-tab "Chaves de API"                  │
└──────────────┬────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────┐
│ Query 1 (rápida): ai_usage_log + RPCs      │
│ → KPIs por período, tops, série diária     │
└───────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────┐
│ Query 2 (snapshot diário): ai_usage_snapshots│
│ → saldo, recargas, custo oficial do provider│
└───────────────────────────────────────────┘
               ▲
               │ 00:01 diariamente (pg_cron)
┌──────────────┴────────────────────────────┐
│ Edge Function ai-billing-sync              │
│ - Anthropic: GET /v1/organizations/usage_*  │
│ - OpenAI:   GET /v1/organization/usage/*    │
│ - Persiste em ai_usage_snapshots            │
└───────────────────────────────────────────┘
```

#### 13.IA-dash.3 Novas tabelas / migrations

| Migration | Tabela / objeto | Descrição |
|---|---|---|
| 165 | `ai_usage_snapshots` | Snapshot diário por provider: `id`, `provider` ('anthropic'\|'openai'), `snapshot_date DATE`, `balance_usd NUMERIC`, `total_spent_usd NUMERIC`, `tokens_input BIGINT`, `tokens_output BIGINT`, `requests_count INT`, `auto_recharge_enabled BOOLEAN NULL`, `auto_recharge_threshold NUMERIC NULL`, `auto_recharge_amount NUMERIC NULL`, `raw_payload JSONB`, `fetched_at TIMESTAMPTZ`. UNIQUE `(provider, snapshot_date)`. RLS admin/super_admin SELECT. |
| 166 | `ai_recharges` | Histórico de recargas: `id`, `provider`, `amount_usd`, `recharged_at`, `source` ('manual'\|'auto'), `external_id TEXT`, `raw_payload JSONB`. |
| 167 | `company_ai_config` (alter) | Adicionar colunas `anthropic_admin_api_key_enc TEXT`, `openai_admin_api_key_enc TEXT`, `openai_organization_id TEXT`. Chaves **admin** são separadas das chaves de inference (usadas em `ai-worker-*`). |
| 168 | RPC `ai_usage_stats(p_from, p_to, p_provider?, p_agent_slug?)` | Agregações para o dashboard (tokens, custo estimado, top agentes, série diária). |
| 169 | `pg_cron` job | `select cron.schedule('ai-billing-sync-daily', '1 0 * * *', $$ select net.http_post(...) $$)` — dispara `ai-billing-sync` às 00:01 UTC. |
| 170 | `company_ai_config` (alter) | Adicionar coluna `anthropic_workspace_id TEXT` — quando informada, o `ai-billing-sync` envia `workspace_ids[]=<id>` para a Anthropic Admin API, escopando o consumo a um Workspace específico em vez da organização inteira. |

#### 13.IA-dash.4 Edge Functions novas

| Função | Auth | Descrição |
|---|---|---|
| `ai-billing-sync` | service_role (cron) + admin manual | Chama APIs admin de Anthropic e OpenAI, persiste em `ai_usage_snapshots` + `ai_recharges`. Idempotente por `(provider, snapshot_date)` (UPSERT). Suporta `?force=1` para refazer o dia. |
| `ai-billing-manual-refresh` | JWT admin | Permite "Atualizar agora" no dashboard (com rate limit de 1 call / 5 min para não estourar API admin). |

#### 13.IA-dash.5 Dependências de integração (provider-side)

Este é o bloco crítico — o que é viável hoje:

**Anthropic**
- API admin oficial: `GET https://api.anthropic.com/v1/organizations/usage_report/messages` e `GET /v1/organizations/cost_report`. Exige **Admin API key** (criada no console Anthropic em *Organization → Admin Keys*, distinta da API key usada para inference). Retorna uso em tokens + custo em USD. ✅ Viável para KPIs e custo histórico.
- **Filtro por Workspace**: ambos os endpoints aceitam `workspace_ids[]=<wrkspc_...>` como query param para escopar o relatório a um Workspace específico. Armazenado em `company_ai_config.anthropic_workspace_id` (migration 170) e configurável pelo admin em *Configurações → IA → Chaves de API*. Quando vazio, o sync usa toda a organização.
- **Saldo em tempo real**: **não há endpoint público**. Derivar via `credits_purchased - total_spent` agregado do snapshot. Como workaround, ler `raw_payload` do último snapshot e exibir "saldo estimado".
- **Auto-recarga**: não há API pública para ler ou alterar. UI deve apenas exibir **link "Abrir console Anthropic"** (`https://console.anthropic.com/settings/billing`) e um toggle local informativo (sem efeito real).
- **Recargas**: também não há endpoint público de recharges. Dependemos de inferir a partir de `cost_report` (saltos no saldo) ou registrar manualmente em `ai_recharges` via botão "Registrar recarga".

**OpenAI**
- API admin oficial: `GET https://api.openai.com/v1/organization/usage/completions`, `/usage/embeddings`, `/usage/images`, etc., e `GET /v1/organization/costs`. Exige **Admin API key** (`sk-admin-...`, gerada em *Settings → Organization → Admin keys*) **e** `OpenAI-Organization` header com o `org_id`. ✅ Viável para KPIs e custo.
- **Saldo em tempo real**: endpoint `GET /v1/dashboard/billing/credit_grants` foi descontinuado no plano novo (pay-as-you-go). Derivar via snapshot + recargas manuais, idêntico à Anthropic.
- **Auto-recarga**: configuração existe no console OpenAI (*Settings → Billing → Auto recharge*) mas **não há endpoint público** para ler/alterar. Mesmo workaround: link para console + toggle informativo.
- **Recargas**: sem endpoint público. Mesma estratégia: inferir via costs ou registro manual.

**Conclusões de integração**:
1. Tokens/custo histórico ✅ integráveis via admin keys.
2. Saldo atual ⚠️ estimativa (derivar de snapshots + recargas manuais).
3. Recargas ⚠️ manuais (UI "Registrar recarga" + inferência automática opcional).
4. Auto-recarga ❌ read-only no PRD — apenas link profundo para o console do provider.

#### 13.IA-dash.6 UX do dashboard (Visão geral)

- Header: selector de período (Hoje/Semana/Mês/Personalizado), badge "Última sincronização: DD/MM HH:mm" + botão `RefreshCw` (chama `ai-billing-manual-refresh`).
- Linha 1 — KPIs: 4 StatCards — **Chamadas**, **Tokens totais**, **Custo estimado (USD)**, **Latência média** (cada um com tendência vs. período anterior, padrão `StatCard` existente).
- Linha 2 — Saldo: 2 cards (um por provider) com saldo estimado, última recarga, toggle auto-recarga (read-only) + link "Abrir console". Vermelho quando saldo estimado < threshold configurado.
- Linha 3 — Gráficos: `BarChart` diário de custo (últimos 30 dias) + `BarChart` top agentes (por chamadas).
- Linha 4 — Histórico de recargas: tabela compacta (data, provider, valor, fonte) + botão "Registrar recarga manual".

#### 13.IA-dash.7 PRs sugeridos

- **PR1**: migrations 165–167 + RPC 168 + job cron 169. Extender `company_ai_config` com admin keys. Atualizar `AiAgentsPanel` para expor campo "Admin API key" no card de Chaves.
- **PR2**: Edge Function `ai-billing-sync` + `ai-billing-manual-refresh`. Testar contra sandbox com admin keys reais.
- **PR3**: UI — refactor do `AiAgentsPanel` para sub-abas (`Visão geral` default, `Agentes`, `Chaves de API`). Novo componente `AiUsageDashboard` em `src/admin/pages/settings/ai/` consumindo RPC `ai_usage_stats` + leituras de `ai_usage_snapshots`/`ai_recharges`.
- **PR4** (opcional): registro manual de recargas + alertas por e-mail quando saldo estimado cair abaixo do threshold (cron 06:00 diário).

**Verificação**: rodar `ai-billing-sync` manualmente, conferir `ai_usage_snapshots` populado para ambos providers; abrir dashboard e validar KPIs contra o console do provider; simular período de 7 dias e comparar custo.

---

### 10.8C Sprint 13.IA.v2 — Agentes Proativos Contextuais

**Problema**: Sprint 13.IA + 13.IA-dash entregaram 4 agentes click-to-invoke. O assistente só age quando o humano clica — então só muda o dia a dia se alguém lembrar de abrir a tela certa. Para virar "assistente real", o agente precisa rodar em segundo plano, detectar o que importa sozinho e **colocar o achado na frente do usuário certo, na página certa**.

**Objetivo**: construir a espinha dorsal proativa — tabela `ai_insights` como caixa de entrada do assistente, alimentada por três modos de disparo (Postgres triggers, pg_cron, pre-compute no login) — e surfacá-la em dois lugares complementares:
1. **`<AiInsightsInbox/>`** (navbar): lista completa de insights do usuário (dropdown tipo notificação).
2. **`<AiContextualNudge/>`** (FAB bottom-right): notificação discreta do insight **mais relevante para a rota atual**, tipo balão de chat (mas **não é chat** — é one-way, contextual).

**Isolamento entre roles** é requisito duro: agente do financeiro não vazia informação para professor; agente do aluno não mostra conteúdo de outro aluno. Garantido via RLS de `ai_insights` (existente):
- `audience TEXT[]` + policy teacher `audience && ARRAY['teacher']`
- `recipient_id UUID` + policy guardian/student `recipient_id = auth.uid()`
- admin/coordinator têm SELECT geral

#### PR1 — Espinha dorsal (✅ concluído)
- **migration 174** `ai_insights` — tabela + RLS + indexes + trigger `set_ai_insights_updated_at` + `ALTER PUBLICATION supabase_realtime ADD TABLE`.
- **migration 175** `ai_event_bindings` + alter `ai_agents` com colunas proativas (`run_on_login`, `run_on_event TEXT[]`, `run_on_cron`, `debounce_hours`, `audience`).
- **Edge Function `ai-event-dispatcher`** (`verify_jwt=false`): dual auth, debounce via `context_hash`, invoca orchestrator, UPSERT insight, push-send se crítico.
- **Edge Function `ai-login-refresh`** (JWT admin): fan-out de agentes `run_on_login=true` filtrados por role.
- **Edge Function `ai-scheduled-runner`** (dual auth): orquestra jobs por cadência; cada agente faz fan-out interno via `recipient_id`.
- **Hook `useAiInsights.ts`**: query inicial + Realtime subscribe + `markSeen/dismiss/resolve`.
- **`AiInsightsInbox.tsx`**: dropdown na navbar com Sparkles + badge por severity; ações `navigate`/`whatsapp`/`resolve`.
- **`AiComposeMessage.tsx`**: drawer universal com rascunho via agente `parent_communication` + envio via `message-orchestrator`.
- **`AdminAuthContext`** chama `ai-login-refresh` fire-and-forget pós-`SIGNED_IN`.
- **`AdminHeader`** monta `<AiInsightsInbox/>` ao lado do sino de notificações.

#### PR2 — Nudge contextual + agente acadêmico (✅ concluído)
- **migration 176** RPC `calculate_academic_risk(student_id)` agregando frequência + notas recentes + justificativas.
- **migration 177** seed agente `academic_pulse` (run_on_cron='hourly', audience=['coordinator','teacher'], debounce_hours=1) + binding `cron.academic_pulse` em `ai_event_bindings`.
- **Hook `useAiRouteContext.ts`**: deriva `{module, entity_type, entity_id}` de `useLocation` + `useSearchParams` + `useAdminAuth`.
- **`AiContextualNudge.tsx`**: FAB bottom-right; consome `useAiInsights` filtrado pela rota corrente; aparece como balão discreto (1 insight top-severity por vez); clicar abre card expandido com ação.
- Montagem em `AdminLayout.tsx` (após o main content, antes do footer).

#### PR3 — Portal (aluno + responsável + lost_found_match) (✅ concluído)
- `student_study_buddy` (audience=['student'], recipient_id por aluno ativo): dicas nas matérias de pior desempenho + link YouTube do conteúdo corrente do diário. Cron 6h.
- `guardian_pulse` (audience=['guardian'], recipient_id=guardian): faltas recentes do filho, parcelas a vencer, eventos escolares. Cron 12h + trigger em `financial_installments`/`diary_attendance`.
- `lost_found_match` (audience=['student','guardian']): AFTER INSERT em `lost_found_items` varre alunos cujo perfil/turma bate com descrição; cria insight "É seu?" com action claim.

#### PR4 — Financeiro (anomalia + admin pulse) (✅ concluído)
- `financial_anomaly_scout` (audience=['admin'], cron 1h + trigger `financial_installments.status`): detecta picos de inadimplência, spikes em cancelamentos, fornecedores com preço fora da curva (tipo `supplier_price_anomaly`).
- `admin_pulse` (audience=['admin'], run_on_login + cron 1h): visão geral para admin — KPIs ocultos, mudanças bruscas vs baseline.

#### PR5 — Secretaria (✅ concluído)
- `secretary_pulse` (audience=['admin'], cron 1h): documentos expirando, matrículas incompletas, inconsistências em cadastros.
- **migration 183** `ai_scheduled_runner_crons` — 3 jobs `pg_cron` (`ai_runner_hourly`, `ai_runner_6h`, `ai_runner_12h`) disparando `ai-scheduled-runner` com `x-trigger-secret` e `{cadence}` no body. Idempotente via unschedule prévio por jobname.

#### Roster final de agentes proativos

| Agent | Audience | Módulo | Gatilho | Severidade típica |
|---|---|---|---|---|
| `academic_pulse` | coordinator, teacher | academico | cron 1h + trigger notas/faltas | medium a critical |
| `financial_anomaly_scout` | admin | financeiro | cron 1h + trigger parcelas | medium a high |
| `secretary_pulse` | admin | secretaria | cron 1h | low a medium |
| `admin_pulse` | admin | dashboard | login + cron 1h | low a medium |
| `student_study_buddy` | student (recipient_id) | portal aluno | cron 6h + trigger notas | low |
| `guardian_pulse` | guardian (recipient_id) | portal responsável | cron 12h + trigger parcela/falta | low a high |
| `lost_found_match` | student, guardian | portal | trigger INSERT `lost_found_items` | low |

**Custo projetado**: 7 agentes × cadências calibradas + debounce 1-12h + Haiku 4.5 → ~$3–8/mês extra em produção com 500 alunos ativos. Já rastreado via `ai_usage_log` + `ai_usage_snapshots`.

**Verificação** (por PR):
- PR1: login como admin → `ai-login-refresh` invocada sem bloquear UI; inserir linha em `ai_insights` via SQL → badge sobe via Realtime em <5s.
- PR2: rodar manual `SELECT cron.run_job(...)` do `ai_scheduled_runner_hourly` → insight aparece em <10s no inbox + nudge surge apenas nas rotas `/admin/academico/*`.
- PR3-5: análogo, com fan-out por recipient e trigger reais.

---

### 10.9 Fase 14 — Loja, PDV e Estoque

> ✅ **CONCLUÍDA** — Migrations 92–102, 2026-04-15/16.

#### Migrations Aplicadas

| # | Arquivo | Descrição |
|---|---|---|
| 92 | `store_categories` | Tabela de categorias hierárquicas com slug, imagem e ordenação |
| 93 | `store_products` | Produtos, variantes (cor/tamanho/SKU) e imagens; RLS público (active/out_of_stock) |
| 94 | `store_inventory` | Movimentações de estoque com snapshot `balance_after` e referência por tipo |
| 95 | `store_orders` | Pedidos (`store` e `pdv`) + itens com snapshot de nome/variante |
| 96 | `store_pickup_protocols` | Protocolo de retirada presencial com assinatura e PDF |
| 97 | `store_permissions` | 7 módulos do grupo `loja` com permissões por role |
| 98 | `store_whatsapp_bucket` | Categoria WhatsApp `pedidos` + bucket `product-images` (público, 10 MB, JPEG/PNG/WebP) |
| 99 | `store_orders_payment_link` | Colunas `payment_link`, `pix_code`, `boleto_url` em `store_orders` |
| 100 | `store_order_whatsapp_templates` | 9 templates para o pipeline de pedidos; extensão do constraint `trigger_event` |
| 101 | `webhook_store_order_support` | Coluna `store_order_id` em `gateway_webhook_log` para vincular webhook a pedido de loja |
| 102 | `checkout_sessions` | Tabela `checkout_sessions` para checkout próprio em `/pagar/:token` (24 h, RLS público por token) |

#### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `store_categories` | Categorias hierárquicas (`parent_id` auto-ref), slug único, ordenação por `position` |
| `store_products` | Catálogo com preço base, custo, status (`active`/`inactive`/`out_of_stock`/`discontinued`), flag `is_featured`/`is_digital` |
| `store_product_variants` | SKU único por combinação cor × tamanho; `stock_quantity`, `reserved_quantity`, `min_stock`, `price_override` |
| `store_product_images` | Imagens por produto/variante com flag `is_cover` e `position`; bucket `product-images` |
| `store_inventory_movements` | Histórico de movimentos com tipo (`purchase`, `sale`, `return`, `adjustment`, `reservation_released`), `balance_after` e `justification` |
| `store_orders` | Pedido com canal (`store`/`pdv`), status, totais, parcelamento, `gateway_charge_id`, `payment_link`/`pix_code`/`boleto_url` |
| `store_order_items` | Itens com snapshot de nome e descrição de variante no momento da compra |
| `store_pickup_protocols` | Protocolo de retirada: nome/documento/relação do retirador, URL do PDF gerado |
| `checkout_sessions` | Sessão de checkout com token opaco (48 hex chars), `billing_type`, `status`, `expires_at` (24 h); associa `store_order_id` ou `installment_id` |

#### Módulos do Admin

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Loja | `/admin/loja` | Container com tab rail — Dashboard, Produtos, Pedidos, PDV, Relatórios |
| Dashboard | `/admin/loja` (tab padrão) | KPIs: faturamento, pedidos por status, estoque crítico, top produtos |
| Produtos | `/admin/loja` (tab Produtos) | Catálogo com CRUD de produtos, variantes (cor/tamanho), imagens e estoque por SKU |
| Categorias | Drawer em Produtos | CRUD de categorias com seletor de categoria pai |
| Pedidos | `/admin/loja` (tab Pedidos) | Pipeline de pedidos com filtro por status e transições manuais |
| PDV | `/admin/loja/pdv` | Ponto de venda full-screen com busca de produto, seleção de aluno, modos de pagamento |
| Detalhe do Pedido | `/admin/loja/pedidos/:orderId` | Timeline de status, itens, ações (confirmar pagamento, separar, pronto, retirado), protocolo |
| Estoque | Drawer em Produtos | Ajuste manual de estoque com justificativa obrigatória |
| Relatórios | `/admin/loja` (tab Relatórios) | Vendas por período, ranking de produtos, desempenho por forma de pagamento |

#### Pipeline de Pedidos

```
pending_payment → payment_confirmed → picking → ready_for_pickup → picked_up → completed
                                                                              ↘ cancelled (de qualquer status)
```

| Status | Descrição |
|--------|-----------|
| `pending_payment` | Pedido criado, aguardando confirmação de pagamento |
| `payment_confirmed` | Pagamento confirmado via webhook; estoque decrementado |
| `picking` | Equipe da loja separando os itens |
| `ready_for_pickup` | Pedido pronto; responsável notificado |
| `picked_up` | Retirado; protocolo de retirada gerado |
| `completed` | Concluído após conferência final |
| `cancelled` | Cancelado com motivo registrado |

#### Loja Pública (Portal do Responsável)

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/loja` | `LojaPublicaPage` | Catálogo público com produtos em destaque e categorias |
| `/loja/categoria/:slug` | `CategoriaPage` | Produtos filtrados por categoria |
| `/loja/produto/:slug` | `ProdutoPage` | Detalhe do produto com galeria e seletor de grade (cor × tamanho) |
| `/loja/carrinho` | `CarrinhoPage` | Carrinho de compras; exige login para prosseguir |
| `/loja/checkout` | `CheckoutPage` | Seleção de aluno e método de pagamento; redireciona para `/pagar/:token` |
| `/loja/pedido/:orderNumber` | `ConfirmacaoPedidoPage` | Acompanhamento e timeline do pedido |

#### Checkout Próprio — `/pagar/:token`

Substitui o checkout hospedado pelo gateway por uma página branded da escola. Token opaco de 48 hex chars (24 h) — não requer autenticação.

| Método | Interface | Comportamento |
|--------|-----------|--------------|
| PIX | QR code + copia-e-cola | Countdown + auto-poll a cada 5 s até confirmação |
| Boleto | Linha digitável + link de download | Auto-poll a cada 30 s |
| Cartão de Crédito | Formulário completo com parcelamento | Processado server-side via Asaas API; suporte a parcelamento configurável |

Edge function `checkout-proxy` (pública, token como auth):

| Ação | Descrição |
|------|-----------|
| `createSession` | Cria cobrança no gateway + sessão em `checkout_sessions` |
| `getSession` | Retorna dados do pedido, QR code ou linha de boleto |
| `pollStatus` | Verifica confirmação de pagamento junto ao gateway |
| `payWithCard` | Processa cartão de crédito via Asaas e registra resultado |

#### WhatsApp Templates

9 templates automáticos na categoria `pedidos` disparados nas transições de status:

| Evento (`trigger_event`) | Gatilho |
|---|---|
| `order_pending_payment` | Criação do pedido |
| `order_payment_confirmed` | `pending_payment` → `payment_confirmed` |
| `order_picking` | `payment_confirmed` → `picking` |
| `order_ready_for_pickup` | `picking` → `ready_for_pickup` |
| `order_pickup_reminder` | Agendado (lembrete de retirada pendente) |
| `order_picked_up` | `ready_for_pickup` → `picked_up` |
| `order_completed` | `picked_up` → `completed` |
| `order_cancelled` | Qualquer status → `cancelled` |
| `order_payment_failed` | Webhook de gateway (charge failed/expired) |

Variáveis disponíveis: `numero_pedido`, `nome_responsavel`, `nome_aluno`, `itens_resumo`, `valor_total`, `forma_pagamento`, `data_pedido`, `previsao_retirada`, `link_pedido`, `instituicao`

#### Permissões

7 módulos no grupo `loja`:

| Módulo (`key`) | `super_admin`/`admin` | `coordinator` | `user` (caixa) |
|---|---|---|---|
| `store-products` | CRUD | view/create/edit | — |
| `store-inventory` | CRUD | view/create/edit | — |
| `store-orders` | CRUD | view/create/edit | view |
| `store-pdv` | CRUD | — | view/create/edit |
| `store-reports` | CRUD | view | — |
| `store-settings` | CRUD | — | — |
| `store-pdv-discount` | CRUD | — | — |

---

### 10.9B Fase 14.F — Estrutura Fiscal de Produtos (NF-e Prep)

**Status**: ✅ Concluido — Sprint 7, 2026-04-16 (migrations 109–113)
**Dependencias**: Fase 14 concluida (store_products, store_inventory, store_orders)
**Prioridade**: Media

> Todo produto cadastrado na loja passa a conter sua situacao fiscal completa, espelhando os dados exigidos em uma nota fiscal de saida. A estrutura e preparada para integracao futura com APIs de emissao de NF-e (Focus NF-e, eNotas, Nuvem Fiscal ou similar) **sem necessidade de refatoracao do modelo de dados** quando a integracao for ativada.
>
> ⚠️ Nenhuma emissao real ocorre nesta fase. A integracao com o emissor sera ativada em fase posterior quando o provider for contratado.

---

#### 14.F.1 Dados Fiscais no Cadastro de Produtos

Nova aba/secao **Fiscal** no drawer de cada produto, com campos organizados por tributo:

**Classificacao Fiscal**

| Campo | Descricao |
|-------|-----------|
| `ncm` | Nomenclatura Comum do Mercosul — 8 digitos; busca por codigo ou descricao |
| `cest` | Codigo Especificador da Substituicao Tributaria — quando aplicavel |
| `cfop_saida` | CFOP padrao para saidas — ex: 5102 (venda interna), 6102 (venda interestadual) |
| `origem` | Origem da mercadoria: 0-8 conforme tabela ICMS (nacional, importado, etc.) |
| `unidade_trib` | Unidade tributavel: UN, KG, CX, PC, etc. |
| `ean` | GTIN / codigo de barras do produto, quando disponivel |

**ICMS**

| Campo | Descricao |
|-------|-----------|
| `cst_icms` / `csosn` | CST para regime normal ou CSOSN para Simples Nacional — mutuamente exclusivos conforme regime configurado |
| `mod_bc_icms` | Modalidade de base de calculo: valor da operacao, pauta, preco tabelado, MVA |
| `aliq_icms` | Aliquota percentual padrao de saida |
| `red_bc_icms` | Percentual de reducao de base de calculo, quando aplicavel |
| `mva` | Percentual MVA para calculo de ICMS-ST, quando aplicavel |

**PIS / COFINS**

| Campo | Descricao |
|-------|-----------|
| `cst_pis` | Codigo de Situacao Tributaria do PIS |
| `cst_cofins` | Codigo de Situacao Tributaria do COFINS |
| `aliq_pis` | Aliquota percentual (ou valor por unidade) |
| `aliq_cofins` | Aliquota percentual (ou valor por unidade) |

**IPI** *(quando aplicavel)*

| Campo | Descricao |
|-------|-----------|
| `cst_ipi` | Codigo de Situacao Tributaria do IPI |
| `ex_tipi` | Codigo EX TIPI, quando aplicavel |
| `aliq_ipi` | Aliquota percentual |

**Configuracoes de Emissao**

| Campo | Descricao |
|-------|-----------|
| `gera_nfe` | Toggle — define se o produto participa do fluxo de emissao fiscal automatica futura |
| `obs_fiscal` | Observacoes complementares que devem constar na nota |
| `fiscal_profile_id` | FK para `fiscal_profiles` (nullable) — aplica perfil fiscal reutilizavel |

---

#### 14.F.2 Preenchimento a partir de XML de NF-e de Entrada

No fluxo de importacao de XML de NF-e de entrada, ao cruzar um item da nota com um produto cadastrado, o sistema oferece a opcao de **importar os dados fiscais do item para o produto**, pre-preenchendo os campos da aba Fiscal.

Fluxo:
1. XML importado → itens extraidos com campos fiscais completos
2. Cruzamento por EAN ou SKU com `store_products`
3. Modal de sugestao: dados atuais vs. dados do XML lado a lado
4. Usuario aceita (total ou parcial), ajusta ou ignora por campo
5. Confirmacao salva em `product_fiscal_data`

---

#### 14.F.3 Perfis Fiscais Reutilizaveis

Para agilizar o cadastro de multiplos produtos com a mesma situacao tributaria (ex: toda uma categoria de uniformes), o sistema permite criar **perfis fiscais** contendo o conjunto completo de campos tributarios pre-configurados.

- Gerenciamento em **Config > Fiscal > Perfis Fiscais**
- Ao selecionar um perfil no drawer do produto, todos os campos fiscais sao preenchidos automaticamente
- O usuario pode sobrescrever campos individuais apos a aplicacao do perfil
- Produto com perfil aplicado exibe badge do nome do perfil na listagem

---

#### 14.F.4 Config > Fiscal — Configuracoes da Empresa Emitente

Nova aba em `/admin/configuracoes` → **Fiscal**, com tres secoes:

**Dados do Emitente**

| Campo | Descricao |
|-------|-----------|
| Razao social e nome fantasia | |
| CNPJ | Validado (14 digitos, algoritmo oficial) |
| Inscricao estadual e municipal | |
| Endereco completo | Logradouro, numero, complemento, bairro, CEP, municipio, UF |
| Regime tributario | Simples Nacional · Lucro Presumido · Lucro Real |

**Configuracoes de Emissao**

| Campo | Descricao |
|-------|-----------|
| Ambiente padrao | Producao / Homologacao |
| Serie padrao de NF-e | Numero (default: 1) |
| Proximo numero de NF-e | Controlado pelo proprio sistema, incrementado a cada emissao |
| CFOP padrao por tipo de operacao | Venda interna · Venda interestadual · Devolucao |
| Aliquotas padrao por regime | Fallback quando o produto nao possui aliquota especifica configurada |

**Integracao com Emissor Externo** *(campos estruturais — sem funcionalidade ativa nesta fase)*

| Campo | Descricao |
|-------|-----------|
| Provider | Focus NF-e · eNotas · Nuvem Fiscal · Outro |
| Token / Chave de API | Armazenada com criptografia em repouso; nunca exposta em respostas de API |
| URL do webhook de retorno | Para receber status de autorizacao e rejeicao da SEFAZ |
| Status da integracao | Nao configurada · Em homologacao · Ativa |

---

#### 14.F.5 Validacoes Fiscais

| Validacao | Comportamento |
|-----------|---------------|
| NCM com 8 digitos validos | Verificado contra tabela NCM vigente |
| CST compativel com regime tributario | CSOSN exclusivo para Simples Nacional; CST normal para outros regimes |
| CFOP coerente com tipo de operacao | Saida interna (5xxx) vs. interestadual (6xxx) |
| Aliquotas dentro de faixas validas | Por tributo |

Produtos com dados fiscais incompletos ou invalidos recebem indicador visual na listagem, **sem bloquear o uso na loja ou no PDV** nesta fase.

---

#### 14.F.6 Relatorio de Conformidade Fiscal

Listagem de todos os produtos com indicador de completude:

| Status | Criterio |
|--------|---------|
| ✅ Completo | Todos os campos obrigatorios preenchidos e validos |
| ⚠️ Incompleto | Campos obrigatorios faltando |
| ❌ Invalido | Dados preenchidos com inconsistencias detectadas |

Filtros: por status fiscal, por categoria, por segmento (quando aplicavel).
Exportavel em CSV para auditoria e preenchimento em lote externo.

---

#### 14.F.7 Schema do Banco de Dados

```
store_products
└── product_fiscal_data          → dados fiscais por produto (1:1, FK store_product_id)
    ├── ncm, cest, cfop_saida
    ├── origem, unidade_trib, ean
    ├── cst_icms, csosn, mod_bc_icms, aliq_icms, red_bc_icms, mva
    ├── cst_pis, aliq_pis
    ├── cst_cofins, aliq_cofins
    ├── cst_ipi, ex_tipi, aliq_ipi
    ├── gera_nfe BOOLEAN
    ├── obs_fiscal TEXT
    └── fiscal_profile_id UUID FK (nullable)

fiscal_profiles                  → perfis reutilizaveis
    ├── id, name, description
    └── [mesmos campos tributarios de product_fiscal_data, exceto store_product_id e fiscal_profile_id]

company_fiscal_config            → configuracoes do emitente (1 registro por escola via school_id)
    ├── razao_social, nome_fantasia, cnpj, ie, im
    ├── endereco completo (logradouro, numero, complemento, bairro, cep, municipio, uf)
    ├── regime_tributario TEXT CHECK IN ('simples_nacional','lucro_presumido','lucro_real')
    ├── ambiente TEXT CHECK IN ('producao','homologacao')
    ├── serie_nfe INT, proximo_numero_nfe BIGINT
    ├── cfop_venda_interna, cfop_venda_interestadual, cfop_devolucao
    ├── aliq_pis_padrao, aliq_cofins_padrao (fallback)
    ├── nfe_provider TEXT CHECK IN ('focus','enotas','nuvem_fiscal','outro','')
    ├── nfe_api_token TEXT (criptografado em repouso — nunca retornado via API)
    ├── nfe_webhook_url TEXT
    └── nfe_integration_status TEXT CHECK IN ('none','homologacao','ativa')

nfe_entry_items                  → itens de NF-e de entrada (ja descrito na spec de Estoque)
    └── campos fiscais extraidos do XML: ncm, cfop, cst_icms, aliq_icms, cst_pis, aliq_pis,
        cst_cofins, aliq_cofins, cst_ipi, aliq_ipi, ean, unidade_trib, origem
```

**Migrations planejadas:**

| # | Nome | Descricao |
|---|------|-----------|
| 109 | `product_fiscal_data` | Tabela product_fiscal_data (1:1 com store_products) + RLS |
| 110 | `fiscal_profiles` | Tabela fiscal_profiles + RLS + CRUD |
| 111 | `company_fiscal_config` | Tabela company_fiscal_config + RLS + campos de integracao |
| 112 | `nfe_entry_items_fiscal` | Colunas fiscais em nfe_entry_items (se tabela ja existir) ou tabela completa |
| 113 | `fiscal_permissions` | Modulos store-fiscal e store-fiscal-config no sistema de permissoes |

---

#### 14.F.8 Permissoes

| Modulo (`key`) | `super_admin`/`admin` | `coordinator` | `user` (caixa) |
|---|---|---|---|
| `store-fiscal` | CRUD (dados fiscais por produto) | view/edit | — |
| `store-fiscal-config` | CRUD (Config > Fiscal) | — | — |

---

#### 14.F.9 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `store_products` / `LojaPage` | Aba Fiscal no drawer de produto; seletor de perfil fiscal; badge de status fiscal na listagem |
| `nfe_entries` / importacao de XML | Sugestao de dados fiscais ao cruzar item da nota com produto cadastrado |
| `Config > Fiscal` | Dados do emitente + campos de integracao com emissor externo (estruturais) |
| `store-reports` | Relatorio de conformidade fiscal com filtros e exportacao CSV |
| `store_orders` / PDV | Em fase futura: consulta dados fiscais do produto para emissao automatica de NF-e na saida |

---

### 10.9C Fase 14.S — Emissao Automatica de NFS-e

**Status**: ✅ Estrutura concluida (migrations 114 `company_nfse_config`, 115 `nfse_category_config`, 117 `nfse_emitidas`; pagina `NfseEmitidas.tsx`). ✅ **14.S.P — Integracao Nuvem Fiscal concluida**:
- **PR1 (2026-04-17) ✅**: migration 155 com RPC atomica `increment_nfse_numero()`; `nfse-emitter` adaptado com dispatcher por `cfg.provider` e cliente Nuvem Fiscal real chamando `POST /nfse/dps` (NFS-e Nacional, LC 214/2024). Payload DPS construido com `infDPS` completo (prest/toma com `endNac` por IBGE, `serv.cServ` com `cTribNac`/`cTribMun`/`CNAE`/`xDescServ`, `valores.trib.tribMun` com `pAliq`/`tpRetISSQN`). `nfse-webhook` com parser dedicado ao formato Nuvem Fiscal (`id`, `status`, `nfse.xml`, `nfse.url_pdf`, `mensagens[].descricao`).
- **PR1.5 (2026-04-17) ✅ — Certificado digital A1**: Edge Function `nfse-certificado` proxy (PUT/GET/DELETE em `/empresas/{cnpj}/certificado` da Nuvem Fiscal). Novo card "Certificado Digital A1" em `NfseSettingsPanel` (aparece quando provider=`nuvem_fiscal`): consulta status via `GET` na abertura (mostra titular, emissor, `not_valid_before`, `not_valid_after` com badge verde/âmbar/vermelho conforme dias restantes); quando ausente, exibe upload com file picker `.pfx`/`.p12` + senha (convertido client-side para base64 e enviado ao proxy, que faz `PUT` na Nuvem Fiscal); botao "Remover certificado" com confirmacao. Certificado NAO e armazenado no nosso DB — fica apenas no vault da Nuvem Fiscal.
- **PR2 (2026-04-17) ✅**: migration 156 adiciona `company_nfse_config.auto_emit_on_payment BOOLEAN` + `nfse_emitidas.motivo_cancelamento TEXT`. Toggle "Emitir NFS-e automaticamente ao baixar parcela" em `NfseSettingsPanel` (card Emissao). `FinancialInstallmentsPage.handlePay` le a flag apos update e dispara `handleEmitNfse` em best-effort (nao bloqueia a baixa). Nova Edge Function `nfse-cancel` (JWT admin+) que chama `POST /nfse/{id}/cancelamento` na Nuvem Fiscal e atualiza `status='cancelada'` + `motivo_cancelamento` + `cancelada_em` com log em `nfse_emission_log`. Drawer de `NfseEmitidas` ganha acoes condicionais no footer: "Reenviar PDF" (via `message-orchestrator` para status=autorizada com link_pdf), "Cancelar" (abre prompt de motivo, status=autorizada), "Emitir novamente" (status=rejeitada ou pendente — reinvoca `nfse-emitter` com os mesmos dados do registro).
- **PR3 (2026-04-18) ✅ — OAuth2 client_credentials + cotas + módulo granular** (migrations 202+203): refatora a autenticação do provedor fiscal. Antes cada painel (NF-e/NFC-e/NFS-e) guardava um bearer token estatico em `api_token_enc`; agora centraliza `client_id`/`client_secret` em `fiscal_provider_credentials` (singleton) e troca tokens on-demand em `https://auth.nuvemfiscal.com.br/oauth/token` (grant_type=client_credentials, TTL 30 dias), cacheando em `fiscal_provider_token_cache` via helper `_shared/nuvemFiscal.ts` (margem 5 min + retry automático em 401). Nova aba **Configurações › Fiscal › Provedor** como primeira sub-aba, com painel `FiscalProviderCredentialsPanel` (client_id, client_secret com toggle eye, ambiente sandbox/production, scopes, botão "Testar Conexão" → `fiscal-provider-test`, card "Consumo e cotas" → `fiscal-provider-quotas` com barras de progresso por quota retornada em `GET /conta/cotas`). Módulo granular `settings-fiscal-provider` (migration 203) permite gate de acesso separado dos demais fiscais. Painéis NF-e/NFC-e/NFS-e perdem o input de token — agora só mostram webhook URL; colunas `api_token_enc` marcadas como DEPRECATED. Todas as 8 edge functions Nuvem Fiscal migradas para o helper (`nfe-emitter`, `nfe-cancel`, `nfce-emitter`, `nfce-cancel`, `nfse-emitter`, `nfse-cancel`, `nfse-certificado`, `nfse-retry-job`). Audit completo dos paths usados vs docs oficiais (`dev.nuvemfiscal.com.br/docs/api`): todos batem — `POST /nfe`, `POST /nfe/{id}/cancelamento`, `POST /nfce`, `POST /nfce/{id}/cancelamento`, `POST /nfse/dps` (Nacional LC 214/2024), `POST /nfse/{id}/cancelamento`, `GET /nfse/{id}`, `PUT|GET|DELETE /empresas/{cnpj}/certificado`, `GET /conta/cotas`.
- **PR4 (2026-04-18) ✅ — Hotfixes + dashboard no topo**: (a) CORS das edge functions `fiscal-provider-test` / `fiscal-provider-quotas` estava listando apenas `content-type, authorization` em `Access-Control-Allow-Headers`; navegador bloqueava o preflight quando `supabase.functions.invoke` injetava `apikey` e `x-client-info`, e o POST nunca chegava ("Failed to send a request to the Edge Function"). Alinhado ao padrão `authorization, x-client-info, apikey, content-type` + `Access-Control-Allow-Methods`. (b) Sessões novas do Supabase usam JWT ES256 (chaves assimétricas) e o gateway do edge runtime ainda não suporta — retornava `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM` antes da função executar. Acrescentamos `[functions.fiscal-provider-test]` e `[functions.fiscal-provider-quotas]` com `verify_jwt = false` em `supabase/config.toml` (mesmo padrão já usado por `geocode-address`, `google-static-map`, `attendance-*`); a validação continua no corpo da função via `caller.auth.getUser()` + checagem de role no `profiles`. (c) Reorganização do painel: cards **"Teste de conexão"** e **"Consumo e cotas"** movidos para o topo como dashboard, antes das configurações (Provedor + Credenciais OAuth2). Cotas passam a atualizar automaticamente a cada visita à aba (auto-load no mount do componente, não mais one-shot no primeiro acesso da sessão). (d) Handler de erro do frontend agora extrai o body da Response real de `FunctionsHttpError.context` em vez de mostrar só `error.message`, o que deixa erros de gateway legíveis no banner.
- **PR5 (2026-04-18) ✅ — Dashboard no padrão KpiCard**: as cotas agora renderizam usando o componente `<KpiCard>` compartilhado (mesmo padrão do `SecretariaDashboardPage` / `FinancialDashboardPage`), em grid `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` com chip colorido do ícone + hover `-translate-y-0.5 shadow-lg`. Cada cota conhecida mapeia para um `{ label, icon, color }` próprio (`nfe-emissao`→FileText/amber, `nfce-emissao`→ShoppingCart/blue, `nfse-emissao`→ScrollText/purple, `dfe-eventos`→Activity/emerald, `cnpj-consultas`→Search/blue, `cnpj-listagem`→List/gray, `cep-consultas`→MapPin/orange, `empresa-certificados`→ShieldCheck/emerald; fallback Gauge/gray). Sub-label mostra `de <limite> · <pct>% · restante <N>` ou "ilimitado". Header com ícone Gauge + "Última consulta" + botão Atualizar fica fora do card, como header de dashboard real. Card **"Teste de conexão"** movido para DEPOIS das configurações (Provedor + Credenciais OAuth2) — fluxo natural: configurar → testar.

**Follow-ups (fora do sprint 14.S.P):** Validação HMAC de webhooks Nuvem Fiscal permanece como gap conhecido (doc oficial não especifica header/algoritmo — requer ticket com o suporte antes de v1). Rotação periódica do `client_secret` (sem refresh_token dedicado, basta salvar novo secret e invalidar cache).
**Dependencias**:
- Fase 14.F concluida (`company_fiscal_config` — dados do emitente e padrao de config fiscal estabelecidos)
- Fase 8.5 concluida (`financial_account_categories`, `financial_receivables`, `financial_installments` — fontes dos pagamentos tributaveis)
- Fase 10 concluida (`guardian_profiles` — tomador da NFS-e)
- Sprint 8 — MessageOrchestrator (recomendado para notificacoes WhatsApp automaticas; integravel posteriormente sem bloquear esta fase)
**Prioridade**: Media-Alta

> O sistema passa a suportar emissao automatica de Nota Fiscal de Servicos Eletronica (NFS-e) ao detectar o pagamento de lancamentos financeiros configurados como tributaveis. A estrutura e analogica a Fase 14.F (NF-e de produtos), mas voltada exclusivamente a servicos educacionais — mensalidades, taxas de matricula, eventos e outros servicos cobrados pela instituicao.
>
> As tabelas de NF-e (produtos) e NFS-e (servicos) sao **completamente separadas**: providers, numeracao, ambientes e fluxos de emissao podem diferir. O emitente (CNPJ, razao social, endereco, regime tributario) e o mesmo e pode ser reaproveitado da `company_fiscal_config` via leitura no backend — sem FK, pois os dados sao snapshotados no momento da emissao.
>
> ⚠️ **Integracao com o municipio**: cada prefeitura tem um sistema propio (ABRASF, NFS-e nacional, sistemas municipais exclusivos). O provider selecionado em `company_nfse_config` e responsavel por abstrair essas diferencas. O sistema de plataforma apenas monta o payload canonico e delega a emissao.

---

#### 14.S.1 Trigger de Emissao

**Eventos que disparam a emissao automatica:**

| Evento | Origem |
|--------|--------|
| Pagamento de mensalidade | Baixa em `financial_installments` com categoria `gera_nfse = true` |
| Pagamento de taxa de matricula | Baixa em `financial_receivables` com categoria `gera_nfse = true` |
| Pagamento de taxa avulsa | Baixa em `financial_receivables` com categoria `gera_nfse = true` |
| Pagamento de evento ou passeio | Baixa em `financial_receivables` vinculada a evento tributavel |
| Pagamento manual no caixa | Lancamento de recebimento em `financial_cash_movements` com referencia a receivable tributavel |

A tributabilidade e definida por **categoria financeira** (`financial_account_categories.gera_nfse = true`), com configuracao completa do servico por categoria. Isso permite controle granular: mensalidades geram NFS-e, taxas de atraso nao geram, por exemplo.

**Fluxo completo apos deteccao:**

```
pagamento confirmado
→ categoria do lancamento tem gera_nfse = true?
   → nao → nenhuma acao
   → sim → buscar dados do tomador (guardian_profiles do responsavel financeiro do aluno)
         → todos os campos fiscais do tomador presentes?
            → nao → registrar pendencia + alertar admin → aguardar correcao cadastral
            → sim → montar payload NFS-e (dados do prestador + tomador + servico)
                  → chamar Edge Function nfse-emitter
                  → provider retorna status imediato ou aguarda webhook
                  → autorizada → atualizar nfse_emitidas.status = 'autorizada'
                              → vincular ao pagamento de origem
                              → [se configurado] enviar PDF ao responsavel via WhatsApp/e-mail
                  → rejeitada → registrar codigo de erro + mensagem
                              → alertar admin
                              → [se configurado] agendar reenvio automatico
```

**Emissao manual (reemissao ou emissao sob demanda):**
- Botao **"Emitir NFS-e"** disponivel no detalhe de qualquer lancamento tributavel ainda sem nota vinculada
- Disponivel tambem para pagamentos com nota rejeitada (permite reemissao com dados corrigidos)
- Roles autorizadas: `super_admin`, `admin`, `coordinator` com permissao `nfse-emitidas > can_create`

---

#### 14.S.2 Dados do Tomador

O tomador da NFS-e e o **responsavel financeiro** vinculado ao aluno (`student_guardians.is_financial_guardian = true`). O sistema usa `guardian_profiles` como fonte de verdade.

**Campos fiscais necessarios no `guardian_profiles` (migration 116):**

| Campo | Descricao |
|-------|-----------|
| `cpf_cnpj` | CPF (pessoa fisica) ou CNPJ (pessoa juridica) — 11 ou 14 digitos |
| `tipo_pessoa` | `fisica` ou `juridica` |
| `logradouro_fiscal` | Endereco fiscal (pode diferir do endereco de contato) |
| `numero_fiscal` | |
| `complemento_fiscal` | |
| `bairro_fiscal` | |
| `cep_fiscal` | |
| `municipio_fiscal` | |
| `uf_fiscal` | |
| `email_fiscal` | E-mail para envio da nota (pode diferir do e-mail de contato) |

**Flag `fiscal_data_complete`** (gerada por trigger): `TRUE` quando todos os campos acima obrigatorios estao preenchidos. Usada para bloquear emissao automatica e para listagem de pendencias cadastrais.

**Listagem de pendencias:** nova sub-aba **"Pendencias Cadastrais"** em *Config > Fiscal > Servicos*, listando responsaveis financeiros com `fiscal_data_complete = false`, com link direto para editar o cadastro.

---

#### 14.S.3 Dados do Servico por Categoria

Cada categoria financeira com `gera_nfse = true` possui configuracao propria do servico (migration 115):

| Campo | Descricao |
|-------|-----------|
| `codigo_servico` | Codigo LC 116 ou codigo especifico do municipio |
| `item_lista_lc116` | Item do Anexo da Lei Complementar 116/2003 |
| `cnae` | Codigo CNAE da atividade economica |
| `descricao_servico_template` | Texto padrao da descricao do servico; suporta variaveis contextuais |
| `aliq_iss` | Aliquota ISS especifica desta categoria (sobrescreve a aliquota padrao global) |
| `tem_retencao` | Toggle — indica se ha retencao na fonte |
| `aliq_pis_ret` | Aliquota de PIS retido (quando `tem_retencao = true`) |
| `aliq_cofins_ret` | Aliquota de COFINS retido |
| `aliq_csll_ret` | Aliquota de CSLL retido |
| `aliq_ir_ret` | Aliquota de IR retido |
| `aliq_iss_ret` | Aliquota de ISS retido na fonte (tomador retencao) |

**Variaveis contextuais na descricao do servico:**

| Variavel | Substituicao |
|----------|-------------|
| `{{mes_referencia}}` | Mes e ano de competencia do pagamento (ex: "Abril/2026") |
| `{{nome_aluno}}` | Nome do aluno vinculado ao contrato/lancamento |
| `{{turma}}` | Serie + turma do aluno (ex: "1º Ano A") |
| `{{numero_contrato}}` | Numero do contrato financeiro de origem |

---

#### 14.S.4 Config > Fiscal > Servicos

Extensao da aba **Fiscal** em `/admin/configuracoes`, com novo sub-grupo **"Servicos (NFS-e)"** organizado em SettingsCards:

**Card 1 — Dados do Prestador de Servicos**
- Razao social e nome fantasia (leitura de `company_fiscal_config` como sugestao; editavel aqui de forma independente)
- CNPJ (validado — 14 digitos)
- Inscricao municipal (obrigatoria para emissao)
- Inscricao estadual (quando aplicavel)
- Regime tributario: Simples Nacional · Lucro Presumido · Lucro Real · MEI
- Endereco completo do estabelecimento prestador
- Optante pelo Simples Nacional: toggle que ajusta automaticamente os campos de retencao federais conforme a legislacao (optantes do Simples nao sofrem retencao de PIS/COFINS/CSLL/IR)

**Card 2 — Configuracoes de Emissao**

| Campo | Descricao |
|-------|-----------|
| Municipio de prestacao | Seletor com busca; determina o sistema de emissao a usar |
| Ambiente | Producao / Homologacao |
| Serie padrao | Numero (default: 1) |
| Proximo numero NFS-e | Controlado pelo sistema; incrementado a cada emissao autorizada |
| Emissao automatica | Toggle global: habilita/desabilita disparo automatico no pagamento |
| Comportamento em falha | `retry` (retenta apos X minutos) ou `alert_only` (apenas alerta o admin) |
| Intervalo de reenvio | Minutos entre tentativas automaticas (visivel quando `retry` ativo) |
| Limite de tentativas | Numero maximo de tentativas antes de marcar como falha definitiva |

**Card 3 — Integracao com API de Emissao**

| Campo | Descricao |
|-------|-----------|
| Provider | Focus NF-e · eNotas · Nuvem Fiscal · Prefeitura direta · Outro |
| Token / Chave de API | Armazenado com criptografia; nunca exibido apos cadastro (input type password sem retorno) |
| URL do webhook de retorno | Para receber autorizacao, rejeicao, cancelamento e substituicao |
| Certificado digital (.pfx) | Upload do arquivo; armazenado com criptografia; nome do arquivo exibido apos upload |
| Senha do certificado | Armazenada com criptografia; nunca exibida apos cadastro |
| Status da integracao | Nao configurada · Em homologacao · Ativa — badge colorido |

Botao **"Testar conexao"**: realiza chamada de validacao ao provider selecionado e exibe resultado em modal (sucesso ou mensagem de erro detalhada com codigo de retorno).

**Card 4 — ISS e Retencoes Globais (Fallback)**

| Campo | Descricao |
|-------|-----------|
| Aliquota ISS padrao do municipio | Percentual aplicado quando a categoria nao tem aliquota especifica |
| Retencao padrao de tributos federais | Toggles e percentuais para PIS, COFINS, CSLL e IR — somente quando a categoria nao tem configuracao propria |

**Card 5 — Envio ao Tomador**

| Campo | Descricao |
|-------|-----------|
| Enviar PDF por e-mail apos autorizacao | Toggle; usa `email_fiscal` do `guardian_profiles` |
| Enviar via WhatsApp | Toggle; usa template da categoria `fiscal` |
| Template WhatsApp | Seletor dos templates da categoria `fiscal` com preview |

---

#### 14.S.5 Gestao de NFS-e Emitidas

Nova aba **"NFS-e"** em `/admin/financeiro`, com sub-tabs:

**Sub-tab: Notas Emitidas**

Listagem de todas as notas com:

| Coluna | Descricao |
|--------|-----------|
| Numero / Serie | Numero da nota e serie |
| Data de emissao | Com hora |
| Tomador | Nome + CPF/CNPJ |
| Descricao | Descricao do servico (truncada) |
| Valor liquido | Valor apos deducoes |
| ISS | Retido ou a recolher (badge diferenciado) |
| Status | `autorizada` · `cancelada` · `substituida` · `rejeitada` · `pendente` — badge colorido |
| Origem | Link para o pagamento de origem (parcela ou receivable) |

**Acoes por nota:**

| Acao | Descricao |
|------|-----------|
| Visualizar PDF | Abre PDF da nota em nova aba |
| Enviar por e-mail | Reenvio ao tomador |
| Enviar por WhatsApp | Reenvio com template da categoria `fiscal` |
| Cancelar | Abre modal com campo de motivo obrigatorio; respeita prazo do municipio |
| Substituir | Emite nota substituta e vincula a cancelada via `substituida_por` |

**Filtros:** periodo de emissao · competencia · tomador · status · categoria financeira de origem

Exportacao CSV e Excel para apuracao fiscal mensal.

**Sub-tab: Apuracao ISS**

Relatorio mensal consolidando:

| Campo | Descricao |
|-------|-----------|
| Total de servicos prestados | Soma de `valor_servico` das notas autorizadas no periodo |
| Total de ISS devido | Soma de `aliq_iss * valor_servico` |
| ISS retido na fonte | Soma de `iss_retido` por tomador |
| ISS a recolher | `iss_devido - iss_retido` |
| Detalhamento | Por nota e por tomador |

Exportavel em formato adequado para PGDAS-D (Simples Nacional) ou DES municipal conforme regime configurado.

**Sub-tab: Log de Emissoes**

Acesso ao `nfse_emission_log` com filtros por periodo, status e NFS-e. Log imutavel — somente leitura.

---

#### 14.S.6 Alertas e Pendencias

| Alerta | Condicao | Canal |
|--------|----------|-------|
| Emissao rejeitada | `nfse_emitidas.status = 'rejeitada'` | Notificacao interna + badge no menu |
| Cadastro fiscal incompleto | `guardian_profiles.fiscal_data_complete = false` com lancamentos tributaveis pendentes | Listagem em Config > Fiscal > Servicos > Pendencias |
| Integracao inativa | `company_nfse_config.status_integracao != 'ativa'` com emissao automatica habilitada | Banner amarelo no topo do card de integracao |
| Certificado proximo do vencimento | Data de vencimento do .pfx dentro de N dias (configuravel, default 30) | Notificacao interna |
| Ambiente incorreto | `ambiente = 'homologacao'` com `status_integracao = 'ativa'` | Banner de aviso em destaque no card de emissao |

---

#### 14.S.7 Schema do Banco de Dados

```
financial_account_categories        (migration 67 — modificada pela 115)
└── gera_nfse BOOLEAN
    codigo_servico TEXT
    item_lista_lc116 TEXT
    cnae TEXT
    descricao_servico_template TEXT
    aliq_iss NUMERIC(5,2)
    tem_retencao BOOLEAN
    aliq_pis_ret, aliq_cofins_ret, aliq_csll_ret, aliq_ir_ret, aliq_iss_ret NUMERIC(5,4)

guardian_profiles                   (migration 75 — modificada pela 116)
└── cpf_cnpj TEXT
    tipo_pessoa TEXT CHECK IN ('fisica','juridica')
    logradouro_fiscal, numero_fiscal, complemento_fiscal, bairro_fiscal TEXT
    cep_fiscal, municipio_fiscal, uf_fiscal TEXT
    email_fiscal TEXT
    fiscal_data_complete BOOLEAN (gerado por trigger)

company_nfse_config                 (migration 114 — singleton via partial unique index)
└── razao_social, nome_fantasia, cnpj, ie, im TEXT
    inscricao_municipal TEXT NOT NULL
    logradouro, numero, complemento, bairro, cep, municipio, uf TEXT
    regime_tributario TEXT CHECK IN ('simples_nacional','lucro_presumido','lucro_real','mei')
    optante_simples BOOLEAN
    municipio_prestacao TEXT
    ambiente TEXT CHECK IN ('producao','homologacao')
    serie_nfse INT
    proximo_numero_nfse BIGINT
    emissao_automatica BOOLEAN
    comportamento_falha TEXT CHECK IN ('retry','alert_only')
    retry_interval_minutes INT
    retry_max_attempts INT
    aliq_iss_padrao NUMERIC(5,2)
    retencoes_padrao JSONB (pis/cofins/csll/ir toggles e percentuais)
    nfse_provider TEXT CHECK IN ('focus','enotas','nuvem_fiscal','prefeitura_direta','outro','')
    nfse_api_token TEXT (criptografado)
    nfse_webhook_url TEXT
    nfse_certificado_pfx TEXT (criptografado, armazenado em base64)
    nfse_certificado_senha TEXT (criptografada)
    nfse_certificado_validade DATE
    nfse_integration_status TEXT CHECK IN ('none','homologacao','ativa')
    enviar_email_tomador BOOLEAN
    enviar_whatsapp_tomador BOOLEAN
    whatsapp_template_id UUID FK (nullable)

nfse_emitidas                       (migration 117)
└── id UUID PK
    numero BIGINT NOT NULL
    serie INT NOT NULL DEFAULT 1
    data_emissao TIMESTAMPTZ
    competencia_mes INT, competencia_ano INT
    tomador JSONB NOT NULL (snapshot no momento da emissao)
    prestador JSONB NOT NULL (snapshot no momento da emissao)
    descricao_servico TEXT NOT NULL
    codigo_servico TEXT
    cnae TEXT
    item_lista_lc116 TEXT
    valor_servico NUMERIC(12,2)
    deducoes NUMERIC(12,2) DEFAULT 0
    valor_liquido NUMERIC(12,2)
    aliq_iss NUMERIC(5,2)
    iss_devido NUMERIC(12,2)
    iss_retido NUMERIC(12,2) DEFAULT 0
    iss_a_recolher NUMERIC(12,2)
    retencoes_federais JSONB (pis/cofins/csll/ir valores retidos)
    provider_nfse_id TEXT (ID retornado pelo provider)
    link_pdf TEXT
    xml_retorno TEXT
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK IN ('pendente','autorizada','cancelada','substituida','rejeitada')
    motivo_cancelamento TEXT
    substituida_por UUID REFERENCES nfse_emitidas(id)
    installment_id UUID REFERENCES financial_installments(id) ON DELETE SET NULL
    receivable_id UUID REFERENCES financial_receivables(id) ON DELETE SET NULL
    categoria_id UUID REFERENCES financial_account_categories(id) ON DELETE SET NULL
    emitida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
    created_at, updated_at TIMESTAMPTZ

nfse_emission_log                   (migration 118 — imutavel: sem UPDATE, sem DELETE)
└── id UUID PK
    nfse_id UUID REFERENCES nfse_emitidas(id) ON DELETE SET NULL
    tentativa INT NOT NULL DEFAULT 1
    iniciado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL
    iniciado_por_tipo TEXT NOT NULL CHECK IN ('user','system')
    dados_enviados JSONB
    resposta JSONB
    codigo_retorno TEXT
    mensagem_retorno TEXT
    status TEXT NOT NULL CHECK IN ('success','error','pending')
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Migrations planejadas:**

| # | Nome | Descricao |
|---|------|-----------|
| 114 | `company_nfse_config` | Tabela singleton de configuracao do emitente NFS-e + RLS |
| 115 | `nfse_category_config` | Colunas de config NFS-e em `financial_account_categories` |
| 116 | `guardian_fiscal_fields` | Campos fiscais em `guardian_profiles` + trigger `fiscal_data_complete` |
| 117 | `nfse_emitidas` | Tabela principal de NFS-e emitidas + indices + RLS |
| 118 | `nfse_emission_log` | Tabela de log imutavel de tentativas de emissao + RLS |
| 119 | `nfse_permissions` | Modulos `nfse-emitidas`, `nfse-config`, `nfse-apuracao` + role_permissions |
| 120 | `nfse_whatsapp_templates` | Categoria WhatsApp `fiscal` + templates `nfse_autorizada`, `nfse_cancelada` |

---

#### 14.S.8 Edge Functions

| Funcao | Auth | Descricao |
|--------|------|-----------|
| `nfse-emitter` | JWT (admin+) / Trigger secret | Recebe `{ payment_type, payment_id, force_manual? }`; valida tomador; monta payload canonico; chama API do provider; registra em `nfse_emitidas` e `nfse_emission_log`; dispara notificacao se autorizada |
| `nfse-webhook` | Secret URL param | Recebe callbacks do provider; normaliza resposta; atualiza `nfse_emitidas.status`; registra em `nfse_emission_log`; idempotente via `provider_nfse_id` |
| `nfse-retry-job` | pg_cron | Agendado a cada N minutos (configuravel); busca `nfse_emitidas` com `status = 'pendente'` ou `status = 'rejeitada'` dentro do limite de tentativas; reprocessa via `nfse-emitter` |

---

#### 14.S.9 Permissoes

| Modulo (`key`) | `super_admin`/`admin` | `coordinator` | `user` |
|---|---|---|---|
| `nfse-emitidas` | CRUD (listar, emitir, cancelar, substituir, enviar) | view/create | — |
| `nfse-config` | CRUD (Config > Fiscal > Servicos) | — | — |
| `nfse-apuracao` | view/export (Relatorio ISS) | view | — |

---

#### 14.S.10 Arquivos a Criar / Modificar

**Novos:**

| Arquivo | Descricao |
|---------|-----------|
| `src/admin/pages/financeiro/NfseEmitidas.tsx` | Aba NFS-e em FinancialPage: listagem com filtros, acoes (cancelar, substituir, enviar), exportacao |
| `src/admin/pages/financeiro/NfseApuracaoPage.tsx` | Sub-tab de apuracao de ISS mensal com exportacao |
| `src/admin/pages/settings/NfseSettingsPanel.tsx` | 5 SettingsCards do painel Config > Fiscal > Servicos |
| `supabase/migrations/00000000000114_company_nfse_config.sql` | — |
| `supabase/migrations/00000000000115_nfse_category_config.sql` | — |
| `supabase/migrations/00000000000116_guardian_fiscal_fields.sql` | — |
| `supabase/migrations/00000000000117_nfse_emitidas.sql` | — |
| `supabase/migrations/00000000000118_nfse_emission_log.sql` | — |
| `supabase/migrations/00000000000119_nfse_permissions.sql` | — |
| `supabase/migrations/00000000000120_nfse_whatsapp_templates.sql` | — |
| `supabase/functions/nfse-emitter/index.ts` | Edge Function de emissao |
| `supabase/functions/nfse-webhook/index.ts` | Edge Function de webhook |
| `supabase/functions/nfse-retry-job/index.ts` | Edge Function de reprocessamento |

**Modificados:**

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/pages/financeiro/FinancialPage.tsx` | Nova aba "NFS-e" (icone `FileCheck`) entre Relatorios e final do rail |
| `src/admin/pages/settings/FiscalSettingsPanel.tsx` | Nova secao "Servicos (NFS-e)" com link/render de `NfseSettingsPanel` ou sub-tabs dentro do painel |
| `src/admin/pages/settings/SettingsPage.tsx` | Sem mudanca de estrutura — `fiscal` ja e custom panel; apenas `FiscalSettingsPanel` e expandido |
| `FinancialCategoryDrawer` (ou `FinancialSettingsPanel.tsx`) | Campos de config NFS-e por categoria (toggle `gera_nfse` + campos de servico — exibidos quando toggle ativo) |
| `GuardianProfilePage` / drawer de edicao de responsavel | Secao "Dados Fiscais" com os campos de `guardian_fiscal_fields`; indicador de completude para emissao NFS-e |
| `FinancialInstallmentsPage` + `FinancialReceivablesPage` | Botao "Emitir NFS-e" no detalhe do lancamento tributavel sem nota vinculada; badge de status da nota nos lancamentos com nota |

---

#### 14.S.11 Analise de Gaps e Oportunidades

**Gaps identificados nos modulos existentes:**

| Gap | Modulo Afetado | Resolucao na Fase 14.S |
|-----|---------------|------------------------|
| `guardian_profiles` nao tem CPF/CNPJ nem endereco fiscal | Fase 10 | Migration 116: adiciona campos fiscais + trigger `fiscal_data_complete` |
| `financial_account_categories` nao tem dados de servico | Fase 8.5 | Migration 115: adiciona `gera_nfse` + configuracao de servico por categoria |
| Config Fiscal existente (`company_fiscal_config`) e para NF-e de produtos | Fase 14.F | Migration 114: tabela separada `company_nfse_config` — providers, ambientes e series podem diferir |
| Nao ha categoria WhatsApp para comunicacoes fiscais | Fases 8/9 | Migration 120: categoria `fiscal` com templates NFS-e |
| Certificado digital (.pfx) nao tem infraestrutura de upload/armazenamento seguro | — | `company_nfse_config.nfse_certificado_pfx` armazenado criptografado; upload via Edge Function |

**Oportunidades de integracao com modulos existentes:**

| Oportunidade | Valor | Complexidade |
|--------------|-------|-------------|
| Usar MessageOrchestrator (Sprint 8) para envio da NFS-e ao tomador | Evita duplicacao de mensagens; prioriza comunicacoes fiscais sobre comerciais | Baixa — plugin no orchestrator |
| Exibir NFS-e no Portal do Responsavel (`/responsavel/financeiro`) | Responsavel visualiza e baixa suas proprias notas | Media — nova secao no portal |
| Vincular NFS-e ao contrato financeiro (`financial_contracts`) | Gestao fiscal consolidada por contrato do aluno | Baixa — FK adicional em `nfse_emitidas` |
| Integrar ISS retido ao DRE (`financial_dre_view`) | ISS retido como deducao no resultado financeiro | Media — nova linha na view SQL |
| Alerta de vencimento do certificado no Dashboard admin | Previne interrupcao de emissao por certificado expirado | Baixa — usar sistema de alertas existente |

---

#### 14.S.12 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `financial_installments` | Emissao automatica ao registrar baixa em parcela com categoria `gera_nfse = true`; badge de status NFS-e na listagem de cobrancas |
| `financial_receivables` | Idem para lancamentos de A/R |
| `financial_cash_movements` | Idem para recebimentos manuais no caixa |
| `financial_account_categories` | Config de servico por categoria (migration 115); campos exibidos no drawer de edicao de categoria |
| `guardian_profiles` | Campos fiscais adicionados (migration 116); indicador de completude; listagem de pendencias em Config > Fiscal > Servicos |
| `Config > Fiscal` | Nova secao "Servicos (NFS-e)" no `FiscalSettingsPanel` existente |
| `FinancialPage` | Nova aba "NFS-e" com sub-tabs Notas Emitidas, Apuracao ISS, Log |
| `MessageOrchestrator` (Sprint 8) | Envio de NFS-e ao responsavel via WhatsApp roteado pelo orquestrador; categoria `fiscal`, prioridade 1 (financeiro) |
| `company_fiscal_config` | Dados do emitente lidos como sugestao inicial ao preencher `company_nfse_config`; sem FK — gestao independente |
| Portal do Responsavel (`/responsavel/financeiro`) | Secao "Notas Fiscais" com download do PDF das NFS-e autorizadas vinculadas aos lancamentos do responsavel |

---

### 10.9D Fase 14.E — Modulo de Fornecedores

**Status**: ✅ Concluido (Sprint 9, migrations 131–132, 2026-04-17)
**Dependencias**:
- Fase 14.F concluida (`nfe_entries` + `nfe_entry_items` — XML de NF-e de entrada ja importado; emitente armazenado como TEXT)
- Fase 8.5 concluida (`financial_payables` — A/P criado com `creditor_name` TEXT, sem FK a fornecedor)
**Prioridade**: Media

> Modulo dedicado ao cadastro e gestao de fornecedores, integrado ao fluxo de importacao de NF-e de entrada e ao modulo financeiro de contas a pagar. O cadastro pode ser feito manualmente ou criado automaticamente a partir dos dados do emitente extraidos do XML da NF-e, com verificacao de duplicidade em ambos os casos.

---

#### 14.E.1 Analise de Gaps nas Tabelas Existentes

| Gap | Tabela afetada | Resolucao na Fase 14.E |
|-----|---------------|------------------------|
| `nfe_entries.emitente_cnpj` + `emitente_nome` sao TEXT puro — sem vinculo estrutural com cadastro | migration 112 (Fase 14.F) | Migration 123: ADD COLUMN `fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL`; existentes ficam com NULL ate vinculacao retroativa |
| `financial_payables.creditor_name` e TEXT — sem FK a fornecedor | migration 70 (Fase 8.5) | Migration 123: ADD COLUMN `fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL`; coexiste com `creditor_name` (mantido para casos sem fornecedor cadastrado) |
| RPC `generate_payable_installments` nao propaga `fornecedor_id` | migration 70 (Fase 8.5) | Migration 123: reescreve a RPC para incluir `fornecedor_id` no INSERT das parcelas filhas |
| Nenhuma infraestrutura de contas bancarias de contrapartes | — | Migration 122: nova tabela `fornecedor_contas_bancarias` |
| Sem lookup de CEP automatico nos formularios admin | Concern transversal | Edge Function `cep-lookup` (ViaCEP — sem chave de API) ou hook React `useCepLookup` que chama `viacep.com.br` diretamente; reutilizavel em outros cadastros futuros |

---

#### 14.E.2 Cadastro de Fornecedores

Formulario organizado em sections/DrawerCards, analoga ao padrao do sistema:

**Identificacao**

| Campo | Descricao |
|-------|-----------|
| `tipo_pessoa` | `fisica` ou `juridica` — determina campos exibidos |
| `cnpj_cpf` | CNPJ (14 dig) ou CPF (11 dig); validacao de digito verificador; formatacao automatica; verificacao de duplicidade em tempo real |
| `razao_social` | Nome oficial para documentos fiscais |
| `nome_fantasia` | Nome comercial para exibicao interna |
| `ie` | Inscricao estadual (condicional para PJ) |
| `im` | Inscricao municipal (condicional) |
| `suframa` | Inscricao SUFRAMA para fornecedores da Zona Franca de Manaus |
| `optante_simples` | Toggle |

**Contato**

| Campo | Descricao |
|-------|-----------|
| `email` | E-mail principal |
| `email_financeiro` | E-mail para boletos e cobrancas (separado do principal) |
| `telefone` | Telefone principal |
| `telefone_secundario` | Telefone secundario |
| `contato_nome` | Nome da pessoa de referencia no fornecedor |
| `contato_telefone` | Telefone direto do contato |
| `site` | URL do site |

**Endereco**

| Campo | Descricao |
|-------|-----------|
| `cep` | Busca automatica via ViaCEP — preenche logradouro, bairro, municipio, uf |
| `logradouro` | |
| `numero` | |
| `complemento` | |
| `bairro` | |
| `municipio` | |
| `uf` | |
| `pais` | Default: Brasil; editavel para fornecedores internacionais |
| `codigo_municipio_ibge` | Preenchido automaticamente pelo CEP via ViaCEP |

**Dados Fiscais** *(utilizados em NF-e de devolucao e relatorios fiscais)*

| Campo | Descricao |
|-------|-----------|
| `regime_tributario` | `simples_nacional` · `lucro_presumido` · `lucro_real` · `mei` |
| `cnae_principal` | Codigo CNAE da atividade principal |
| `contribuinte_icms` | `contribuinte` · `nao_contribuinte` · `isento` |

**Condicoes Comerciais**

| Campo | Descricao |
|-------|-----------|
| `prazo_pagamento_dias` | Prazo padrao em dias (ex: 30, 45, 60) — pre-preenche vencimento em A/P |
| `forma_pagamento_preferencial` | `pix` · `boleto` · `transferencia` · `cartao` · `outro` |
| `limite_credito` | Valor maximo de compras em aberto simultaneas |
| `observacoes` | Notas internas sobre o fornecedor |

**Classificacao**

| Campo | Descricao |
|-------|-----------|
| `categoria` | Seletor configuravel: material_escolar · fardamento · alimentacao · servicos · tecnologia · manutencao · outro |
| `tags` | Array TEXT livre para agrupamento e busca |
| `status` | `ativo` · `inativo` · `bloqueado` |

**Contas Bancarias** (sub-secao com lista + add/remove inline)

| Campo | Descricao |
|-------|-----------|
| `banco` | Codigo e nome do banco (lista dos principais bancos brasileiros) |
| `agencia` | |
| `conta` | Com digito verificador |
| `tipo_conta` | `corrente` · `poupanca` · `pagamento` |
| `tipo_chave_pix` | `cpf_cnpj` · `email` · `telefone` · `aleatoria` |
| `chave_pix` | |
| `favorecido` | Nome do titular quando diferente do fornecedor |
| `is_default` | Toggle "conta padrao para pagamentos" — apenas uma por fornecedor |

---

#### 14.E.3 Integracao com Importacao de NF-e

O fluxo de importacao de XML (ja estruturado em `nfe_entries` com `emitente_cnpj` e `emitente_nome`) ganha a etapa de vinculacao ao cadastro de fornecedores:

```
XML lido → dados do emitente extraidos
         → busca por cnpj_cpf em fornecedores
         → encontrado
             → vincular nfe_entries.fornecedor_id
             → exibir badge "Fornecedor: {razao_social}" na tela de importacao
         → nao encontrado
             → exibir painel inline "Novo fornecedor"
             → dados pre-preenchidos: razao_social, cnpj, ie, endereco, regime_tributario
             → usuario complementa (contato, condicoes, conta bancaria — opcionais)
             → usuario confirma → fornecedor criado → nfe_entries.fornecedor_id vinculado
             → usuario ignora → nota importada com fornecedor_id = NULL
```

**Verificacao de duplicidade:**

- **Durante importacao XML**: busca por CNPJ exato antes de sugerir criacao
- **Cadastro manual**: ao digitar CNPJ/CPF, verificacao em tempo real (debounce 500ms); se encontrado, exibe card com dados do fornecedor existente e opcoes:
  - "Abrir fornecedor existente" → redireciona para edicao
  - "Continuar assim mesmo" → para filiais com CNPJ raiz igual (sistema identifica diferenca nos 4 digitos do estabelecimento e exibe aviso contextual)
  - "Cancelar"

---

#### 14.E.4 Integracao com Contas a Pagar

Ao criar ou editar uma conta a pagar, o campo `creditor_name` TEXT e complementado por um seletor de fornecedor com busca:

- Busca por razao social, nome fantasia ou CNPJ
- Ao vincular: dados bancarios cadastrados sao sugeridos automaticamente para o campo de forma de pagamento; prazo padrao do fornecedor pre-preenche o vencimento; forma de pagamento preferencial e aplicada
- `creditor_name` permanece editavel como fallback quando `fornecedor_id` e NULL (compatibilidade com lancamentos anteriores)
- CNPJ do fornecedor e incluido no lançamento para relatorios e apuracao fiscal

---

#### 14.E.5 Listagem e Detalhe do Fornecedor

**Listagem** (`/admin/fornecedores` ou aba em FinancialPage):

Tabela com colunas: Razao social / Nome fantasia · CNPJ/CPF · Categoria · Contato principal · Status · Contas a pagar em aberto (badge numerado)

Filtros: status · categoria · regime tributario · UF · periodo de cadastro · busca livre (razao social, fantasia, CNPJ, CPF)

**Detalhe** (drawer com abas internas — padrao do sistema):

| Aba | Conteudo |
|-----|----------|
| Dados | Todas as informacoes do cadastro com edicao inline |
| NF-e | Todas as `nfe_entries` vinculadas: numero (chave_acesso truncada), data_emissao, valor_total, status |
| Contas a Pagar | `financial_payables` vinculados: descricao, valor, vencimento, status |
| Financeiro | Total comprado por periodo (seletores: 30d/90d/12m/todo), ticket medio, data do ultimo lancamento |

---

#### 14.E.6 Relatorios

Nova sub-tab **"Fornecedores"** em `/admin/financeiro` (aba Relatorios):

| Relatorio | Descricao |
|-----------|-----------|
| Compras por fornecedor | Total de A/P por fornecedor no periodo; exportavel CSV/Excel |
| A/P por fornecedor | Em aberto, pagas e vencidas por fornecedor |
| Fornecedores sem movimentacao | Listagem de fornecedores sem A/P nem NF-e vinculadas nos ultimos X dias (configuravel) |
| Ranking por volume | Top fornecedores por valor total de compras |
| Extrato de NF-e por fornecedor | Todas as notas de entrada vinculadas, com valor e status |

---

#### 14.E.7 Schema do Banco de Dados

```
fornecedores                        (migration 121)
└── id UUID PK
    tipo_pessoa TEXT CHECK IN ('fisica','juridica')
    cnpj_cpf TEXT NOT NULL UNIQUE  -- 11 ou 14 digitos; indice btree para busca rapida
    razao_social TEXT NOT NULL
    nome_fantasia TEXT
    ie TEXT
    im TEXT
    suframa TEXT
    optante_simples BOOLEAN NOT NULL DEFAULT false
    email TEXT
    email_financeiro TEXT
    telefone TEXT
    telefone_secundario TEXT
    contato_nome TEXT
    contato_telefone TEXT
    site TEXT
    cep TEXT
    logradouro TEXT
    numero TEXT
    complemento TEXT
    bairro TEXT
    municipio TEXT
    uf TEXT
    pais TEXT NOT NULL DEFAULT 'Brasil'
    codigo_municipio_ibge TEXT
    regime_tributario TEXT CHECK IN ('simples_nacional','lucro_presumido','lucro_real','mei','nao_contribuinte','')
    cnae_principal TEXT
    contribuinte_icms TEXT CHECK IN ('contribuinte','nao_contribuinte','isento')
    prazo_pagamento_dias INT DEFAULT 30
    forma_pagamento_preferencial TEXT CHECK IN ('pix','boleto','transferencia','cartao','outro','')
    limite_credito NUMERIC(12,2)
    observacoes TEXT
    categoria TEXT  -- material_escolar | fardamento | alimentacao | servicos | tecnologia | manutencao | outro
    tags TEXT[]
    status TEXT NOT NULL DEFAULT 'ativo' CHECK IN ('ativo','inativo','bloqueado')
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

fornecedor_contas_bancarias         (migration 122)
└── id UUID PK
    fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE
    banco_codigo TEXT
    banco_nome TEXT
    agencia TEXT
    conta TEXT
    tipo_conta TEXT CHECK IN ('corrente','poupanca','pagamento')
    tipo_chave_pix TEXT CHECK IN ('cpf_cnpj','email','telefone','aleatoria','')
    chave_pix TEXT
    favorecido TEXT
    is_default BOOLEAN NOT NULL DEFAULT false
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

-- Alteracoes em tabelas existentes (migration 123):
financial_payables                  ADD COLUMN fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL
nfe_entries                         ADD COLUMN fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL
-- Indices adicionados:
CREATE INDEX idx_fornecedores_cnpj_cpf   ON fornecedores(cnpj_cpf);
CREATE INDEX idx_payables_fornecedor     ON financial_payables(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX idx_nfe_entries_fornecedor  ON nfe_entries(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
-- RPC generate_payable_installments reescrita para propagar fornecedor_id nas parcelas filhas
```

**Migrations planejadas:**

| # | Nome | Descricao |
|---|------|-----------|
| 121 | `fornecedores` | Tabela principal + indices + RLS + trigger updated_at |
| 122 | `fornecedor_contas_bancarias` | Contas bancarias + indice + RLS; trigger garante no maximo uma `is_default = true` por fornecedor |
| 123 | `fornecedores_fk_updates` | ADD COLUMN fornecedor_id em financial_payables e nfe_entries; indices; reescrita da RPC generate_payable_installments |
| 124 | `fornecedores_permissions` | Modulo `fornecedores` no grupo `financeiro` + role_permissions |

---

#### 14.E.8 Permissoes

| Modulo (`key`) | `super_admin`/`admin` | `coordinator` | `user` |
|---|---|---|---|
| `fornecedores` | CRUD | view | — |

Exclusao bloqueada se fornecedor tiver `financial_payables` ou `nfe_entries` vinculadas (validacao no frontend + constraint via RLS policy / check no backend antes do DELETE).

---

#### 14.E.9 Arquivos a Criar / Modificar

**Novos:**

| Arquivo | Descricao |
|---------|-----------|
| `src/admin/pages/financeiro/FornecedoresPage.tsx` | Listagem com filtros, busca, status e badge de A/P em aberto |
| `src/admin/pages/financeiro/drawers/FornecedorDrawer.tsx` | Formulario completo com DrawerCards por secao + aba de contas bancarias |
| `src/admin/hooks/useCepLookup.ts` | Hook React que chama `viacep.com.br/ws/{cep}/json/` e mapeia campos; reutilizavel em qualquer formulario de endereco |
| `supabase/migrations/00000000000121_fornecedores.sql` | — |
| `supabase/migrations/00000000000122_fornecedor_contas_bancarias.sql` | — |
| `supabase/migrations/00000000000123_fornecedores_fk_updates.sql` | — |
| `supabase/migrations/00000000000124_fornecedores_permissions.sql` | — |

**Modificados:**

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/pages/financeiro/FinancialPage.tsx` | Nova aba "Fornecedores" (icone `Building2`) na tab rail |
| `src/admin/pages/financeiro/FinancialPayablesPage.tsx` | Seletor de fornecedor com busca; preenchimento automatico de conta bancaria e prazo ao vincular; badge do fornecedor nos lancamentos vinculados |
| `src/admin/pages/financeiro/FinancialReportsPage.tsx` | Nova sub-tab "Fornecedores" com os 5 relatorios descritos |
| `NfeEntradasPage` (a ser criada na Fase 14.F frontend) | Painel inline de vinculacao/criacao de fornecedor durante importacao do XML |

---

#### 14.E.10 Analise de Oportunidades

| Oportunidade | Valor | Complexidade |
|--------------|-------|-------------|
| `useCepLookup` reutilizavel em `company_fiscal_config`, `company_nfse_config` e `guardian_profiles` | Elimina digitacao manual de endereco em 4+ formularios | Baixa |
| Vinculacao retroativa de fornecedores em `nfe_entries` existentes via job de reconciliacao | Fornecedores criados na Fase 14.E sao automaticamente vinculados a notas antigas pelo CNPJ | Baixa — SQL UPDATE one-shot |
| Sugestao de fornecedor ao criar A/P — baseada nas ultimas compras da mesma categoria | Agiliza lancamento de despesas recorrentes | Media |
| Alerta de vencimento de A/P por fornecedor no Dashboard Financeiro | Visibilidade de pagamentos pendentes por relacionamento | Baixa |
| Exportacao de cadastro de fornecedores em formato SPED (bloco 0 do SPED Fiscal) | Reaproveitamento do cadastro para obrigacoes acessorias | Alta |
| Integracao com NFS-e: ao cancelar uma NFS-e, verificar se o prestador ja esta cadastrado como fornecedor | Ciclo contabil mais completo (escola como tomadora de NFS-e de seus fornecedores de servico) | Media |

---

#### 14.E.11 Integracao com Modulos Existentes

| Modulo | Integracao |
|--------|-----------|
| `nfe_entries` / importacao XML | Vinculacao automatica ou manual de fornecedor via CNPJ durante importacao; `fornecedor_id` adicionado (migration 123) |
| `financial_payables` | `fornecedor_id` adicionado; seletor de fornecedor no drawer de A/P; preenchimento automatico de dados bancarios, prazo e forma de pagamento |
| `financial_payables` RPC | `generate_payable_installments` atualizada para propagar `fornecedor_id` nas parcelas filhas |
| `financial_reports` (FinancialReportsPage) | Nova sub-tab "Fornecedores" com 5 relatorios |
| `FinancialPage` | Nova aba "Fornecedores" na tab rail |
| Fase 14.S (NFS-e) | Cadastro de fornecedores complementa o ecossistema fiscal: escola como tomadora de servicos (NFS-e recebida) pode ser registrada como contraparte; nao e dependencia tecnica, mas e complementar conceitualmente |
| `company_fiscal_config` / `company_nfse_config` | Hook `useCepLookup` reutilizado no preenchimento de endereco dos paineis de config fiscal |

---

### 10.9E Fase 14.ES — Modulo de Estoque (Controle Operacional Completo)

> ⏳ **Pendente** — Plano detalhado de implementacao. Analisa o spec completo contra o estado atual do repo e fatia em fases incrementais.

**Contexto**

A Fase 14 entregou a base transacional de estoque (produtos, variacoes com `stock_quantity`/`reserved_quantity`/`min_stock`, `store_inventory_movements` como log de movimentos, PDV ja gravando saida na venda, NF-e de entrada com itens amarrando `store_product_id`). Falta o que caracteriza um modulo ERP de estoque: **multi-deposito, custo medio, reserva com expiracao, transferencias, inventario fisico, alertas, numeracao de documentos, protocolos assinados e painel `Config > Estoque`**. Esta fase consolida o controle operacional em um novo item de navbar `/admin/estoque` com sub-abas, integrado nativamente a Loja, PDV, NF-e, Fornecedores e Financeiro.

**Objetivos**

1. Item de navbar `Estoque` com dashboard + sub-abas: Depositos, Entradas, Saidas, Transferencias, Inventario (posicao), Inventario Fisico.
2. Multi-deposito com saldo, custo medio e reserva por `(variant_id, deposito_id)`.
3. Log imutavel de movimentos com hash de integridade, saldo antes/depois e custo unitario por operacao.
4. Protocolos imprimiveis (HTML + PDF) reutilizaveis em entradas, saidas, transferencias e inventario fisico.
5. Painel `Config > Estoque` cobrindo comportamento de saldo, custeio, depositos, inventario, alertas, operacoes, categorias, integracoes, auditoria e numeracao.

**O que ja existe (reaproveitar, nao recriar)**

| Area | Onde | Como usar |
|---|---|---|
| Sidebar / nav | `src/admin/lib/admin-navigation.ts`, `src/admin/components/Sidebar.tsx` | Adicionar item `Estoque` |
| Sub-abas com `canView` | `src/admin/pages/loja/LojaPage.tsx` (`TABS: TabDef[]`) | Replicar shape em `EstoquePage` |
| KPI do dashboard | `src/admin/components/KpiCard.tsx` | KPIs do dashboard de estoque |
| Drawer + footer padrao | `src/admin/components/Drawer.tsx` + regras do CLAUDE.md | Todos os drawers novos |
| SettingsCard (Config) | Padrao em `src/admin/pages/settings/*Panel.tsx` | Novo `EstoqueSettingsPanel` |
| Permissoes granulares | `src/admin/pages/permissions/PermissionsPage.tsx`, `src/admin/lib/umbrella-modules.ts` | Grupo `estoque-*` |
| Audit log | `src/lib/audit.ts` (`logAudit`) | Em toda operacao |
| Produtos / variacoes | migration 93: `store_products`, `store_product_variants` (ja tem `stock_quantity`, `reserved_quantity`, `min_stock`, `cost_price`) | Nao duplicar — migrar saldo para novo modelo multi-deposito |
| Log de movimentos | migration 94: `store_inventory_movements` (type: `purchase/sale/return/adjustment/reservation_released`, `quantity`, `balance_after`, `reference_type/id`, `justification`, `recorded_by`) | **Base do log imutavel** — estender com `deposito_id`, `unit_cost`, `balance_before`, `hash`, `numero` via `ALTER TABLE` |
| Ajuste manual | `src/admin/pages/loja/drawers/AjusteEstoqueDrawer.tsx` | Modelo para os novos drawers de entrada/saida; remover da Loja apos migrar |
| PDV baixando saldo | `PDVPage.tsx:287-296` insere `type:'sale'` em `store_inventory_movements` | Passar a gravar `deposito_id` a partir do caixa aberto |
| NF-e entrada → produto | migration 112: `nfe_entries` + `nfe_entry_items` com FK `store_product_id` | Gerar entrada de estoque a partir de NF-e importada (toggle em Config) |
| Ledger NF-e agregado | view `v_product_stock_nfe` (migration 210) | KPI fiscal no dashboard |
| Fornecedores | `src/admin/pages/financial/FornecedoresPage.tsx` | Amarrar a entradas por compra |
| Protocolo (modelo) | `store_pickup_protocols` (migration 96) | Metadata ok, mas **nao ha utilitario HTML→PDF** — criar generico reutilizavel |

**Gaps (implementar)**

1. **Depositos (multi-location)** — conceito inexistente hoje.
2. **Saldo por deposito** — tabela derivada do log (ou materializada por trigger).
3. **Custo medio ponderado / FIFO / fixo** — hoje so `cost_price` estatico; adicionar `unit_cost` em cada movimento + engine.
4. **Reserva com expiracao** — `reserved_quantity` existe, mas sem tabela de reservas nem job.
5. **Transferencias** — tabela + itens + fluxo `rascunho→enviada→em transito→recebida(parcial)→concluida` + protocolos.
6. **Inventario fisico** — escopo + saldo de referencia congelado + folha de contagem imprimivel + lancamento + relatorio + aplicacao de ajustes.
7. **Utilitario HTML→PDF** — generico; serve tambem para os `store_pickup_protocols` existentes.
8. **Hash de integridade** por operacao (coluna + funcao SQL).
9. **Numeracao de documentos** com prefixo/ano/sequencial (tabela `estoque_numeracao`).
10. **Alertas** de saldo minimo e transferencia em transito (jobs + dashboard).
11. **Painel `Config > Estoque`** + tabela `estoque_config` (ou linhas em `system_settings`).
12. **Categorias configuraveis** de tipo de entrada/saida/transferencia (hoje enum fixo).
13. **Aprovacao de supervisor** para saidas acima do limite e ajustes de inventario.
14. **Integracao NF-e entrada → entrada de estoque** (botao manual + toggle auto).
15. **Integracao Contas a Pagar** — entrada por compra gera `accounts_payable` amarrada.
16. **Deposito no PDV / separacao de pedidos da Loja** — ambos precisam passar a gravar `deposito_id`.

**Fases de implementacao (incrementais)**

| Fase | Escopo |
|---|---|
| **F1 — Fundacao de dados** | Tabelas: `estoque_depositos`, `estoque_saldos`, `estoque_config`, `estoque_numeracao`. Estender `store_inventory_movements` com `deposito_id`, `unit_cost`, `balance_before`, `hash`, `numero`. Migrar saldo atual de `store_product_variants.stock_quantity` para um "Deposito Principal" default. Registrar modulos de permissao `estoque-*`. |
| **F2 — Dashboard + Depositos + Inventario (posicao)** | Item de navbar, `EstoquePage` com abas, CRUD de depositos, aba Inventario (consulta + export CSV/Excel). Sem novas movimentacoes. |
| **F3 — Entradas e Saidas avulsas + protocolos** | Drawers de entrada/saida (substituindo `AjusteEstoqueDrawer`), engine de custo medio (`src/lib/estoque/costEngine.ts`), utilitario HTML→PDF (`src/lib/pdf/generateProtocol.ts`), numeracao sequencial. PDV e Loja passam a gravar `deposito_id`. |
| **F4 — Transferencias** | Tabela + fluxo de status + protocolos de envio/recebimento + reserva "em transito". |
| **F5 — Inventario fisico** | Escopo, congelamento de saldo de referencia, folha de contagem imprimivel, lancamento item-a-item, relatorio de divergencias, aplicacao de ajustes, aprovacao. |
| **F6 — Config > Estoque + Alertas + Reservas** | Painel `EstoqueSettingsPanel` completo, Edge Function `estoque-alerts` (cron), Edge Function `estoque-reservation-cleanup`, fluxo de aprovacao. |
| **F7 — Integracoes** | NF-e entrada → entrada avulsa (manual + toggle auto), Contas a Pagar, consolidacao em Fornecedores, agente IA de reposicao (`AiAgentsPanel`). |

**Arquivos a modificar**

- `src/admin/lib/admin-navigation.ts` — item "Estoque"
- `src/admin/lib/umbrella-modules.ts` — modulos `estoque-*`
- `src/admin/pages/loja/PDVPage.tsx:287` — passar `deposito_id`
- `src/admin/pages/loja/LojaPage.tsx` — remover "Ajuste de estoque" (migra para Estoque)
- `src/admin/pages/permissions/PermissionsPage.tsx` — grupo Estoque
- `src/admin/pages/settings/SettingsPage.tsx` — registrar `EstoqueSettingsPanel`

**Arquivos a criar**

- `supabase/migrations/00000000000XXX_estoque_fundacao.sql` (F1)
- `src/admin/pages/estoque/EstoquePage.tsx` + subcomponentes por aba
- `src/admin/pages/estoque/drawers/{DepositoDrawer,EntradaDrawer,SaidaDrawer,TransferenciaDrawer,InventarioFisicoDrawer}.tsx`
- `src/admin/pages/settings/EstoqueSettingsPanel.tsx`
- `src/lib/pdf/generateProtocol.ts` — utilitario HTML→PDF generico
- `src/lib/estoque/costEngine.ts` — custo medio / FIFO
- `supabase/functions/estoque-alerts/` — cron de alertas
- `supabase/functions/estoque-reservation-cleanup/` — expiracao de reservas

**Riscos e pontos de atencao**

- **Migracao de saldo**: `store_product_variants.stock_quantity` vira saldo em `estoque_saldos` no "Deposito Principal". Qualquer codigo que leia esse campo direto (produtos, loja, PDV) deve passar a ler do novo modelo. Manter view de compatibilidade por pelo menos uma fase.
- **`store_inventory_movements` ja tem dados**: estender com `ALTER TABLE ADD COLUMN` (nullable → backfill → NOT NULL), **nao recriar**.
- **Reserva na loja**: hoje `reserved_quantity` e escalar na variacao; passa a ser derivado de uma tabela de reservas com TTL — mudanca contratual que afeta a Loja.
- **Inventario fisico + toggle de bloqueio**: decidir (via config) se bloqueia ou so sinaliza movimentacoes durante contagem ativa, com teste de consistencia.
- **Permissoes**: migracao de papeis antigos nao deve regredir acessos do modulo Loja.
- **Propagacao multi-cliente**: todas as alteracoes em `base`; migrations rodam por `./scripts/push-migrations.sh`.

**Verificacao end-to-end (por fase)**

- Rodar migrations locais: `supabase db reset` + `mcp list_migrations`.
- Sanidade de saldo: `SUM(estoque_movimentos.qty) == estoque_saldos.qty` por `(variant_id, deposito_id)`.
- PDV ponta-a-ponta: abrir caixa → venda → conferir movimento no deposito correto + saldo atualizado.
- Loja ponta-a-ponta: pedido → reserva → pagamento → baixa no deposito de separacao.
- Inventario fisico simulado: escopo pequeno, lancar contagem com sobra+falta, aplicar ajustes, conferir log imutavel + PDF.
- Protocolos: gerar PDF de entrada/saida/transferencia, validar QR de verificacao e hash.

**Perguntas em aberto (decidir antes de F1)**

1. **Migracao de saldo**: criar automaticamente um deposito "Principal" na F1 e migrar todo `stock_quantity` para la? _(recomendacao: sim)_
2. **Renomeio**: `store_inventory_movements → estoque_movimentos` (com view de compat) ou manter nome antigo e so estender? _(recomendacao: manter nome para reduzir blast radius)_
3. **Custeio inicial**: so custo medio ponderado na F3 ou ja entregar seletor com FIFO/fixo? _(recomendacao: so medio; FIFO/fixo em F6 junto com o painel de Config)_
4. **Fases 5-7**: tudo no mesmo ciclo ou PRs subsequentes apos F1-F4 estabilizarem?

---

### 10.10 Melhorias Transversais

| Item | Descricao | Prioridade | Status |
|------|-----------|------------|--------|
| **Atendimento como Hub Operacional** | `AttendanceQuickActions` integrado ao `AttendanceDetailsDrawer`: WhatsApp via `message-orchestrator`, agendar retorno, 2a via de boleto, gerar declaracao, ver matricula — correlacionados por `visitor_phone` via `guardian_profiles`/`enrollments`/`financial_installments` | Alta | ✅ Concluido (2026-04-17) |
| **MessageOrchestrator — expansao** | Evoluir dedup para priorizacao entre modulos + regras por categoria; envios manuais (PDV, pedidos, alertas) ainda usam `uazapi-proxy` direto por design — revisitar se entrarem em loops de campanha | Media | ⏳ Pendente |
| **Pipeline enrollment→student→contract** | `EnrollmentContractWizard` + RPC `create_student_with_capacity` + `generate_installments_for_contract`. Fluxo guiado (admin confirma plano e ativacao) — nao silencioso por design, para respeitar descontos/bolsas e override de capacidade | Media | ✅ Concluido (2026-04-15) |
| **2FA real via WhatsApp** | Geracao/verificacao de OTP com time-window; hoje so existe scaffold de categoria | Baixa | ⏳ Pendente |
| **Relatorios agendados** | Envio periodico por e-mail (mensal/trimestral) | Baixa | ⏳ Pendente |
| **OAuth para depoimentos** | Google e Facebook providers no Supabase Auth | Baixa | ⏳ Pendente |
| **Mascaramento de dados** | CPF e telefone parcial para roles restritas | Baixa | ⏳ Pendente |
| **Biblioteca Virtual publica** | Rota `/biblioteca-virtual` no site — decidir se migra para /portal/biblioteca | Baixa | ⏳ Pendente |
| **PWA / Mobile-First** | Sprint 13 concluido. PR1 (2026-04-17): `vite-plugin-pwa@1.2.0`, `vite.config.ts` com `VitePWA({ registerType: 'autoUpdate' })`, manifest base (display=standalone/lang=pt-BR), icones SVG (`pwa-icon.svg` any + `pwa-icon-maskable.svg` maskable), workbox precache ~5 MiB com `navigateFallback: /index.html` e denylist para `/api/` e `/functions/`, `devOptions.enabled=false`. PR2 (2026-04-17): manifest dinamico — `vite.config.ts` usa `loadEnv` para preencher `name`/`short_name`/`description` por cliente a partir de `VITE_SCHOOL_*` (build-time), e `BrandingContext` injeta `<meta theme-color>` + `<link rel="manifest">` via Blob URL em runtime, lendo `system_settings` (name, short_name, slogan, primary/surface, logo_url). `<meta theme-color>` estatico adicionado em `index.html` para primeira pintura. PR3 (2026-04-17): iOS meta tags (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`, `apple-touch-icon`, `mask-icon`) em `index.html` com `-title` sincronizado em runtime pelo `BrandingContext`; hook `useInstallPrompt` captura `beforeinstallprompt` e detecta iOS/Android/desktop/standalone; componente `InstallAppCard` integrado em `portal/pages/profile/ProfilePage` (aluno) e `responsavel/pages/perfil/PerfilPage` (responsavel) — Android/desktop mostram botao "Instalar agora" com prompt nativo, iOS mostra instrucao com icone Share, standalone mostra card de confirmacao. PR4 (2026-04-17): `PortariaPage` mobile-first — busca com input `type="search"` full-width empilhando botao abaixo em `<sm`, touch targets mínimos 48px (input/botao) e 44px (botoes de confirmar), resultados de busca com `min-h 56px` e avatar 44×44, card de autorizacao de saida com avatar 48×48 empilhado sobre dados, dialogo de confirmacao com botoes "Cancelar" e "Confirmar" `flex-1` de largura igual. | Media | ✅ Concluido (Sprint 13 / 2026-04-17) |
| **PWA — Push Notifications** | Sprint 13.N concluido (2026-04-17). PR1 (13.N.1): migration 153 `push_subscriptions` (endpoint UNIQUE + user_id/user_type + revoked_at, RLS por dono + SELECT/UPDATE admin), seed `system_settings.push.vapid_public_key`, secrets VAPID no Supabase, Edge Function `push-send` (npm:web-push@3.6.7) com auto-revoke em 404/410 e refresh de `last_seen_at`. PR2 (13.N.2): SW custom via `injectManifest` (`src/sw.ts` + workbox-precaching@7.4.0), handlers `push`/`notificationclick`/`SKIP_WAITING`; hook `usePushSubscription(userType)` (subscribe com VAPID + upsert por endpoint, unsubscribe marca `revoked_at`); componente `PushNotificationsCard` com estados supported/granted/denied/loading integrado nos perfis do aluno e responsavel. PR3 (13.N.3): migration 154 `whatsapp_templates.send_push`, `message-orchestrator` aceita bloco `push: { user_ids, notification }` e dispara `push-send` paralelo ao WhatsApp; `auto-notify` resolve `user_ids` via `guardian_profiles` (digitos + endsWith); UI `TemplatesPage` ganha toggle "Enviar push junto com WhatsApp". | Media | ✅ Concluido (Sprint 13.N / 2026-04-17) |
| **WebAuthn / Biometria no Portal do Responsavel** | Registro e uso de credencial de plataforma (`TouchID`, `FaceID`, `Windows Hello`) para re-autenticacao no fluxo de autorizacao de saida excepcional; fallback para senha ja entregue em Fase 11.B. Migration 108 + Edge Function `webauthn` + hook `useWebAuthn` + componente `BiometricAuth` reutilizavel. | Alta | ✅ Concluido (Sprint 6, 2026-04-16) |
| **MessageOrchestrator — tabela base** | `whatsapp_send_log` (migration 106) + Edge Function `message-orchestrator` (dedup mode=send/check) deployada; `auto-notify` e `financial-notify` integrados; envios manuais (PDV, pedidos, alertas) continuam em `uazapi-proxy` direto por design | Alta | ✅ Concluido (Sprint 8, 2026-04-16) |

---

### 10.12 Fase 15 — Achados e Perdidos Digital

> ✅ **CONCLUÍDA** — Migrations 103–105, 2026-04-16.

**Dependencias**: Fase 6 (permissoes granulares) + Fase 9 (Portal do Aluno) + Fase 10 (Portal do Responsavel)
**Prioridade**: Media

---

#### Visao Geral

Modulo digital de achados e perdidos integrado ao sistema institucional, cobrindo o registro de objetos encontrados, a reivindicacao pelo portal do aluno e do responsavel, e a gestao completa da entrega com rastreabilidade total de cada etapa.

---

#### 15.1 Schema do Banco de Dados

**Tabela `lost_found_items`** — registro de cada objeto encontrado

```sql
CREATE TABLE lost_found_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT NOT NULL,               -- categoria do objeto
  description       TEXT NOT NULL,               -- descricao livre
  photo_url         TEXT,                        -- URL do Supabase Storage
  found_location    TEXT NOT NULL,               -- onde foi encontrado
  storage_location  TEXT NOT NULL,               -- onde esta guardado
  found_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_by     UUID REFERENCES auth.users(id),
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available','claimed','delivered','discarded')),
  claimed_by_type   TEXT CHECK (claimed_by_type IN ('student','guardian')),
  claimed_by_id     UUID,                        -- student.id ou guardian_profiles.id
  claimed_at        TIMESTAMPTZ,
  claimed_portal    TEXT CHECK (claimed_portal IN ('student','guardian')),
  delivered_at      TIMESTAMPTZ,
  delivered_by      UUID REFERENCES auth.users(id),
  delivery_student_id UUID REFERENCES students(id), -- aluno vinculado na entrega
  delivery_manual   BOOLEAN NOT NULL DEFAULT false,  -- entrega sem reivindicacao previa
  discarded_at      TIMESTAMPTZ,
  discard_reason    TEXT,                        -- doacao | descarte | devolucao
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Tabela `lost_found_events`** — timeline de eventos por objeto

```sql
CREATE TABLE lost_found_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES lost_found_items(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
              -- registered | claimed | claim_confirmed | delivered |
              -- delivered_manual | discarded | edited
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('admin','student','guardian','system')),
  actor_id    UUID,
  actor_name  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Indices e RLS**

```sql
CREATE INDEX idx_lfi_status   ON lost_found_items(status);
CREATE INDEX idx_lfi_type     ON lost_found_items(type);
CREATE INDEX idx_lfi_found_at ON lost_found_items(found_at DESC);
CREATE INDEX idx_lfe_item_id  ON lost_found_events(item_id, created_at);

ALTER TABLE lost_found_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_found_events ENABLE ROW LEVEL SECURITY;

-- Admin: acesso total
CREATE POLICY "admin_all" ON lost_found_items FOR ALL
  USING (auth.role() = 'authenticated');

-- Portais: apenas itens disponíveis (sem foto se configurado)
CREATE POLICY "portal_read_available" ON lost_found_items FOR SELECT
  USING (status = 'available');
```

---

#### 15.2 Funcionalidades — Admin

**Sidebar**: Novo item `Achados e Perdidos` no grupo **Ferramentas**, `icon: 'PackageSearch'`, `path: '/admin/achados-perdidos'`, `moduleKey: 'lost-found'`.

**Listagem** (`/admin/achados-perdidos`):
- Cards ou tabela com miniatura da foto, tipo, descricao, locais, data, status e indicador de reivindicacao
- Filtros: status · tipo · periodo · local de encontro
- Botao **+ Registrar objeto** abre drawer de registro

**Drawer de registro** — campos:
- Tipo do objeto (seletor configuravel em `system_settings` `category: 'tools'` `key: 'lost_found_types'`)
- Descricao (texto livre)
- Foto (upload para `Storage/lost-found/{id}.jpg`, obrigatorio)
- Onde foi encontrado (seletor configuravel `lost_found_found_locations`)
- Onde esta armazenado (seletor configuravel `lost_found_storage_locations`)
- Data e hora do encontro (default: agora)
- Observacoes

**Detalhe do objeto** (expandido inline ou drawer):
- Timeline de eventos (`lost_found_events`) em ordem cronologica
- Dados do reivindicante (se houver)
- Acoes contextuais por status:

| Status | Acoes disponiveis |
|--------|-------------------|
| `available` | Registrar entrega manual · Descartar |
| `claimed` | Registrar entrega (reivindicante exibido) · Descartar |
| `delivered` | Somente visualizar |
| `discarded` | Somente visualizar |

**Entrega mediante reivindicacao** — confirma com dados do reivindicante ja preenchidos; registra `delivered_at`, `delivered_by`, `delivery_manual: false`.

**Entrega manual** — abre busca de aluno (mesmo componente de busca ativa usado em matriculas e PDV); registra `delivery_manual: true`, `delivery_student_id`.

**Descarte** — exige campo `discard_reason` obrigatorio (doacao | descarte | devolucao ao achador); registra `discarded_at`.

---

#### 15.3 Funcionalidades — Portais

**Portal do Aluno e Portal do Responsavel** — nova secao **Achados e Perdidos** exibindo cards dos objetos `status = 'available'`:
- Foto (se configuracao `show_photo_on_portal` ativo), tipo, descricao, local de guarda
- Botao **"E meu"** abre modal de confirmacao com reautenticacao por senha (mesmo padrao de autorizacao de saida da Fase 11.B)
- Apos reivindicacao: item muda para `claimed`, desaparece dos cards de outros usuarios
- Acompanhamento de status (`claimed` → `delivered`) com data/hora da entrega exibida

**Reautenticacao**: chamada a `supabase.auth.signInWithPassword` com o e-mail da sessao atual antes de gravar a reivindicacao — sem exposicao do token, mesma logica de confirmacao da Fase 11.B.

---

#### 15.4 Configuracoes — Config > Ferramentas

Novo card **Achados e Perdidos** em `AcademicoSettingsPanel` ou novo `ToolsSettingsPanel` em Config:

| Chave (`system_settings`) | Tipo | Default | Descricao |
|---------------------------|------|---------|-----------|
| `lost_found_types` | JSON array | `["eletronico","vestuario","acessorio","material escolar","documento","calcado","bolsa/mochila","outro"]` | Categorias de tipo de objeto |
| `lost_found_found_locations` | JSON array | `["sala de aula","corredor","patio","quadra","banheiro","refeitorio","portaria","outro"]` | Locais de encontro configuráveis |
| `lost_found_storage_locations` | JSON array | `["secretaria","portaria","coordenacao","outro"]` | Locais de armazenamento configuráveis |
| `lost_found_discard_days` | number | `30` | Dias sem retirada para sinalizar elegivel para descarte |
| `lost_found_show_photo_on_portal` | boolean | `true` | Exibir foto nos portais (desativar por politica de privacidade) |

---

#### 15.5 Permissoes Granulares

Novo modulo na tabela `modules` e nas `role_permissions`:

```sql
INSERT INTO modules (key, label, description, group_label, depends_on)
VALUES ('lost-found', 'Achados e Perdidos', 'Modulo de objetos encontrados e gestao de entregas',
        'Ferramentas', ARRAY['students']);
```

| Acao | Descricao | Role padrao |
|------|-----------|-------------|
| `view` | Visualizar listagem e detalhes | admin, coordinator, user |
| `create` | Registrar novos objetos | admin, coordinator, user |
| `update` | Editar dados e confirmar entregas | admin, coordinator |
| `delete` | Remover registros | super_admin, admin |

---

#### 15.6 Integrações Necessárias

| Modulo | Integracao | Detalhe |
|--------|-----------|---------|
| **Supabase Storage** | Upload de foto no registro | Bucket `lost-found`, politica publica para leitura nos portais; upload via `supabase.storage.from('lost-found').upload()` na Edge Function ou diretamente do client com RLS |
| **Portal do Aluno** (Fase 9) | Nova secao no portal | Rota `/portal/achados-perdidos`; leitura de `lost_found_items` com `status = 'available'`; botao de reivindicacao com reautenticacao |
| **Portal do Responsavel** (Fase 10) | Nova secao no portal | Rota `/responsavel/achados-perdidos`; mesma logica do portal do aluno, actor_type = `'guardian'` |
| **Reautenticacao** (Fase 11.B) | Confirmar senha antes de reivindicar | Reutilizar o componente/hook de confirmacao de senha ja desenvolvido para autorizacoes de saida |
| **Busca de aluno** (Fase 9.M) | Entrega manual | Reutilizar o componente de busca ativa de aluno ja presente no PDV e em Matriculas |
| **Historico do aluno** (Fase 9) | Linha do tempo de entregas | Exibir eventos `delivered` do `lost_found_events` na aba Historico do `StudentDetailPage` quando `delivery_student_id` estiver preenchido |
| **Permissoes granulares** (Fase 6) | Controle de acesso ao modulo | ModuleGuard + PermissionGate em torno da rota `/admin/achados-perdidos`; respeitar `canView`, `canCreate`, `canUpdate`, `canDelete` |
| **Audit Logs** (Fase 6) | Rastreabilidade de acoes | `logAudit()` em registro, entrega, descarte e edicao |
| **WhatsApp** (Fase 8 + 11) | Notificacao de entrega confirmada | Envio opcional de mensagem ao responsavel quando a entrega e confirmada pelo admin — novo template `lost_found_delivery_confirmed` na categoria `Portaria/Ferramentas` |
| **Config > Ferramentas** | Configuracoes do modulo | Novo card no painel de configuracoes para listas editaveis de tipos e locais, prazo de descarte e toggle de foto |

---

#### 15.7 Oportunidades de Melhoria

| Melhoria | Valor | Complexidade |
|----------|-------|--------------|
| **QR Code no objeto fisico** | Imprimir etiqueta com QR Code vinculada ao `id` do registro; ao escanear, o admin confirma a entrega sem abrir o sistema — ideal para portaria | Media | Media |
| **Alerta de descarte por WhatsApp** | X dias antes do prazo de descarte (configuravel), enviar WhatsApp automatico ao responsavel vinculado (se entrega foi manual) ou broadcast para a turma do aluno (se objeto identificado) | Alta | Baixa |
| **Reconhecimento de categoria por IA** | Analisar a foto enviada e sugerir automaticamente o tipo do objeto (vestuario, eletronico, etc.) usando a API de visao do Supabase AI ou servico externo | Media | Alta |
| **Comunicado automatico de achados sem dono** | Apos N dias sem reivindicacao, criar um Comunicado automatico (Fase Instituicao) com a foto e descricao do objeto, publicado para todos os responsaveis — opt-in configuravel | Alta | Baixa |
| **Relatorio mensal de achados** | Resumo de objetos registrados, entregues, descartados e pendentes no periodo — exportavel em PDF (reutilizar Edge Function `generate-document`) | Media | Baixa |
| **Campo de identificacao do proprietario no objeto** | Campo opcional "possivel proprietario" no registro, sugerindo uma turma ou aluno ja na hora do cadastro (ex: objeto com nome identificado) | Alta | Baixa |
| **Mobile-first para registro na portaria** | O formulario de registro sera usado em dispositivos moveis pela portaria — seguir padrao PWA/Mobile-First da secao 10.10 desde o primeiro deploy | Alta | Baixa |
| **Historico consolidado no aluno** | Na `StudentDetailPage`, aba Historico, exibir uma linha do tempo de todas as entregas vinculadas ao aluno, facilitando consulta em casos de reincidencia | Media | Baixa |

---

#### 15.8 Plano de Migrations

| # | Descricao |
|---|-----------|
| 103 | `lost_found_items` — tabela principal com campos de status, reivindicacao e entrega |
| 104 | `lost_found_events` — tabela de timeline por objeto; FK para `lost_found_items` |
| 105 | `modules` INSERT para `lost-found`; `system_settings` INSERTs para as 5 configuracoes do modulo |

---

### 10.13 Central de Migracao de Dados — Onboarding de Novo Cliente

**Status**: ✅ **Concluido — Sprint 10 (PR1–PR5) + Sprint 10-UX (2026-04-17)**. Hub `/admin/migracao` operacional com 10 importadores ativos (Segmentos, Series, Turmas, Contatos, Fornecedores, Produtos, Colaboradores, Alunos, A-Receber, A-Pagar, Lancamentos de Caixa). Sprint 10-UX polimento visual: grupos A/B/C em `SettingsCard` bicolor, timeline horizontal com avatars redondos (ico contextual do modulo) e linha conectora, status dot (verde disponivel / verde+check concluido / cinza bloqueado / vermelho em breve), avatar final por grupo com `%` ou check verde ao completar, dependencias sequenciais — cada modulo so desbloqueia apos o anterior no mesmo grupo estar concluido; grupos B/C bloqueiam ate o grupo anterior atingir 100%. Breadcrumb com acentuacao correta (`Migração`). Modulo `appointments` descartado do escopo via migration 152 (nao vital em ERPs escolares).
**Codigo**: OP-1 (processo operacional, fora do fluxo de fases de produto)
**Acesso**: `super_admin` exclusivo
**Momento de uso**: Evento unico no onboarding inicial — nao aparece na navegacao de outros roles
**Dependencias**: Tabelas-alvo de todos os modulos existentes (todas ja criadas nas Fases 1–15)

> A Central de Migracao centraliza a transferencia de dados de sistemas anteriores para a plataforma. E um processo isolado de onboarding — nao e uma funcionalidade operacional continua. Cada modulo e importado uma unica vez, trava apos o sucesso, e so pode ser reaberto por solicitacao explicita do super_admin com confirmacao de riscos. Nao ha integracao com IA nesta versao — o modulo de agente de mapeamento sera adicionado apos a conclusao da Fase 13 (Agentes de IA).

---

#### OP-1.1 Arquitetura da Feature

A Central de Migracao e um **processo separado dos modulos operacionais**. Ela nao e acessivel pelas paginas de modulo (ex: nao ha botao "Importar" dentro de Alunos ou Financeiro). O acesso e exclusivo via rota dedicada, visivel apenas para `super_admin`.

**Principios de design:**

| Principio | Racional |
|-----------|----------|
| Super_admin only | Impacto estrutural nos dados do cliente — risco de duplicidade e irreversibilidade exigem o nivel maximo de privilegio |
| Processo sequencial por modulo | Cada modulo tem seu proprio arquivo-fonte e fluxo de mapeamento. Importar alunos e fornecedores em paralelo seria confuso e propenso a erro |
| Trava apos sucesso | Previne reimportacao acidental que geraria duplicidade. O dado importado passa a pertencer ao operacional |
| Desbloqueio controlado | Correcoes inevitaveis (arquivo errado, dados corrigidos) sao possiveis, mas exigem decisao consciente com visibilidade dos riscos |
| Engine reutilizada | O wizard ja existente (`StudentImportPage`) e refatorado em um componente generico (`ModuleImportWizard`) parametrizado por modulo — sem reescrita |
| IA deferida | O botao "Mapear com IA" e exibido como indisponivel com mensagem "Disponivel apos configurar Agentes (Fase 13)" |

---

#### OP-1.2 Rota e Navegacao

```
/admin/migracao                   Central de Migracao (dashboard de modulos)
/admin/migracao/:moduleKey        Wizard de importacao do modulo especifico
```

O item de menu **Central de Migracao** aparece no sidebar **somente para `super_admin`**, no grupo **Administracao** (junto com Permissoes, Configuracoes, Auditoria).

---

#### OP-1.3 Dashboard da Central de Migracao

A pagina principal exibe cards para cada modulo importavel, agrupados por dependencia:

```
┌─────────────────────────────────────────────────────────────────┐
│  Central de Migracao de Dados                                   │
│  Transfira os dados do sistema anterior para a plataforma.      │
│  Cada modulo e importado uma vez e travado apos o sucesso.      │
│                                                                  │
│  Progresso: 3 / 10 modulos concluidos  ████░░░░░░  30%         │
├─────────────────────────────────────────────────────────────────┤
│  GRUPO A — Sem dependencias (importe primeiro)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Turmas       │ │ Contatos     │ │ Fornecedores │            │
│  │ ✅ Concluido │ │ ✅ Concluido │ │ ○ Disponivel │            │
│  │ 12 registros │ │ 340 registros│ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐ ┌──────────────┐                             │
│  │ Produtos     │ │ Colaboradores│                             │
│  │ ○ Disponivel │ │ ○ Disponivel │                             │
│  └──────────────┘ └──────────────┘                             │
│                                                                  │
│  GRUPO B — Recomendado apos Grupo A                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Alunos       │ │ A. Receber   │ │ A. Pagar     │            │
│  │ ✅ Concluido │ │ ○ Disponivel │ │ ○ Disponivel │            │
│  │ 487 registros│ │              │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  GRUPO C — Recomendado apos Grupo B                             │
│  ┌──────────────┐ ┌──────────────┐                             │
│  │ Agendamentos │ │ Lanc. de Caixa│                            │
│  │ ○ Disponivel │ │ ⚠ Requer caixa│                           │
│  └──────────────┘ └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

**Estados possiveis de cada card:**

| Status | Visual | Acao disponivel |
|--------|--------|-----------------|
| `available` | Badge cinza "Disponivel" | Botao "Iniciar importacao" |
| `in_progress` | Spinner + "Em andamento" | Nenhuma (wizard aberto) |
| `completed` | Badge verde "Concluido" + contador de registros | Botao "Desbloquear" (com icone cadeado) |
| `unlocked` | Badge laranja "Desbloqueado" + banner de aviso | Botao "Reimportar" — com aviso visivel |
| `blocked` | Badge cinza + tooltip "Aguarda: {dependencia}" | Nenhuma |

**Dependencias hard (importacao bloqueada):**

| Modulo | Dependencia obrigatoria |
|--------|-------------------------|
| Alunos e Responsaveis | Turmas e Segmentos concluido |
| Lancamentos de Caixa | Pelo menos 1 caixa configurado em Config > Caixas |

**Dependencias soft (aviso mas nao bloqueado):**
- Contas a Receber sem Alunos importados: aviso "Os lancamentos nao terao vinculo estrutural com alunos — vinculos precisarao ser feitos manualmente depois."
- Contas a Pagar sem Fornecedores importados: aviso analogo.
- Agendamentos sem Contatos importados: aviso analogo.

---

#### OP-1.4 Fluxo do Wizard de Importacao

O wizard e identico para todos os modulos — apenas os campos e validacoes variam. E o mesmo fluxo ja implementado para Alunos, agora parametrizado:

```
Etapa 1: Upload
  → Aceita .xlsx e .csv
  → Detecta encoding automaticamente (UTF-8 e ISO-8859-1)
  → Para .xlsx com multiplas abas: exibe seletor de aba
  → Exibe: nome do arquivo, numero de linhas, numero de colunas

Etapa 2: Mapeamento
  → Auto-detecção por alias de nome + padrão de dados (dois passos)
  → Exibe score de confianca por campo: Alta (verde) / Baixa (amarelo) / Nao detectado (vermelho)
  → Seletor manual por coluna para campos nao detectados
  → Botao "Mapear com IA" — desabilitado, tooltip "Disponivel apos Fase 13"
  → Templates salvos: carregar/salvar/deletar por modulo (reusa import_templates)

Etapa 3: Configuracoes do Modulo
  → Opcoes especificas por modulo (ver OP-1.5)
  → Comportamento para duplicatas
  → Campo "ID de origem" (external_id) — coluna opcional para mapeamento de id do sistema anterior

Etapa 4: Previa e Validacao
  → Tabela linha a linha com status: valido / aviso / rejeitado
  → Toggle individual por linha (incluir/excluir)
  → Contador: X validos, Y avisos, Z rejeitados
  → Para modulos financeiros: resumo de impacto (total a receber + total a pagar)
  → Botao "Prosseguir" bloqueado se 0 linhas incluidas

Etapa 5: Confirmacao
  → Para todos os modulos: modal confirmando "X registros serao importados"
  → Para modulos financeiros (A/P, A/R, Lancamentos): modal adicional destacando:
    - Volume total em R$
    - Aviso sobre irreversibilidade sem desbloqueio
    - Checkbox "Entendo que esta operacao impactara os relatorios financeiros"
  → Campo "ID de origem" mapeado: aviso "Registros com ID de origem ja existente serao [ignorados/atualizados] conforme configurado"

Etapa 6: Importacao e Resultado
  → Processamento em batches de 50 (mantém comportamento atual)
  → Barra de progresso com contador em tempo real
  → Ao concluir: relatorio final (importados / ignorados / rejeitados)
  → Log de rejeitados disponivel para download (.csv)
  → Botao "Concluir" → marca modulo como completed + locked → retorna ao dashboard
```

---

#### OP-1.5 Configuracoes Especificas por Modulo (Etapa 3)

**Turmas e Segmentos**

| Opcao | Valores |
|-------|---------|
| Duplicata por nome + ano letivo | Ignorar / Atualizar |
| Ano letivo padrao (para registros sem ano mapeado) | Seletor do ano letivo ativo |

**Alunos e Responsaveis**

| Opcao | Valores |
|-------|---------|
| Vincular responsavel por CPF | Sim / Nao |
| Turma nao encontrada | Deixar sem turma / Bloquear linha |
| Duplicata (CPF do aluno) | Ignorar / Atualizar / Criar novo |
| Duplicata (sem CPF: nome + data nasc.) | Ignorar / Criar novo |

**Contatos e Leads**

| Opcao | Valores |
|-------|---------|
| Duplicata (por telefone ou e-mail) | Ignorar / Atualizar / Criar novo |
| Status padrao para registros sem status mapeado | lead / contato / matriculado |
| Origem padrao | Seletor livre |

**Fornecedores**

| Opcao | Valores |
|-------|---------|
| Duplicata (por CNPJ/CPF) | Ignorar / Atualizar |
| Status padrao | Ativo / Inativo |

**Colaboradores**

| Opcao | Valores |
|-------|---------|
| Duplicata (por e-mail) | Ignorar / Atualizar |
| Criar conta de acesso automaticamente | Sim (envia convite por e-mail) / Nao (perfil sem login) |
| Role padrao para contas criadas | user / coordinator |

**Contas a Receber**

| Opcao | Valores |
|-------|---------|
| Status padrao (sem status mapeado) | pendente / pago / vencido |
| Categoria financeira padrao | Seletor das categorias de receita existentes |
| Vincular devedor existente por CPF/nome | Sim (busca em students + guardian_profiles) / Nao |
| Se vinculo nao encontrado | Manter como texto / Bloquear linha |

**Contas a Pagar**

| Opcao | Valores |
|-------|---------|
| Status padrao | pendente / pago / vencido |
| Categoria financeira padrao | Seletor das categorias de despesa existentes |
| Vincular fornecedor existente por CNPJ/nome | Sim / Nao |
| Se vinculo nao encontrado | Manter como texto / Bloquear linha |

**Lancamentos de Caixa**

| Opcao | Valores |
|-------|---------|
| Caixa destino | Seletor dos caixas cadastrados (obrigatorio) |
| Forma de pagamento padrao | Seletor |
| Categoria padrao | Seletor |

**Produtos e Estoque**

| Opcao | Valores |
|-------|---------|
| Categoria nao encontrada | Criar automaticamente / Deixar sem categoria |
| Duplicata (por SKU) | Ignorar / Atualizar preco e estoque |
| Registrar estoque como | Entrada de estoque manual no historico / Apenas ajuste de saldo |

**Agendamentos**

| Opcao | Valores |
|-------|---------|
| Contato nao encontrado | Ignorar linha / Criar contato automaticamente |
| Status padrao | Seletor |

---

#### OP-1.6 Campo `external_id` — Identificador do Sistema de Origem

Cada tabela importavel recebe uma coluna `external_id TEXT` (nullable, indexada). O mapeamento desta coluna e opcional na Etapa 2.

**Utilidade:**
- Permite reimportacoes incrementais: na segunda importacao, registros com `external_id` ja existente seguem o comportamento de "duplicata" configurado (ignorar ou atualizar) — sem criar novo registro
- Permite reconciliacao pos-migracao entre o sistema novo e o anterior
- E util para correcoes: se o lote inicial tinha dados errados, o desbloqueio + reimportacao com `external_id` mapeado atualiza somente os campos, sem duplicar

O `external_id` nao e exibido nas listagens operacionais — e um campo de infraestrutura de migracao.

**Tabelas que recebem `external_id`** (via migrations auxiliares no momento da implementacao):
`students`, `guardian_profiles`, `contacts`, `leads`, `profiles`, `fornecedores`, `financial_receivables`, `financial_payables`, `cash_movements`, `store_products`, `appointments`, `school_classes`

---

#### OP-1.7 Sistema de Bloqueio e Desbloqueio

**Maquina de estados por modulo:**

```
available
    │ usuario inicia importacao
    ▼
in_progress
    │ importacao conclui com ≥1 registro importado
    ├──────────────────────────────────────────┐
    ▼                                          │ importacao falha ou cancela
completed (locked)                         available (volta)
    │
    │ super_admin solicita desbloqueio
    │ + confirma riscos
    ▼
unlocked
    │ usuario inicia reimportacao
    ▼
in_progress → completed (locked) novamente
```

**Fluxo de desbloqueio:**

1. Super_admin clica em "Desbloquear" no card do modulo
2. Modal de aviso exibe:
   - Numero de registros importados no lote original
   - Dependencias ativas: "X contas a receber estao vinculadas a alunos importados neste lote"
   - Aviso: "Reimportar NAO remove os registros existentes — adiciona novos registros. Duplicidades precisam ser tratadas manualmente ou via external_id."
   - Campo de confirmacao: digitar o nome do modulo (ex: `alunos`) para habilitar o botao
3. Ao confirmar: status vai para `unlocked`, evento registrado em `audit_logs`
4. Card exibe banner laranja persistente: "Este modulo foi desbloqueado por [usuario] em [data]. Reimportacao em andamento pode gerar duplicidades se o external_id nao estiver mapeado."

---

#### OP-1.8 Rastreabilidade dos Lotes

Todo lote de importacao gera um registro em `import_batches`:

```
import_batches
├── id, module_key, file_name, template_id
├── status: in_progress | completed | failed
├── records_total, records_imported, records_skipped, records_rejected
├── created_by (FK profiles), created_at, completed_at
└── import_batch_logs (1:N) — linha a linha dos rejeitados
    └── row_index, row_data JSONB, rejection_reasons TEXT[]
```

Os registros importados carregam `import_batch_id` (FK nullable) nas suas respectivas tabelas — permitindo identificar a origem de qualquer registro e exibir no detalhe do registro (badge "Importado via migracao em DD/MM/AAAA").

O historico de lotes e acessivel no proprio dashboard da Central de Migracao — lista expansivel abaixo de cada card com os lotes anteriores do modulo.

---

#### OP-1.9 Engine de Importacao — Refatoracao de `import.ts`

A engine existente (`src/admin/lib/import.ts`) e refatorada para um **registro de modulos** (sem reescrita da logica core):

```
src/admin/lib/
├── import.ts                    ← engine generica (parseSpreadsheet, autoDetectMapping,
│                                   downloadTemplate — SEM referencias a students)
├── importRegistry.ts            ← ModuleImportConfig registry; registra todos os modulos
└── importConfigs/
    ├── students.ts              ← STUDENT_IMPORT_FIELDS + validateStudentRow (extraido de import.ts)
    ├── contacts.ts
    ├── payables.ts
    ├── receivables.ts
    ├── cashMovements.ts
    ├── products.ts
    ├── suppliers.ts             ← fornecedores
    ├── appointments.ts
    ├── classes.ts               ← turmas e segmentos
    └── users.ts                 ← colaboradores
```

Cada `importConfig` exporta:

```ts
interface ModuleImportConfig {
  moduleKey: string;
  label: string;                           // "Alunos e Responsaveis"
  fields: ImportFieldDef[];                // campos mapeaveis
  aliasDict: Record<string, string[]>;     // aliases por campo para auto-deteccao
  requiredFields: string[];                // campos obrigatorios
  validate: (row, mapping, context) => ValidationResult;
  getContext: () => Promise<ImportContext>;  // lookup data (turmas, categorias, etc.)
  insert: (rows, batchId, options) => Promise<InsertResult>;
  duplicateKey?: (row) => string | null;   // chave de deduplicacao
  SpecificOptions?: React.FC<OptionsProps>; // componente React para Etapa 3
  financialImpact?: (rows) => { label: string; value: number }[]; // para modal de confirmacao
}
```

`StudentImportPage.tsx` e refatorado para usar `ModuleImportWizard` com `studentsConfig` — sem perda de funcionalidade.

---

#### OP-1.10 Tratamento de Encoding e Multi-planilha

**Encoding (CSV):**
Antes do parse, o sistema detecta o encoding do arquivo:
- Tenta UTF-8 primeiro
- Se houver caracteres invalidos (mojibake), reprocessa com ISO-8859-1 (latin1) — padrao de ERPs brasileiros (Totvs, Sankhya, Senior)
- Exibe na etapa 1: "Codificacao detectada: UTF-8 / ISO-8859-1"

**Multi-planilha (Excel):**
Se o workbook tem mais de uma aba, a etapa 1 exibe um seletor de aba antes de prosseguir. O default e a primeira aba que contiver dados (ignora abas vazias e abas cujo nome sugere capa — "Cover", "Indice", "README").

---

#### OP-1.11 Schema do Banco de Dados

```
import_batches                         (migration 125)
└── id UUID PK
    module_key TEXT NOT NULL
    file_name TEXT
    template_id UUID REFERENCES import_templates(id) ON DELETE SET NULL
    status TEXT CHECK IN ('in_progress','completed','failed') DEFAULT 'in_progress'
    records_total INT NOT NULL DEFAULT 0
    records_imported INT NOT NULL DEFAULT 0
    records_skipped INT NOT NULL DEFAULT 0
    records_rejected INT NOT NULL DEFAULT 0
    import_options JSONB                -- opcoes da etapa 3 (snapshot)
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
    created_at TIMESTAMPTZ DEFAULT now()
    completed_at TIMESTAMPTZ

import_batch_logs                      (migration 126)
└── id UUID PK
    batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE
    row_index INT NOT NULL
    row_data JSONB NOT NULL
    rejection_reasons TEXT[] NOT NULL DEFAULT '{}'
    created_at TIMESTAMPTZ DEFAULT now()
INDEX: idx_batch_logs_batch ON import_batch_logs(batch_id)

migration_module_status                (migration 127)
└── id UUID PK
    module_key TEXT NOT NULL UNIQUE    -- uma linha por modulo
    status TEXT NOT NULL DEFAULT 'available'
        CHECK IN ('available','in_progress','completed','unlocked')
    last_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL
    records_imported INT              -- snapshot do ultimo batch concluido
    completed_at TIMESTAMPTZ
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
    unlocked_at TIMESTAMPTZ
    unlocked_by UUID REFERENCES profiles(id) ON DELETE SET NULL
    unlock_reason TEXT                -- texto livre registrado no desbloqueio
    updated_at TIMESTAMPTZ DEFAULT now()

-- Colunas external_id adicionadas nas tabelas-alvo (migration 127, parte 2):
ALTER TABLE students                ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE guardian_profiles       ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE contacts                ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE leads                   ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE profiles                ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE fornecedores            ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE financial_receivables   ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE financial_payables      ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE cash_movements          ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE store_products          ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE appointments            ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE school_classes          ADD COLUMN IF NOT EXISTS external_id TEXT;
-- Coluna import_batch_id adicionada nas mesmas tabelas (nullable, ON DELETE SET NULL)

-- Indices de busca por external_id:
CREATE UNIQUE INDEX idx_students_ext_id     ON students(external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX idx_contacts_ext_id     ON contacts(external_id) WHERE external_id IS NOT NULL;
-- (idem para as demais tabelas)

-- Permissoes (migration 128):
INSERT INTO modules (key, label, group, icon, position)
VALUES ('import-manager', 'Central de Migracao', 'administracao', 'DatabaseZap', 5);

INSERT INTO role_permissions (role, module_key, can_view, can_create, can_edit, can_delete, can_import)
VALUES ('super_admin', 'import-manager', TRUE, TRUE, TRUE, TRUE, TRUE);
-- Todos os outros roles: sem acesso (nao inserido = sem permissao)
```

---

#### OP-1.12 Arquivos a Criar / Modificar

**Novos:**

| Arquivo | Descricao |
|---------|-----------|
| `src/admin/pages/migration/MigrationCenterPage.tsx` | Dashboard com cards por modulo, progresso geral, historico de lotes |
| `src/admin/pages/migration/ModuleImportWizard.tsx` | Wizard parametrizado (6 etapas) reutilizando a logica de `StudentImportPage` |
| `src/admin/pages/migration/UnlockConfirmModal.tsx` | Modal de desbloqueio com campo de confirmacao e lista de dependencias ativas |
| `src/admin/lib/importRegistry.ts` | Registro central de `ModuleImportConfig` por moduleKey |
| `src/admin/lib/importConfigs/students.ts` | Config extraida de `import.ts` (sem alteracao de logica) |
| `src/admin/lib/importConfigs/contacts.ts` | Campos, aliases, validacao e insert para Contatos e Leads |
| `src/admin/lib/importConfigs/payables.ts` | Contas a Pagar |
| `src/admin/lib/importConfigs/receivables.ts` | Contas a Receber |
| `src/admin/lib/importConfigs/cashMovements.ts` | Lancamentos de Caixa |
| `src/admin/lib/importConfigs/products.ts` | Produtos e Estoque |
| `src/admin/lib/importConfigs/suppliers.ts` | Fornecedores |
| `src/admin/lib/importConfigs/appointments.ts` | Agendamentos |
| `src/admin/lib/importConfigs/classes.ts` | Turmas e Segmentos |
| `src/admin/lib/importConfigs/users.ts` | Colaboradores |
| `supabase/migrations/00000000000125_import_batches.sql` | — |
| `supabase/migrations/00000000000126_import_batch_logs.sql` | — |
| `supabase/migrations/00000000000127_migration_module_status.sql` | — |
| `supabase/migrations/00000000000128_migration_permissions.sql` | — |

**Modificados:**

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/lib/import.ts` | Remove referencias a students; exporta funcoes genericas puras; mantém `FIELD_ALIASES` e `autoDetectMapping` |
| `src/admin/pages/school/StudentImportPage.tsx` | Passa a usar `ModuleImportWizard` com `studentsConfig` — funcionalidade identica, sem regressao |
| `src/router/` (arquivo de rotas) | Adiciona `/admin/migracao` e `/admin/migracao/:moduleKey` com guard `super_admin` |
| `src/admin/layout/Sidebar.tsx` | Adiciona item "Central de Migracao" no grupo Administracao, visivel apenas para `super_admin` |

---

#### OP-1.13 Modulos e Campos Importaveis — Referencia Rapida

| Modulo | `moduleKey` | Campos obrigatorios | Chave de duplicidade |
|--------|-------------|---------------------|----------------------|
| Turmas e Segmentos | `classes` | nome | nome + ano_letivo |
| Alunos e Responsaveis | `students` | nome_aluno, nome_responsavel, telefone_responsavel | CPF aluno (se presente); nome + data_nasc |
| Contatos e Leads | `contacts` | nome | telefone ou e-mail |
| Colaboradores | `users` | nome, e-mail | e-mail |
| Fornecedores | `suppliers` | razao_social, cnpj_cpf | cnpj_cpf |
| Contas a Receber | `receivables` | devedor, valor, vencimento | external_id (se mapeado) |
| Contas a Pagar | `payables` | credor, valor, vencimento | external_id (se mapeado) |
| Lancamentos de Caixa | `cash_movements` | data, tipo, valor | external_id (se mapeado) |
| Produtos e Estoque | `products` | nome, sku | sku |
| Agendamentos | `appointments` | contato_nome, data, hora | external_id (se mapeado) |

---

#### OP-1.14 Integracao Futura com Agente de IA (Fase 13)

O botao "Mapear com IA" ja existe na UI atual (`StudentImportPage`) como scaffold desabilitado. Apos a Fase 13 (Agentes de IA), dois casos de uso serao habilitados:

**Caso A — Sugestao de mapeamento** (baixo risco, sem PII):
- Envia apenas os headers da planilha + 5 linhas de amostra anonimizadas
- IA retorna sugestao de mapeamento campo a campo com justificativa
- Usuario revisa e confirma — nao substitui o fluxo manual

**Caso B — Normalizacao de arquivo irregular** (modo avancado):
- Acionado apenas para arquivos com estrutura nao-tabular (cabecalhos em multiplas linhas, blocos misturados, celulas mescladas)
- Exige consentimento explicito do usuario dado que dados reais sao enviados
- Retorna arquivo normalizado para revisao antes de prosseguir com o fluxo padrao

Ambos os casos dependem da infraestrutura de agentes da Fase 13 e NAO sao parte do escopo desta implementacao.

---

#### OP-1.15 Permissoes

| Acao | super_admin | admin | coordinator | user |
|------|:-----------:|:-----:|:-----------:|:----:|
| Acessar Central de Migracao | ✅ | ❌ | ❌ | ❌ |
| Iniciar importacao | ✅ | ❌ | ❌ | ❌ |
| Ver historico de lotes | ✅ | ❌ | ❌ | ❌ |
| Desbloquear modulo | ✅ | ❌ | ❌ | ❌ |

A rota `/admin/migracao` e seus filhos retornam 403 para qualquer role que nao seja `super_admin`. O item de menu nao e renderizado para outros roles.

---

### 10.14 Editor Visual de Templates HTML

**Codigo**: TV-1 (tooling visual, transversal)
**Status**: ✅ Concluido (2026-04-17). **PR1** — `HtmlTemplateEditor` (`src/admin/components/HtmlTemplateEditor.tsx`) baseado em TipTap 3.22.3 com toolbar completa e chips clicaveis de variaveis. **PR2** — editor ativo em `FinancialTemplatesPage` (contract_templates). **PR3** — editor ativo em `SecretariaPage` (document_templates), com chips padrao (`nome_completo`, `matricula`, `turma`, `serie`, `ano_letivo`, `data_emissao`, `escola`) mesclados aos declarados em `variablesRaw`. Schema nao muda — continua gravando HTML na mesma coluna, renderer (`dangerouslySetInnerHTML` + regex `{{var}}` no `generate-document`) segue funcionando. PR4 (variaveis padrao por tipo de template como referencia lateral) fica como backlog, pode ser absorvido na v1.1 ou quando a Fase 13 (IA) adicionar o "Mapear com IA".
**Posicionamento no roadmap**: Sprint 12 apos OP-1 concluido. NFS-e provider (14.S.P) segue pendente ate o cliente definir provider.

---

#### TV-1.1 Contexto e Motivacao

A plataforma possui dois sistemas de templates HTML independentes, ambos editados atualmente com um `<textarea>` de texto bruto:

| Sistema | Tabela | Tipos | Editor atual |
|---------|--------|-------|-------------|
| Financeiro | `contract_templates` | contract, receipt, boleto, enrollment_form, termination | textarea mono (`FinancialTemplatesPage.tsx`) |
| Secretaria | `document_templates` | declaracoes, historico escolar, transferencia | textarea mono (dentro de `SecretariaPage`) |

**Problemas do estado atual:**
1. Requer conhecimento de HTML — inacessivel para usuarios nao-tecnicos
2. Schemas incompativeis: `contract_templates.variables` e `JSONB[]` mas `document_templates.variables` e `TEXT[]`; `document_templates` nao tem `style_config`
3. Variaveis sao declaradas manualmente — nao ha extracao automatica dos `{{placeholders}}` do HTML
4. `style_config JSONB` existe em `contract_templates` (migration 55) mas nunca e lido nem salvo na UI
5. A Edge Function `generate-document` so processa `document_templates` (academicos) — contratos e recibos nao tem geracao de PDF no backend
6. Geracao de PDF depende do print do navegador — fragil, sem controle de layout, sem cabecalhos/rodapes programaticos
7. Sem templates iniciais (gallery) — usuario comeca do zero
8. Sem historico de versoes — edicoes sao destrutivas
9. Sprint 10 (NFS-e) vai precisar de um PDF de nota fiscal — nao ha suporte de tipo `nfse_recibo` nos schemas atuais

---

#### TV-1.2 Escopo da Feature

**v1 (Sprint TV-1 — sem novas dependencias npm significativas):**
- Split-pane editor: codigo HTML (esquerda) + preview em tempo real via `<iframe>` (direita, debounce 400 ms)
- Barra de variaveis: chips clicaveis que inserem `{{chave}}` na posicao do cursor no editor
- Extracao automatica de variaveis: ao salvar, o sistema faz `match(/\{\{(\w+)\}\}/g)` no HTML e sincroniza a lista de variaveis declaradas
- Painel de layout: usa os campos de `style_config` — paper_size (A4/Carta/Legal), margin_top/right/bottom/left (px), font_family, font_size, logo_url + upload para Storage
- Edicao dual: o componente `HtmlTemplateEditor` e reutilizavel em `FinancialTemplatesPage` e no editor de `document_templates`
- Tipos novos nos enums: `nfse_recibo` em `document_templates.document_type`; `nfse_recibo` e `recibo_pagamento` em `contract_templates.template_type` (migration 129)
- Template gallery: 3 starters em SQL seed (migration 130) — 1 contrato padrao, 1 recibo, 1 declaracao_matricula
- Atualizacao de `generate-document`: suportar `contract_templates` (alem de `document_templates`), ler `style_config` para CSS de impressao, mapear variaveis financeiras

**v2 (pos-v1, backlog):**
- GrapeJS ou BlockNote para drag-and-drop de blocos
- Tabela `template_versions` com historico de edicoes e rollback
- NFS-e PDF integrado via template do tipo `nfse_recibo`

---

#### TV-1.3 Analise de Gaps — Diagnostico Detalhado

##### Gap 1 — Schema incompativel entre as duas tabelas de templates

`document_templates` (migration 82) tem `variables TEXT[]` enquanto `contract_templates` (migration 55) tem `variables JSONB DEFAULT '[]'` no formato `[{"key": "...", "label": "..."}]`. O componente unificado `HtmlTemplateEditor` precisa do formato JSONB.

**Correcao (migration 129):**
```sql
-- Converte variables TEXT[] para JSONB com estrutura {key, label}
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS style_config JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS variables_jsonb JSONB NOT NULL DEFAULT '[]';

-- Migra dados existentes
UPDATE document_templates
SET variables_jsonb = (
  SELECT jsonb_agg(jsonb_build_object('key', v, 'label', v))
  FROM unnest(variables) AS v
)
WHERE array_length(variables, 1) > 0;

-- Renomeia colunas
ALTER TABLE document_templates
  DROP COLUMN variables,
  RENAME COLUMN variables_jsonb TO variables;

-- Adiciona novos tipos ao CHECK
ALTER TABLE document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check,
  ADD CONSTRAINT document_templates_document_type_check
    CHECK (document_type IN (
      'declaracao_matricula', 'declaracao_frequencia',
      'declaracao_conclusao', 'historico_escolar',
      'declaracao_transferencia', 'recibo_pagamento',
      'nfse_recibo', 'outro'
    ));
```

##### Gap 2 — `generate-document` suporta apenas `document_templates`

A Edge Function atual busca `document_templates` e so constroi variaveis de aluno/turma/escola. Contratos financeiros tem variaveis como `responsavel_nome`, `valor_mensalidade`, `vencimento`, `plano`, `parcelas`.

**Correcao na Edge Function `generate-document`:**
- Aceitar parametro `template_source: 'document_templates' | 'contract_templates'`
- Quando `contract_templates`: buscar dados de `financial_receivables` ou `enrollments` via `record_id`
- Ler `style_config` de qualquer fonte e injetar CSS de impressao:

```html
<style>
  @page { size: {{paper_size}}; margin: {{margins}}; }
  body { font-family: {{font_family}}; font-size: {{font_size}}px; }
</style>
```

##### Gap 3 — `style_config` existe mas e ignorado

O campo `style_config JSONB DEFAULT '{}'` foi criado na migration 55 com comentario "margens, fontes, logo_url, etc." mas:
- `FinancialTemplatesPage.tsx` nunca le nem salva `style_config`
- `generate-document` nao o consome
- Nenhum componente de UI expoe esses campos

**Estrutura padrao do `style_config` a implementar:**
```json
{
  "paper_size": "A4",
  "margin_top": 20,
  "margin_right": 20,
  "margin_bottom": 20,
  "margin_left": 20,
  "font_family": "Arial, sans-serif",
  "font_size": 12,
  "logo_url": null,
  "logo_width": 120,
  "show_page_numbers": true,
  "header_html": "",
  "footer_html": ""
}
```

##### Gap 4 — Sem extracao automatica de variaveis

Usuarios precisam declarar manualmente cada variavel no formulario. Se esquecerem, os `{{placeholders}}` ficam visiveis no documento gerado.

**Solucao:** ao salvar (ou com debounce de 1s), extrair todos os `{{nomes}}` do HTML com regex e comparar com a lista declarada. Mostrar warning para variaveis usadas no HTML mas nao declaradas; mostrar warning para declaradas mas nao usadas.

##### Gap 5 — Sem templates iniciais

Novos clientes precisam construir todos os templates do zero. Isso cria atrito no onboarding e frequentemente resulta em templates mal formatados.

**Solucao (migration 130):** seeds de 3 templates iniciais em SQL — contrato de matricula completo, recibo de pagamento, declaracao de matricula. Usar `ON CONFLICT DO NOTHING` para nao sobrescrever customizacoes do cliente.

##### Gap 6 — Preview fragil com `dangerouslySetInnerHTML`

O preview atual no `FinancialTemplatesPage.tsx` usa `dangerouslySetInnerHTML` dentro de um `<div>` com `prose`. Scripts embutidos sao bloqueados mas CSS inline e externo pode interferir com o design system.

**Solucao:** usar `<iframe srcDoc={renderedHtml}>` com `sandbox="allow-same-origin"` — o conteudo e isolado, sem CSS leaking, e reflete com precisao como o documento sera impresso.

---

#### TV-1.4 Arquitetura do Componente `HtmlTemplateEditor`

```
HtmlTemplateEditor
├── props:
│   ├── value: string                   -- HTML atual
│   ├── onChange: (html: string) => void
│   ├── variables: {key, label}[]       -- lista declarada
│   ├── onVariablesChange: (v[]) => void
│   ├── styleConfig: StyleConfig
│   ├── onStyleConfigChange: (s) => void
│   └── readOnly?: boolean
│
├── Layout: grid-cols-2 h-[600px] (colapsavel para uma coluna em telas < md)
│   ├── Coluna esquerda: painel de codigo
│   │   ├── Barra de variaveis: chips clicaveis (insere {{key}} no cursor)
│   │   │   └── Badge de warning para variaveis do HTML nao declaradas
│   │   ├── <textarea> mono com linha de status (linhas, chars, variaveis detectadas)
│   │   └── Aba "Layout" (alterna com "Codigo"):
│   │       ├── Select paper_size
│   │       ├── Inputs margin (top/right/bottom/left)
│   │       ├── Select font_family + input font_size
│   │       └── Upload de logo → Storage bucket 'templates-assets'
│   └── Coluna direita: painel de preview
│       ├── Header: "Preview" + toggle "Com variaveis de exemplo"
│       ├── <iframe srcDoc={rendered} sandbox="allow-same-origin" />
│       │   (variaveis substituidas por valores de exemplo ou por "{{chave}}" colorido)
│       └── Botao "Imprimir / Gerar PDF" (chama window.print() no iframe)
│
└── Auto-sync de variaveis (debounce 1000ms):
    - extractVars(html): string[] = html.match(/\{\{(\w+)\}\}/g)
    - variaveisNoHtml - variaveisDeclaradas → mostra badge "3 variaveis nao declaradas"
    - variaveisDeclaradas - variaveisNoHtml → mostra badge "2 declaradas mas nao usadas"
```

**Uso em `FinancialTemplatesPage.tsx`:**
```tsx
// Substitui o <DrawerCard title="Conteudo (HTML)"> e <DrawerCard title="Variaveis">
<HtmlTemplateEditor
  value={editing.content}
  onChange={(html) => updateField('content', html)}
  variables={editing.variables}
  onVariablesChange={(vars) => updateField('variables', vars)}
  styleConfig={editing.style_config}
  onStyleConfigChange={(sc) => updateField('style_config', sc)}
/>
```

---

#### TV-1.5 Atualizacao da Edge Function `generate-document`

Parametros aceitos apos a atualizacao:

```typescript
interface GenerateDocumentPayload {
  // Modo 1: documento academico (comportamento atual)
  request_id?: string;

  // Modo 2: renderizacao avulsa (novo — para contrato/recibo)
  template_source?: 'contract_templates' | 'document_templates';
  template_id?: string;
  record_id?: string;       // enrollment_id ou installment_id para buscar variaveis
  record_type?: 'enrollment' | 'installment' | 'student';
  extra_vars?: Record<string, string>;  // variaveis adicionais injetadas pelo caller
}
```

Variaveis financeiras mapeadas para `contract_templates`:

| Variavel | Fonte |
|----------|-------|
| `responsavel_nome` | `guardian_profiles.full_name` via `enrollments.guardian_id` |
| `responsavel_cpf` | `guardian_profiles.cpf_cnpj` |
| `aluno_nome` | `students.full_name` |
| `plano_nome` | `financial_plans.name` |
| `valor_mensalidade` | `financial_plans.monthly_amount` |
| `parcelas` | `financial_receivables COUNT` |
| `vencimento_dia` | `financial_receivables.due_day` |
| `data_contrato` | now() |
| `ano_letivo` | `enrollments.school_year` |
| `escola_nome` | `system_settings['school_name']` |
| `escola_cnpj` | `system_settings['school_cnpj']` |
| `escola_endereco` | `system_settings['school_address']` |

---

#### TV-1.6 Migrations

**Migration 129 — `document_templates_align`**

```sql
-- Alinha document_templates com contract_templates
-- 1. Adiciona style_config
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS style_config JSONB NOT NULL DEFAULT '{}';

-- 2. Converte variables TEXT[] -> JSONB [{key, label}]
ALTER TABLE document_templates
  ADD COLUMN IF NOT EXISTS variables_new JSONB NOT NULL DEFAULT '[]';

UPDATE document_templates
SET variables_new = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('key', v, 'label', v))
   FROM unnest(variables) AS v),
  '[]'::jsonb
);

ALTER TABLE document_templates DROP COLUMN variables;
ALTER TABLE document_templates RENAME COLUMN variables_new TO variables;

-- 3. Novos tipos no enum
ALTER TABLE document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;

ALTER TABLE document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN (
    'declaracao_matricula', 'declaracao_frequencia',
    'declaracao_conclusao', 'historico_escolar',
    'declaracao_transferencia', 'recibo_pagamento',
    'nfse_recibo', 'outro'
  ));
```

**Migration 130 — `template_starter_seeds`**

Seeds de templates iniciais (contrato, recibo, declaracao_matricula). Inseridos com `ON CONFLICT DO NOTHING` para nunca sobrescrever templates ja personalizados pelo cliente. O HTML de cada seed inclui cabecalho com logo placeholder, corpo com todos os `{{placeholders}}` pre-populados, rodape com dados da escola e espaco para assinatura.

---

#### TV-1.7 Arquivos a Criar / Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/migrations/00000000000129_document_templates_align.sql` | Criar | Schema alignment conforme TV-1.6 |
| `supabase/migrations/00000000000130_template_starter_seeds.sql` | Criar | Seeds de 3 templates iniciais |
| `src/admin/components/HtmlTemplateEditor.tsx` | Criar | Componente split-pane reusavel (ver TV-1.4) |
| `src/admin/pages/financial/FinancialTemplatesPage.tsx` | Modificar | Substituir drawercards de HTML + variaveis por `<HtmlTemplateEditor>` |
| `supabase/functions/generate-document/index.ts` | Modificar | Suportar contract_templates + style_config CSS + variaveis financeiras (ver TV-1.5) |
| `src/admin/types/admin.types.ts` | Modificar | Adicionar `StyleConfig` interface; atualizar `ContractTemplateType` com novos tipos; atualizar `DocumentTemplate.variables` para `TemplateVariable[]` |

---

#### TV-1.8 Dependencias e Integracao com Outros Sprints

| Sprint / Feature | Relacao | Detalhe |
|-----------------|---------|---------|
| Sprint 10 — Fase 14.S (NFS-e) | **Downstream** | NFS-e emitidas precisam de PDF; o tipo `nfse_recibo` criado nesta migration pode ser usado para o template do PDF da nota (enviado por WhatsApp ao responsavel) |
| Sprint 8 — MessageOrchestrator | **Downstream** | Apos geracao do PDF, o link pode ser enviado via MessageOrchestrator — `generate-document` retorna `pdf_url` que o chamador pode passar ao orquestrador |
| OP-1 — Central de Migracao | **Nenhuma** | Independentes; apenas compartilham o grupo `super_admin`-first |
| Sprint 11 — Fase 13 (IA) | **Upstream** | IA poderia sugerir variaveis faltantes ou melhorias de template; sem blocagem |

---

#### TV-1.9 Permissoes

Nenhuma nova tabela de `modules` ou `role_permissions` necessaria para v1:
- `financial-templates` (migration 55) ja cobre `contract_templates` para admin/super_admin
- `document_templates` ja esta coberto dentro de `secretaria` (coordinators podem visualizar, admins podem editar)

O componente `HtmlTemplateEditor` usa `PermissionGate` com os modulos existentes.

---

#### TV-1.10 Nao-Escopo (v1)

| Item | Justificativa |
|------|--------------|
| GrapeJS / drag-and-drop | Dependencia pesada (~500kb); agrega valor mas nao e prerequisito; v2 |
| Historico de versoes | Requer nova tabela e logica de diff; v2 |
| Templates compartilhados entre clientes (multi-tenant) | Arquitetura adicional; v2 |
| Editor de templates WhatsApp | WhatsApp usa texto, nao HTML — TemplatesPage.tsx tem editor proprio adequado |
| NFS-e PDF integrado | Gerado pela Edge Function `nfse-emitter` do Sprint 10; este sprint entrega apenas o tipo e o esquema |

---

### 10.16 DASH-1 — Dashboards por Permissao (registry unificado + widgets granulares)

**Status**: ✅ Concluido (2026-04-17, **reescrito 2026-04-17** como registry unificado; migration 173 libera `dashboard` para teacher)

#### Segunda iteracao (registry-driven, migration 173)

O split `DashboardPage` (super_admin) + `SharedDashboard` (demais) duplicava ~300 linhas: mesmas constantes (`REASON_LABELS`, `ENROLLMENT_PIPELINE`, `APPT_STATUS`, `LEAD_FUNNEL`), mesmos widgets com gates manuais. Apos as migrations 144-149 o super_admin passa por bypass em `has_module_permission` — o split virou puramente historico.

**Entregue nesta iteracao:**

- **`registry.tsx` unificado**: cada widget declara `id`, `anyModuleKeys`, `slot`, `order`, `requireRole?`, `load(ctx)`, `Render({data, ctx})`. `DashboardPage` vira um orquestrador: filtra widgets visíveis por `canView()` + `hasRole()`, dispara `Promise.all` apenas nos carregadores dos visiveis, renderiza por slot (kpi → chart → list → wide). Adicionar widget novo = **1 entrada no array `DASHBOARD_WIDGETS`**.
- **Widgets novos (12)** cobrindo gaps por role:
  - **Financeiro**: `finance.snapshot` (receita 30d + A/R aberto + A/P 7d), `finance.inadimplencia` (top 5 vencidas >30d), `finance.nfse` (emitidas/pendentes/canceladas no mes).
  - **Academico**: `academic.alertas` (top 5 alunos com frequencia <75% em 90d), `academic.minhas_aulas` (aulas de hoje por `class_schedules.day_of_week + teacher_id` — `requireRole: ['teacher']`), `academic.diario_pendente` (entradas `status='draft'` nos ultimos 7d — teacher), `academic.provas_corrigir` (`class_exams.status` applied/pending_correction — teacher), `academic.rematricula` (progresso da campanha ativa em `reenrollment_campaigns`/`reenrollment_applications`).
  - **Operacional**: `ops.ocorrencias` (ultimas 5 `student_occurrences`), `ops.saidas_hoje` (autorizacoes aprovadas para hoje), `ops.declaracoes` (`document_requests` em aberto).
- **Consolidacoes**: `AppointmentsKpi` absorve o contador de pendentes como badge interna (sumiu o card "Pendentes de confirmacao" separado). Removido "Contatos por motivo" (redundante com funil de leads na mesma tela).
- **Migration 173** (`teacher_dashboard_access`) libera `dashboard.can_view=true` no seed para role `teacher`. Antes, teacher batia no redirect do `<ModuleGuard moduleKey="dashboard">` mesmo tendo acesso a submodulos. Tenancy de `students`/`class_diary_entries` (migration 145) continua aplicada — teacher nao passa a ver dados cross-turma.
- **Constantes compartilhadas**: `widgets/constants.ts` centraliza `REASON_LABELS`, `ENROLLMENT_PIPELINE`, `APPT_STATUS`, `LEAD_FUNNEL`, `ROLE_LABELS`, `formatBRL` — deletando as copias duplicadas.
- **Componente auxiliar**: `widgets/ListCard.tsx` padroniza o visual de widgets top-N (empty-state embutido, header com icone + CTA opcional).

**Arquivos removidos (iteracao 2)**:

| Arquivo | Motivo |
|---------|--------|
| `src/admin/pages/dashboard/DashboardRouter.tsx` | Dispatch `if role==='super_admin'` virou obsoleto com bypass de `has_module_permission`. |
| `src/admin/pages/dashboard/SharedDashboard.tsx` | Funde no `DashboardPage` unico dirigido por registry. |

**Arquivos criados (iteracao 2)**:

| Arquivo | Conteudo |
|---------|----------|
| `src/admin/pages/dashboard/registry.tsx` | Tipos `DashboardWidget`/`LoadCtx`/`DashboardSlot` + array `DASHBOARD_WIDGETS` com 21 entradas (9 portadas + 12 novas) |
| `src/admin/pages/dashboard/widgets/constants.ts` | Constantes visuais compartilhadas |
| `src/admin/pages/dashboard/widgets/ListCard.tsx` | Container para widgets top-N |
| `supabase/migrations/00000000000173_teacher_dashboard_access.sql` | Seed `dashboard.can_view=true` para teacher |

**`routes.tsx`**: a rota index `/admin` aponta direto para `DashboardPage` (sem o Router).

**Matriz de visibilidade pos-iteracao 2**:

| Role (defaults) | KPIs | Listas | Wide |
|-----------------|------|--------|------|
| super_admin | Todos (bypass) + `AiInsightsPanel` | Todos | Todos |
| admin | Agendamentos, Matriculas, Contatos, Financeiro | Inadimplencia, NFS-e, Alertas freq., Ocorrencias, Saidas, Declaracoes, Contatos atrasados, Rematricula | Proximas visitas |
| coordinator | Agendamentos, Matriculas, Contatos | Alertas freq., Ocorrencias, Saidas, Declaracoes, Contatos atrasados, Rematricula | Proximas visitas |
| teacher (pos-173) | — (sem `appointments/students/kanban` default) | `Minhas aulas de hoje`, `Diario pendente`, `Provas a corrigir`, `Ocorrencias recentes` | `Minhas turmas` |
| user (sem overrides) | Empty-state educativo apontando para Configuracoes |

Overrides granulares ampliam essa matriz em tempo real — invalidation da migration 144 garante que liberar `financial.view=true` para um coordenador faz os widgets `finance.*` aparecerem em <1s sem refresh.

---

### 10.16 (iteracao 1 — historico)

**Status**: ✅ Concluido (2026-04-17, refatorado em 2026-04-17 para reaproveitar widgets do super_admin)
**Prioridade**: Media-Alta — quick win de UX
**Dependencias**: Permissoes granulares aditivas (migration 143) + PermissionsContext

#### Motivacao

O `DashboardPage` original foi desenhado para o `super_admin` — KPIs comparativos com tendencia, BarCharts de funil, metricas de WhatsApp, lista de proximas visitas com calendar chip, contatos pendentes. A primeira iteracao dos dashboards por role criou "blocos pobres" (cards textuais simples), o que feria a consistencia visual e dava sensacao de produto inferior aos roles nao-super_admin. A refatoracao atual elimina os blocos e reaproveita os mesmos widgets ricos do super_admin — porem renderizados condicionalmente conforme `canView('moduleKey')`.

#### Filosofia de design

> **Mesmos widgets, gatilho por permissao.** O super_admin ve o dashboard completo; cada outro role ve um subconjunto desses widgets — exatamente os correspondentes aos modulos que ele tem permissao de visualizar.

- Habilitar o modulo `dashboard` para um role/usuario significa apenas **liberar a entrada** na tela.
- O **conteudo** do dashboard (quais widgets aparecem) e governado pelas mesmas permissoes granulares dos modulos: ligar `appointments.can_view = true` libera StatCard "Agendamentos" + BarChart "Agendamentos por status" + lista "Proximas visitas"; ligar `kanban` libera StatCard "Contatos" + BarChart "Funil de leads" + BarChart "Contatos por motivo" + WaStatsWidget + OverdueContactsWidget; etc.
- Zero schema novo: a feature reaproveita 100% o `PermissionsContext` existente.
- `super_admin` continua aterrissando no `DashboardPage` classico (agora tambem refatorado para consumir o mesmo barrel `widgets/`, sem mudanca de comportamento).

#### Arquitetura

```
/admin (index)
  └── ModuleGuard moduleKey="dashboard"
       └── DashboardRouter
            ├── if profile.role === 'super_admin' → DashboardPage    (consumindo widgets/)
            └── else                              → SharedDashboard  (consumindo widgets/ + canView gating)

src/admin/pages/dashboard/
  ├── DashboardRouter.tsx       — if/else por role
  ├── DashboardPage.tsx         — super_admin (refatorado: importa de ./widgets)
  ├── SharedDashboard.tsx       — demais roles (cada widget gated por canView)
  └── widgets/
       ├── DashboardHeader.tsx       — saudacao por horario + seletor de periodo + helpers (Period, periodDays, periodStart, pctChange)
       ├── StatCard.tsx              — card numerico com tendencia % vs periodo anterior
       ├── BarChart.tsx              — barras horizontais simples sem dependencia externa
       ├── WaStatsWidget.tsx         — painel 2x2 (sent/delivered/read/failed)
       ├── OverdueContactsWidget.tsx — lista de contatos sem resposta ha >48h
       ├── UpcomingVisitsWidget.tsx  — proximas visitas com calendar chip
       └── index.ts                  — barrel re-exportando todos
```

#### Mapa de gating (moduleKey ↔ widget)

| `moduleKey` | Widgets liberados |
|-------------|-------------------|
| `appointments` | StatCard "Agendamentos", StatCard "Pendentes de confirmacao", BarChart "Agendamentos por status", UpcomingVisitsWidget |
| `students` | StatCard "Pre-Matriculas", BarChart "Pre-Matriculas por status" |
| `kanban` | StatCard "Contatos", BarChart "Funil de leads", BarChart "Contatos por motivo", OverdueContactsWidget, WaStatsWidget |
| `teacher-area` | Secao "Minhas turmas" (filtrada por `teacher_ids contains profile.id` para professor; mostra todas para coord/admin) |

Cada `Promise` no `Promise.all` do `fetchData` so dispara se a permissao correspondente estiver liberada — o usuario sem `appointments` nao gera nenhuma query em `visit_appointments`.

#### Empty-state

Se o usuario tem `dashboard.can_view = true` mas nenhum dos quatro `moduleKey` esta liberado, o `SharedDashboard` renderiza um card educativo apontando para `/admin/configuracoes`.

#### Arquivos novos (refatoracao 2026-04-17)

| Arquivo | Conteudo |
|---------|----------|
| `src/admin/pages/dashboard/widgets/DashboardHeader.tsx` | Header compartilhado (greeting + period toggle + helpers) |
| `src/admin/pages/dashboard/widgets/StatCard.tsx` | Stat card com tendencia opcional |
| `src/admin/pages/dashboard/widgets/BarChart.tsx` | BarChart horizontal sem dependencia externa |
| `src/admin/pages/dashboard/widgets/WaStatsWidget.tsx` | 2x2 WhatsApp stats |
| `src/admin/pages/dashboard/widgets/OverdueContactsWidget.tsx` | Lista de contatos sem resposta |
| `src/admin/pages/dashboard/widgets/UpcomingVisitsWidget.tsx` | Lista de proximas visitas |
| `src/admin/pages/dashboard/widgets/index.ts` | Barrel |

#### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/admin/pages/dashboard/DashboardPage.tsx` | Substitui componentes inline (StatCard, BarChart, WaStatsWidget, OverdueContactsWidget) por imports de `./widgets`; comportamento identico |
| `src/admin/pages/dashboard/SharedDashboard.tsx` | Reescrito do zero: layout rico identico ao do super_admin, com cada widget gated por `canView()` e centralizacao de fetch via `Promise.all` condicional |

#### Arquivos removidos

| Diretorio | Motivo |
|-----------|--------|
| `src/admin/pages/dashboard/blocks/` (BlockCard + 9 blocos + index) | Substituido pelos widgets ricos reaproveitados do super_admin |

#### Sem migrations / sem edge functions

Toda a logica de filtragem ja existia em `PermissionsContext.canView()`. Performance desprezivel — cada query Supabase ja era utilizada pelo `DashboardPage` classico.

#### Crescimento futuro

Adicionar widget novo: criar componente em `widgets/`, exportar via `widgets/index.ts`, adicionar import + render condicional em `SharedDashboard.tsx` (gated por `canView('xxx')`) e em `DashboardPage.tsx` (sem gate). Candidatos: `FinancialOverviewWidget` (`financial`), `OccurrencesAlertWidget` (`occurrences`), `LostFoundCounterWidget` (`lost-found`), `StoreOrdersStatusWidget` (`store-orders`).

#### Trade-offs registrados

- **Sem reordenacao por usuario**: todos veem na mesma ordem. Se virar requisito, adicionar JSONB `dashboard_widget_order` em `profiles`.
- **Sem thresholds configuraveis**: cada widget tem seus criterios hardcoded.
- **Mesmo vocabulario visual entre super_admin e demais**: e proposital — consistencia > diferenciacao.

#### Validacao

- `npx tsc -b` ✅ zero erros (modo strict project references — usado pelo Lovable)
- `npx vite build` ✅ build em ~5s
- Tested manually post-deploy: super_admin ve DashboardPage com todos os widgets; coordenador/professor/portaria/financeiro veem SharedDashboard com widgets contextuais; usuario sem permissoes ve empty-state.

---

### 10.17 Fase 16 — Módulo RH (cadastro + processo seletivo + captação pública)

**Status**: ✅ **Concluído (2026-04-19)** — PR1+PR2+PR3a+PR3+PR3.1+PR4+PR5 entregues, aplicados em produção (`dinbwugbwnkrzljuocbs`), com hardening de UX/segurança pós-auditoria (§10.17.B). Folha de pagamento permanece adiada para v2.

**Contexto**: colaboradores antes eram apenas `profiles` (email/nome/role/sector_keys) — sem CPF, endereço, cargo, documentos. Colaboradores de serviços gerais/cozinha/zeladoria não deveriam ocupar linha em `auth.users`. Processo seletivo vivia em planilhas externas. A Fase 16 estabelece RH como cidadão de primeira classe com entidade `staff` autônoma, promoção opt-in para `profiles` via edge function, pipeline de contratação no admin e captação pública no site.

**Folha de pagamento fica adiada para v2** (custo desproporcional para manter tabelas legais INSS/IRRF na v1).

#### Escopo aprovado (5 PRs)

1. **Cadastro autônomo de colaboradores** — tabela `staff` independente de `profiles` (um `staff` pode existir sem conta no sistema).
2. **Promoção opt-in** — botão "Criar acesso ao sistema" no drawer cria `auth.users`+`profiles` e linka via `staff.profile_id`; gated por dupla permissão (`users.can_create` + `rh-colaboradores.can_edit`); role restrita a `coordinator|teacher|user` (admin/super_admin continuam exclusivos do super_admin via UsersPage).
3. **Processo seletivo kanban** — vagas + candidatos com stages (novo → triagem → entrevista → proposta → contratado/descartado); trigger `promote_candidate_to_staff` cria `staff` ao marcar `contratado`.
4. **Captação pública** — página `/trabalhe-conosco` no site institucional, 3 passos (form básico + upload CV, extração automática de dados via `resume_extractor`, entrevista pré-candidatura com `pre_screening_interviewer` que gera relatório markdown). Totalmente customizável via `system_settings` key `content.careers` (padrão Whitelabel Fase 7).
5. **Agentes IA** (todos em background, sem botão manual):
   - `resume_extractor` — extrai JSON estruturado do CV (CPF, RG, CNH, experiência, formação, endereço). Roda no `careers-intake` assim que o candidato submete o form.
   - `pre_screening_interviewer` — conduz 4-6 turnos de chat no site aplicando DISC/STAR; gera relatório markdown + payload estruturado ao final.
   - `resume_screener` — seedado mas **adormecido**. Reservado para PR4 (v2): ranking da base reserva quando vaga da mesma área abrir.
   - `best_fit_selector` (PR4, v2) — orquestra `resume_screener` sobre a reserva e dispara `ai_insight` com top-N.
6. **Sub-módulos granulares** — `rh-colaboradores`, `rh-seletivo`, `settings-rh` para isolar dados sensíveis de coordenador/teacher.

#### Divisão em PRs

| PR | Objetivo | Status | Migrations |
|----|----------|--------|------------|
| PR1 | Cadastro autônomo + promoção | ✅ Concluído (2026-04-18) | 185, 186, 187 |
| PR2 | Processo seletivo (kanban) | ✅ Concluído (2026-04-18) | 204, 205 |
| PR3a | Agentes `resume_extractor`/`resume_screener` seedados + `extractPdfText.ts` | ✅ Concluído (2026-04-18) — botão manual removido pelo PR3 | 206 |
| PR3 | **Captação pública automática (área → vaga ou reserva → extrator → entrevistador)** | ✅ **Concluído (2026-04-18)** | 207, 208, 209, 211, 212 |
| PR3.1 | **Hardening pós-auditoria** (cron expirar sessões, LGPD audit, promote reserva, badges kanban, histórico de chat read-only, área pré-selecionada, `audit_logs` no intake) | ✅ Concluído (2026-04-18) | 213 |
| PR4 | Agente `best_fit_selector` sobre a base reserva | ✅ Concluído (2026-04-18) | 214 |
| PR5 | Importação em massa de colaboradores | ✅ Concluído (2026-04-18) | 215 |
| PR6 | Umbrella RH + Dashboard | ✅ Concluído (2026-04-18) | 216 |
| PR7 | Hero whitelabel `/trabalhe-conosco` + leitura anônima | ✅ Concluído (2026-04-18) | 217, 218 |
| PR8 | RLS `pre_screening_sessions` (aba Chat quebrada em prod) | ✅ Concluído (2026-04-18) | 219 |
| PR9 | Notificações WhatsApp automáticas no pipeline | ✅ Concluído (2026-04-19) | 220 |
| PR10 | CPF como chave natural + hardening do wizard público | ✅ Concluído (2026-04-19) | 221 |

> Numeração renumerada **+1 vs plano original** — migration 184 já existia (`dashboard_principal_widgets`). A migration 210 ficou com `nfe_stock_ledger` (módulo Financeiro), por isso a captação pública pula de 209 para 211.
>
> **Nota de replan (2026-04-18)**: o escopo original do PR3 (botão "Analisar com IA" manual no admin) foi implementado antes do alinhamento final e provou estar invertido — a intenção sempre foi *captação pública com pipeline automático*. O que já foi entregue (migration 206 com seeds + wrapper `extractPdfText.ts` + target `es2022` no Vite) permanece porque é **reaproveitado** pelo novo PR3 (ver abaixo). O botão manual no `CandidatoDrawer` será **removido** pelo PR3, substituído por exibição read-only do relatório da entrevista + dados extraídos que já chegam populados do fluxo público.

#### PR1 — Cadastro autônomo + promoção (✅ concluído 2026-04-18)

**Entregue — Banco**:
- `00000000000185_hr_modules_seed.sql` — módulos `rh-colaboradores` e `rh-seletivo` no grupo `rh` + defaults em `role_permissions`:
  - admin: all true
  - coordinator: `rh-colaboradores` view/edit, `rh-seletivo` só view
  - teacher/user: nada
- `00000000000186_staff.sql` — tabela standalone com `profile_id UUID UNIQUE NULL FK profiles(id) ON DELETE SET NULL`, `full_name`, `email` (CHECK formato), `phone`, `cpf UNIQUE`, `rg`, `birth_date`, endereço completo (`address_street/number/complement/neighborhood/city/state/zip`), `position NOT NULL`, `department`, `hire_date NOT NULL`, `termination_date`, `employment_type CHECK ('clt'|'pj'|'estagio'|'terceirizado')`, contato de emergência, `avatar_url`, `is_active`, `notes`, `created_by`. Trigger `sync_staff_to_profile_on_update` mantém `profiles` espelhado enquanto `profile_id IS NOT NULL`. RLS via `get_effective_permissions` + self-service (`profile_id = auth.uid()`).
- `00000000000187_staff_documents_bucket.sql` — bucket privado `hr-documents` (10MB, PDF/DOC/DOCX/JPEG/PNG) + tabela `staff_documents` (types: `contrato|rg|cpf|comprovante_residencia|carteira_trabalho|diploma|outro`) com RLS via módulo e self-service.

*Aplicado em produção* (`dinbwugbwnkrzljuocbs`) em 2026-04-18 via MCP `apply_migration`.

**Entregue — Edge Functions**:
- `staff-grant-access` (v1, `verify_jwt=true`) — valida `users.can_create` + `rh-colaboradores.can_edit` via `get_effective_permissions`, valida `role ∈ {coordinator,teacher,user}` (super_admin/admin ficam de fora), `auth.admin.createUser` com `must_change_password=true`, copia dados para `profiles`, UPDATE `staff.profile_id`, retorna `{ profile_id, temp_password, email, role }`. Rollback best-effort via `auth.admin.deleteUser` em falhas parciais.
- `staff-revoke-access` (v1, `verify_jwt=true`) — soft-delete profile (`is_active=false`) + zera `staff.profile_id`. Preserva `auth.users` para manter `audit_logs`. Protege contra auto-revocação e contra revogação de admin/super_admin (403).

*Deployadas via MCP `deploy_edge_function`* em 2026-04-18.

**Entregue — Frontend**:
- `src/admin/hooks/useStaff.ts` — CRUD de `staff` + wrappers para edge functions (`grantStaffAccess`, `revokeStaffAccess`).
- `src/admin/pages/rh/ColaboradoresPage.tsx` (`/admin/rh/colaboradores`) — listagem com busca (nome/email/cargo/CPF), filtros (ativo/inativo, com/sem acesso), chips de vínculo, badge "Acesso ativo", botão "Novo colaborador" atrás de `PermissionGate('rh-colaboradores','create')`.
- `src/admin/pages/rh/drawers/ColaboradorDrawer.tsx` — tab rail Pessoal/Profissional/Endereço/Acesso. Inclui:
  - Máscaras: CPF, CEP, telefone fixo e celular (10/11 dígitos).
  - Auto-preenchimento de endereço via `useCepLookup` (ViaCEP).
  - Toggle `is_active` no header (padrão do CLAUDE.md).
  - Aba "Acesso" só aparece em edição; cria/remove login, exibe senha temporária com botão copiar (ícone `Check` 2s) e aviso quando e-mail não preenchido.
- `src/admin/routes.tsx` — rota `/admin/rh/colaboradores` sob `<ModuleGuard moduleKey="rh-colaboradores">`.
- `src/admin/lib/admin-navigation.ts` — novo grupo "RH" (ícone `Briefcase`) com item "Colaboradores", visível para `super_admin|admin|coordinator`.

**Decisões chave**:
- `staff` é fonte de verdade para dados RH. Quando promovido, `full_name`/`email`/`phone` duplicam em `profiles` via trigger, mas RH ganha em caso de divergência.
- Demotar não apaga `auth.users` (preserva auditoria). Profile soft-deleted.
- Promoção via API direta com role admin/super_admin é rejeitada (400) pelo allowlist do edge function — nunca permite escalada silenciosa.

**Pendente (follow-up não bloqueante)**:
- Tab "Documentos" no drawer (hook `useStaffDocuments.ts` + upload para bucket `hr-documents`).
- Badge "Colaborador RH" + link em `UsersPage` para quem já tem `staff.profile_id`.
- `logAudit` específico para eventos grant/revoke (hoje cai no audit genérico via RLS).

#### PR2 — Processo seletivo (✅ concluído 2026-04-18)

**Entregue — Banco**:
- `00000000000204_job_openings.sql` — `id`, `title`, `department`, `location`, `description` (HTML), `requirements` (texto plano, entra no prompt do screener no PR3), `employment_type CHECK ('clt'|'pj'|'estagio'|'terceirizado')`, `salary_range_min/max NUMERIC(10,2)`, `status CHECK ('draft'|'published'|'paused'|'closed')`, `opened_at/closed_at`. Trigger `set_job_opening_timestamps` auto-seta `opened_at` no primeiro `published` e `closed_at` no `closed`. RLS via módulo `rh-seletivo` + admin ALL + **política anônima** `SELECT` quando `status='published'` (consumida pela futura página `/trabalhe-conosco` no PR4).
- `00000000000205_candidates_and_applications.sql`:
  - `candidates` — `full_name`, `email UNIQUE` (CHECK formato), `phone`, `cpf UNIQUE`, `rg`, `cnh`, `birth_date`, `linkedin_url`, `portfolio_url`, endereço completo, `extracted_payload JSONB` (reservado para o `resume_extractor` do PR3).
  - `job_applications` — FK `job_opening_id` + `candidate_id` com `UNIQUE(job_opening_id, candidate_id)`, `stage CHECK ('novo'|'triagem'|'entrevista'|'proposta'|'contratado'|'descartado')`, `stage_position INT`, `source`, `resume_path` (→ `hr-documents/_recruitment/{id}/resume.pdf`), campos do screener (`screener_score/summary/payload/screened_at`), campos do interviewer (`interview_report TEXT`, `interview_payload JSONB`), `rejected_reason`, `hired_staff_id UUID NULL FK staff ON DELETE SET NULL`, `hired_at`.
  - RPC `promote_candidate_to_staff(p_application_id UUID)` SECURITY DEFINER — copia dados do candidate + vaga para `staff` (position = `job_openings.title`, hire_date = CURRENT_DATE, employment_type herdado), preenche `hired_staff_id`/`hired_at` na candidatura, **idempotente** (retorna o staff existente se já promovido).
  - Trigger `trg_job_applications_promote` AFTER UPDATE OF stage WHEN `NEW.stage='contratado' AND OLD.stage<>'contratado'`.

*Aplicadas em produção* (`dinbwugbwnkrzljuocbs`) em 2026-04-18 via MCP `apply_migration`.

**Entregue — Frontend**:
- Hooks:
  - `src/admin/hooks/useJobOpenings.ts` — CRUD + filtro por status.
  - `src/admin/hooks/useCandidates.ts` — CRUD + `upsertCandidateByEmail()` (usado pelo drawer para não duplicar).
  - `src/admin/hooks/useJobApplications.ts` — CRUD com join em `candidates` + `job_openings`, `moveApplicationStage()`, `uploadApplicationResume()` (bucket `hr-documents`), `getApplicationResumeSignedUrl()` (URL assinada 1h), `promoteCandidateToStaff()` (RPC). Exporta constantes `STAGE_ORDER`, `STAGE_LABEL`, `STAGE_COLOR`.
- `src/admin/pages/rh/SeletivoPage.tsx` (`/admin/rh/seletivo`) com sub-tabs **Vagas** e **Pipeline**:
  - Vagas: listagem com busca (título/departamento/localização), filtros de status (all/published/draft/paused/closed), tabela com chips de status e vínculo, botão "Nova vaga" atrás de `PermissionGate('rh-seletivo','create')`.
  - Pipeline: seletor de vaga (filtra candidaturas) + **kanban horizontal de 6 colunas** (novo → triagem → entrevista → proposta → contratado → descartado) com drag-and-drop nativo (HTML5 `onDragStart/onDrop`), card de candidato exibe nome, vaga e score IA (verde ≥70, amber ≥40, cinza <40).
- `src/admin/pages/rh/drawers/VagaDrawer.tsx` — tab rail Informações/Descrição/Requisitos. Descrição usa `HtmlTemplateEditor` (TV-1) com `hideVariables`. Requisitos em textarea monoespaçado (texto plano).
- `src/admin/pages/rh/drawers/CandidatoDrawer.tsx` — tab rail Candidato/Currículo/Análise IA/Pipeline:
  - Candidato: `upsertCandidateByEmail` garante cadastro único; botão "Excluir candidato e todas as candidaturas" em vermelho outline.
  - Currículo: preview PDF inline via `<iframe>` sobre signed URL + upload que é persistido **ao salvar** a candidatura (evita órfãos no bucket).
  - Análise IA: lê `screener_payload` (pros[]/cons[]/recommendation/reasoning) + `screener_score` — placeholder até PR3 popular.
  - Pipeline: botões de estágio (desabilita o atual), campo "Motivo do descarte" aparece condicionalmente, aviso quando `hired_staff_id` já existe mostrando short-id do staff criado.
- `src/admin/routes.tsx` — rota `/admin/rh/seletivo` sob `<ModuleGuard moduleKey="rh-seletivo">`.
- `src/admin/lib/admin-navigation.ts` — item "Processo seletivo" (ícone `UserPlus`) no grupo RH, visível para `super_admin|admin|coordinator`.
- `src/admin/components/Sidebar.tsx` — `UserPlus` adicionado ao `ICON_MAP`.

**Decisões chave**:
- **Drag-and-drop HTML5 nativo** em vez de `@dnd-kit/*` — evita nova dependência para um uso simples; a regra de negócio crítica (mover para `contratado` cria staff) fica no trigger SQL, não no frontend.
- **Upload deferido**: CV é enviado apenas no `handleSave` com o `application_id` já resolvido, impedindo arquivos órfãos quando o usuário cancela a criação.
- **Leitura anônima de vagas publicadas** fica na política RLS desde PR2 — PR4 apenas consome `/trabalhe-conosco` sem nova migration para RLS.
- **Listagem com join**: `select('*, candidate:candidates(*), job_opening:job_openings(…)')` — uma única query paginada alimenta todo o kanban.

**Pendente (follow-up não bloqueante)**:
- Histórico de stage changes em `audit_logs` como timeline visual no drawer (hoje registra via `logAudit` mas sem UI dedicada).
- `stage_position` ainda não reordena manualmente dentro da coluna (drag entre colunas funciona; dentro da mesma coluna mantém ordem por `stage_position ASC`).

#### PR3a — Seeds dos agentes + `extractPdfText.ts` (✅ concluído 2026-04-18, parcialmente superado)

> ⚠️ **Replan**: este PR foi originalmente escopado como "botão manual no admin para analisar CV com IA". Descoberto em revisão (2026-04-18) que o design correto é **captação pública automática** (ver PR3 reescrito abaixo). O que foi entregue permanece porque é reaproveitado; o **botão manual será removido pelo PR3**.

**Entregue — Banco**:
- **Migration 206** (`rh_resume_agents_seed`) — seed idempotente (`ON CONFLICT DO UPDATE`) em `ai_agents`:
  - `resume_extractor` — Haiku 4.5, `temperature=0.1`, `max_tokens=1200`, JSON com identificação, contato, endereço, `experience[]`, `education[]`, `skills[]`, `summary`. **Consumido em background** pelo `careers-intake` do PR3.
  - `resume_screener` — Haiku 4.5, `temperature=0.2`, `max_tokens=800`, `{score_0_100, pros[], cons[], recommendation, reasoning}`. **Mantido adormecido** para reutilização futura (PR4: `best_fit_selector` sobre a base reserva, ou ranking automático pós-entrevista).
- Ambos usam wrapper defensivo `### USER RESUME (untrusted) … ### END RESUME`.

**Entregue — Frontend**:
- `src/lib/extractPdfText.ts` — wrapper lazy sobre `pdfjs-dist@4.2.67` (pinado sem caret, build `legacy` para evitar TLA em chunks antigos). Trunca em 24 000 chars. **Reaproveitado pelo PR3** tanto no client público quanto (em fallback) no admin.
- `vite.config.ts`: `build.target='es2022'` + `optimizeDeps.esbuildOptions.{target, supported: {'top-level-await': true}}` — necessário porque `pdfjs-dist 4.x` usa TLA no entrypoint. Dev server e publish quebravam sem isto.
- Botão **"Analisar com IA"** na aba "Análise IA" do `CandidatoDrawer` (**será removido pelo PR3**) — triggers manual do `resume_screener`, substituído pela análise automática do fluxo público.

**Pendência descoberta pelo replan**:
- A aba "Análise IA" do `CandidatoDrawer` passa a ser **read-only** exibindo o relatório da entrevista + payload do perfil (DISC/STAR) gerados automaticamente pelo PR3. Botão manual sai.

#### PR3 — Captação pública automática (✅ concluído 2026-04-18 — substitui PR3a+PR4 originais)

> Replan do escopo: botão "Analisar com IA" manual foi **removido**. Fluxo passou a ser 100% automático a partir da submissão pública. PR3a continua sendo reaproveitado (seeds + `extractPdfText.ts`).

**Visão**: candidato entra no site → escolhe área → vê vagas publicadas (ou segue para cadastro reserva se não houver) → preenche form mínimo (nome, email, telefone, upload CV PDF/JPG) → em background `resume_extractor` popula o cadastro → `pre_screening_interviewer` conduz chat curto contextualizado com vaga+dados extraídos → agradecimento. Candidatura chega pronta no kanban em `stage='triagem'` com relatório + perfil + CV baixável.

**Princípios**:
- Zero atrito para o candidato: CPF/endereço/experiência **nunca** digitados à mão — extraídos do CV em background.
- Sem botão de "Analisar com IA" no admin: a análise acontece **antes** da candidatura chegar ao admin.
- Aceita **cadastro reserva** (sem `job_opening_id`) para compor base quando vaga da mesma área abrir.
- Catálogo de áreas fixo (3 valores): `pedagogica | administrativa | servicos_gerais`.

**Migrations**:
- **207** `rh_careers_schema_alter.sql`:
  - `ALTER TABLE job_openings ADD COLUMN area TEXT NOT NULL DEFAULT 'administrativa' CHECK (area IN ('pedagogica','administrativa','servicos_gerais'))` + backfill + `ALTER COLUMN area DROP DEFAULT`.
  - `ALTER TABLE job_applications ALTER COLUMN job_opening_id DROP NOT NULL` (permite reserva).
  - `ALTER TABLE job_applications ADD COLUMN area TEXT NOT NULL CHECK (...)` — obrigatório em todos os registros (inclusive reserva).
  - `ADD COLUMN pre_screening_status TEXT CHECK ('pending','running','completed','abandoned')`, `ADD COLUMN pre_screening_session_id UUID`, `ALTER source SET DEFAULT 'manual'`.
  - `DROP CONSTRAINT job_applications_job_opening_id_candidate_id_key` + `CREATE UNIQUE INDEX job_applications_opening_candidate_uniq ON job_applications (job_opening_id, candidate_id) WHERE job_opening_id IS NOT NULL` (permite múltiplas reservas do mesmo candidato).
  - RLS: adiciona policy anônima `INSERT` indireta — todo write público passa por edge function `careers-intake` com `service_role`, então não abrimos política direta.
- **208** `pre_screening_sessions.sql` — tabela com `id UUID PK`, `application_id UUID FK ON DELETE CASCADE`, `token TEXT UNIQUE` (gerado via `gen_random_bytes`), `status CHECK ('active','completed','abandoned','expired')`, `messages JSONB DEFAULT '[]'::jsonb` (`[{role:'agent'|'user', text, at}]`), `area`, `started_at`, `completed_at`, `expires_at DEFAULT now()+'30 min'`. RLS: service_role only (public acessa via edge function passando token).
- **209** `pre_screening_interviewer_seed.sql` — agente `pre_screening_interviewer` (Haiku 4.5 ou Sonnet 4.5 conforme benchmark), `temperature=0.4`, `max_tokens=1500`. System prompt conduz **4-6 turnos** coletando: (1) disponibilidade + motivação; (2) fit DISC (cenário comportamental); (3) exemplo STAR aderente à área; (4) expectativa salarial/regime; (5) fechamento. Retorna a cada turno `{assistant_message, should_finalize, final_report?}`. Ao `should_finalize=true`, `final_report` traz markdown estruturado + payload JSON com `disc_profile`, `star_scores`, `fit_summary`, `recommendation`. Wrapper anti-injection reforçado (candidato tenta "se vender" com comandos).
- **211** `settings_rh_and_careers_content.sql`:
  - Módulo `settings-rh` (grupo settings) + defaults super_admin/admin ALL.
  - INSERT default em `system_settings` key `content.careers` com `{ hero_title, hero_subtitle, hero_image_url, areas_descriptions: {pedagogica, administrativa, servicos_gerais}, reserva_copy, thank_you_message, lgpd_consent_text }`.
  - (migration 210 ficou com `nfe_stock_ledger` do módulo Financeiro.)

**Edge Functions** (ambas `verify_jwt=false`):
- `careers-intake` (POST):
  - Body: `{ area, job_opening_id?, full_name, email, phone, resume_file (base64 ou multipart) }` + CV em PDF/JPG (≤ 5 MB).
  - Rate-limit por IP (10 req/h) + captcha Turnstile opcional (habilitado via `system_settings`).
  - Se PDF → `resume_extractor` via `ai-orchestrator` com `resume_text` extraído. Se JPG → OCR via Anthropic vision (input com imagem direto no agente).
  - UPSERT candidate por email. INSERT `job_applications` com `source='public_form'`, `stage='triagem'`, `area`, `job_opening_id` (pode ser null), `pre_screening_status='pending'`.
  - Upload CV para `hr-documents/_recruitment/{application_id}/resume.{ext}` + `UPDATE resume_path`.
  - INSERT `pre_screening_sessions` com token 32-byte base64url. Retorna `{ session_token, agent_first_message }`.
  - Validações: email formato, phone 10-11 dígitos, tamanho/mime do arquivo, consentimento LGPD.
- `careers-interview-turn` (POST):
  - Body: `{ session_token, user_message }`.
  - Valida `expires_at > now()` + `status='active'`.
  - Append mensagem em `messages` JSONB. Chama `ai-orchestrator` com histórico + dados extraídos + vaga (ou área se reserva).
  - Se `should_finalize=true`: UPDATE session (`status='completed'`, `completed_at=now()`) + UPDATE application (`interview_report=final_report.markdown`, `interview_payload=final_report.payload`, `pre_screening_status='completed'`) + dispara `ai_insight` para admin (inbox).
  - Retorna `{ assistant_message, done }`.

**Frontend público**:
- `src/pages/TrabalheConosco.tsx` — wizard com passos:
  0. **Área** — 3 cards grandes (pedagógica/administrativa/serviços gerais) com cor e ícone.
  1. **Vaga ou reserva** — lista vagas `status='published' AND area=<escolhida>`; card "Cadastro reserva" sempre visível como opção; mensagem amigável se lista vazia.
  2. **Dados + CV** — nome, email (formato), telefone (máscara), upload (drag-drop, validação de mime/tamanho), aceite LGPD obrigatório.
  3. **Entrevista** — chat WhatsApp-style consumindo `careers-interview-turn`; indicador "digitando…"; limite de 500 chars por mensagem; 10-15 min total.
  4. **Obrigado** — `thank_you_message` customizável.
- Hooks: `usePublicCareersConfig.ts` (lê `content.careers`), `usePublicJobOpenings.ts` (SELECT anon filtrando area + status).
- Reaproveita `extractPdfText.ts` (pré-parse client opcional para dar preview "lemos seu CV, agora vamos conversar").

**Frontend admin**:
- `VagaDrawer`: novo `SelectDropdown` **Área** (obrigatório) na aba Informações.
- `SeletivoPage`: nova sub-aba **Base reserva** (ao lado de Vagas/Pipeline) mostrando candidaturas `job_opening_id IS NULL`, agrupadas por área, com busca e filtro por status da entrevista.
- `CandidatoDrawer`:
  - Remove botão "Analisar com IA" da aba "Análise IA".
  - Aba "Análise IA" vira **read-only** exibindo: relatório markdown (via `react-markdown` ou renderer existente) + payload estruturado (DISC/STAR em cards), com timestamp.
  - Nova aba **Extração** (read-only) com os dados JSONB de `candidates.extracted_payload` organizados (identificação / contato / endereço / experiência / formação / skills).
  - Aba "Pipeline" mostra badge "Reserva (sem vaga)" quando `job_opening_id IS NULL`.
- `/admin/configuracoes?tab=rh` (gated `settings-rh`): edita `content.careers` (textos, áreas, thank you, LGPD) + toggle de captcha + configuração de rate-limit.

**Fluxo de dados (end-to-end)**:

```
candidato
   │ (form + CV + consentimento)
   ▼
careers-intake  ──► resume_extractor (Haiku) ──► candidates + job_applications (stage=triagem)
   │                                        └──► upload CV para hr-documents
   │
   └──► pre_screening_sessions (token)
   │
   ▼
candidato (chat)
   │ (user_message)
   ▼
careers-interview-turn  ──► pre_screening_interviewer (contexto: vaga+extracted+histórico)
   │
   └──► append messages ──► (N turnos) ──► final_report
                                              │
                                              ▼
                                job_applications.interview_report/payload
                                              │
                                              ▼
                                         ai_insight (inbox admin)
                                              │
                                              ▼
                                        admin abre drawer
                                        read-only: relatório + extração + CV
```

**Decisões chave**:
- **Área é obrigatória em `job_applications`** mesmo com vaga (redundante com `job_openings.area`) para simplificar filtros do kanban e permitir candidatura reserva sem JOIN.
- **Partial UNIQUE index** em vez de constraint plana — reserva admite múltiplas linhas por candidato (ex: inscreveu em pedagógica hoje, administrativa amanhã).
- **Chat com token, não com cookie/JWT** — candidato é anônimo, token opaco na session guarda o estado.
- **Screener adormecido** (seedado em PR3a) — fica pronto para uso futuro (ex: ranking automático da base reserva quando vaga abrir). Sem custo enquanto não for invocado.
- **`best_fit_selector`** fica como PR4 (pós-v1) — agente separado que, ao publicar uma vaga, roda sobre reservas da mesma área e marca as top-N com `ai_insight`.
- **Vision API para JPG de CV** — Anthropic suporta imagem no input; evita dependência de Tesseract/OCR server-side.

**Riscos/decisões documentadas**:
- **PDF parsing no client** (`pdfjs-dist` ~500 KB): lazy-load só quando wizard do passo 2 monta.
- **Duplicação staff↔profiles**: trigger mantém sincronia enquanto linkado; staff ganha se divergir.
- **Promoção sem escalada**: edge function recusa admin/super_admin no body.
- **LGPD/PII**: bucket privado + RLS + `audit_logs` via `logAudit`. Consentimento obrigatório no form público. Purge de CVs descartados após 180 dias (cron a ser definido).
- **Prompt injection via CV/chat**: wrapper defensivo `### USER RESUME (untrusted) ... ### END` + validação estrita do JSON retornado + limite de chars em mensagens do candidato.
- **Custo IA**: `resume_extractor` (~$0.004/CV) + `pre_screening_interviewer` (~$0.020/candidato, 4-6 turnos curtos) ≈ $0.024/candidato público; 100/mês ≈ $2.40.
- **Abuso endpoint público**: rate-limit IP, captcha opcional (Turnstile), session TTL 30 min, limite 5 MB no upload.
- **Migration numbering**: PR3 consome 207, 208, 209, 211 (pula 210 reservada ao `nfe_stock_ledger`). PR5 fica com 212.

#### §10.17.A — Auditoria pós-entrega PR3 (gaps identificados 2026-04-18)

Análise end-to-end do workflow real (produção `dinbwugbwnkrzljuocbs`) após deploy do PR3. Cada item abaixo foi validado contra schema + policies + cron schedule. Estão agrupados por severidade e endereçados no PR3.1.

**A1 — Segurança / Compliance (bloqueadores para v1)**

1. **Sem `pg_cron` para `expire_stale_pre_screening_sessions()`** — a função existe (migration 208), mas nenhum job a invoca. Verificado: `SELECT … FROM cron.job WHERE command ILIKE '%pre_screening%'` → vazio. Efeito: sessões abandonadas (candidato fechou o browser) ficam `active` para sempre; `job_applications.pre_screening_status` nunca vira `abandoned`; kanban não distingue "em chat" de "desistiu". **Fix**: agendar job a cada 15 min via `SELECT cron.schedule('expire_pre_screening_sessions', '*/15 * * * *', $$SELECT public.expire_stale_pre_screening_sessions()$$)` na migration 213.

2. **Aceite LGPD sem audit trail** — `careers-intake` só valida `lgpd_consent === true` e descarta. Não há coluna persistindo timestamp/IP/versão do texto aceito. Efeito: impossível defender eventual questionamento. **Fix**: adicionar `lgpd_consent_at TIMESTAMPTZ`, `lgpd_consent_version TEXT` e `lgpd_consent_ip TEXT` em `job_applications` (migration 213) + popular no intake.

3. **Sem rotina de purge para CVs descartados** — bucket `hr-documents/_recruitment/{id}/` acumula indefinidamente; LGPD exige descarte após fim da finalidade. **Fix**: job cron `purge_discarded_resumes` (180 dias após `rejected_at` ou `pre_screening_status='abandoned'`) removendo storage + anonymizando `candidates` (mantém `id`/`email_hash` para métrica).

4. **`careers-intake` não escreve em `audit_logs`** — quem submeteu, quando, para qual vaga, IP, user-agent: nada persistido fora do registro da candidatura. **Fix**: `logAudit('create', 'rh-seletivo', ...)` no final do intake + variante em `careers-interview-turn` ao finalizar.

**A2 — Funcional / Correção de bugs**

5. **`promote_candidate_to_staff` quebra para reserva (`job_opening_id IS NULL`)** — a RPC faz `SELECT … INTO v_job FROM job_openings WHERE id = v_app.job_opening_id` e depois `INSERT INTO staff (..., position, department, employment_type, ...) VALUES (..., v_job.title, v_job.department, ..., v_job.employment_type, ...)`. Com reserva, `v_job` fica vazio → `position` NOT NULL falha, contratação trava. Exposição: admin pode tentar mover candidato da base reserva direto para `contratado` no kanban. **Fix**: na migration 213 reescrever RPC para aceitar reserva com fallback `position = v_app.area` (label amigável), `employment_type = 'clt'` default, e exigir campo `position` explícito via parâmetro opcional `p_position TEXT`.

6. **Sem rollback transacional no `careers-intake`** — se upload do CV falha após o INSERT em `job_applications`, fica candidatura órfã (sem `resume_path`) e bloqueia retry do candidato (partial UNIQUE em `candidate_id, area WHERE job_opening_id IS NULL` dispara 409 `ja_aplicou`). **Fix**: envolver INSERT+upload em sequência com compensação — se upload falha, `DELETE FROM job_applications WHERE id = app_id`.

7. **Stage `novo` após `pre_screening_status='completed'`** — candidatura com IA concluída ainda aparece na coluna "Novos" do kanban, misturada com leads crus. Admin não vê que o relatório está pronto sem abrir o drawer. **Fix**: dois caminhos possíveis — (a) promover automaticamente para `triagem` ao finalizar entrevista (simples); (b) manter `novo` mas adicionar **badge visual** no card ("IA ✓") e filtro "apenas pré-qualificados". Recomendado (b) para dar controle ao admin.

8. **Sessão fixa de 30 min** — `pre_screening_sessions.expires_at DEFAULT (now() + interval '30 minutes')`. Candidatos com conectividade ruim ou que pausam para pensar podem estourar. Não é configurável. **Fix**: ler de `content.careers.session_ttl_minutes` no `careers-intake` ao criar sessão; expor campo no `RhSettingsPanel`.

**A3 — UX / Operação**

9. **Candidato não recebe email de confirmação** — nenhum trigger de notificação após submissão/entrevista concluída. **Fix** (v2): invocar `MessageOrchestrator` (Fase 11/12) após `should_finalize=true` com template `careers_confirmation`.

10. **Token do candidato não persiste localmente** — se fechar o browser durante o chat, perde tudo. **Fix**: `localStorage.setItem('careers_session', JSON.stringify({token, application_id, expires_at}))` no step 4 do wizard, com botão "retomar entrevista" ao voltar à página.

11. **Admin não vê histórico completo do chat** — drawer mostra apenas `interview_report` (markdown) + `interview_payload` (payload estruturado). As mensagens brutas estão em `pre_screening_sessions.messages JSONB` mas o admin não acessa. Útil para debug / disputa. **Fix**: aba **Chat** read-only no `CandidatoDrawer` lendo `pre_screening_sessions` via join na query já existente.

12. **Criação manual de candidatura não pré-seleciona área da vaga** — no `CandidatoDrawer`, quando admin abre "Novo candidato" dentro de uma vaga filtrada, a área default é `'administrativa'` (state inicial fixo), mesmo se a vaga for `pedagogica`. Permite inconsistência (candidatura com `area='administrativa'` ligada a `job_opening.area='pedagogica'`). **Fix**: quando `defaultJobOpeningId` é passado, buscar `job_openings.area` e usar como valor inicial do state.

13. **Sem indicador visual de `pre_screening_status` no kanban** — cards de "novo" não diferenciam: IA pendente? Rodando? Concluída? Abandonada? **Fix**: pequeno chip colorido no canto do card (padrão já existe em outros módulos via `STATUS_COLORS`).

**A4 — Observabilidade**

14. **Edge functions sem logging estruturado** — erros do orchestrator/upload só retornam via HTTP; nenhum `console.error` estruturado nem métrica. Debugging de produção depende de `supabase functions logs` ad-hoc. **Fix**: wrapper `logError(context, err)` em `_shared/observability.ts` gravando em `audit_logs` com `action='error'` e `module='rh-seletivo'`.

15. **Rate-limit é per-IP in-memory** — reset no cold start da edge function, compartilhado entre todos os candidatos de uma mesma rede (colégio, proxy). Aceito para MVP; migrar para Redis/KV se volume crescer.

**A5 — Contrato do settings**

16. **Key de rate-limit tem dois nomes** — o seed em migration 211 grava `rate_limit`, o `RhSettingsPanel` grava `rate_limit`, o `careers-intake` tenta `rate_limit_per_hour ?? rate_limit ?? 10`. Funciona, mas é frágil. **Fix**: padronizar em `rate_limit_per_hour` e migrar value atual na migration 213 (`UPDATE system_settings SET value = jsonb_set(value - 'rate_limit', '{rate_limit_per_hour}', value->'rate_limit') WHERE category='content' AND key='careers' AND value ? 'rate_limit'`).

**A6 — Testes / QA**

17. **Sem teste E2E do fluxo público** — submissão + chat + finalização são cobertos só por happy path manual. Não há suite automatizada. **Fix** (pós-v1): playwright script cobrindo os 5 passos do wizard com mock do orchestrator.

**Priorização para PR3.1** (migration 213):

| # | Severidade | Item |
|---|------------|------|
| 1 | 🔴 Bloqueador | Cron `expire_stale_pre_screening_sessions` |
| 2 | 🔴 Bloqueador | LGPD audit trail (`lgpd_consent_at/version/ip`) |
| 5 | 🔴 Bloqueador | `promote_candidate_to_staff` para reserva |
| 11 | 🟡 Alta | Aba "Chat" read-only no `CandidatoDrawer` |
| 13 | 🟡 Alta | Badge `pre_screening_status` no kanban |
| 4 | 🟢 Média | `audit_logs` em `careers-intake`/`careers-interview-turn` |
| 12 | 🟢 Média | Pré-seleção de área ao criar candidatura manual |
| 3, 8, 9, 10, 14, 16, 17 | 🔵 Backlog | v2 ou follow-up não bloqueante |

**Itens já validados como OK** (auditoria confirmou):
- ✅ Bucket `hr-documents` existe (privado, OK).
- ✅ Policy anon `SELECT` em `job_openings` com `status='published'` (wizard consegue listar vagas sem JWT).
- ✅ Policy anon `SELECT` em `system_settings` para `category IN ('content',...)` (RhSettingsPanel público-read OK).
- ✅ `candidates` e `job_applications` sem policies anon (writes só via edge function com service_role).
- ✅ Partial unique indexes funcionando (reserva aceita múltiplas áreas, vaga é unique por candidato).

#### PR4 (opcional, pós-v1) — `best_fit_selector` sobre base reserva

- Agente que, ao publicar vaga nova, roda sobre candidaturas reserva da mesma área e ranqueia usando `resume_screener` + `interview_payload`.
- Dispara `ai_insight` para admin com top-N sugeridos + CTA "mover para triagem".
- Opcionalmente envia comunicação via `MessageOrchestrator` (Fase 11/12) para os candidatos selecionados avisando da vaga.
- Implementação fica para quando a base reserva tiver volume real (>50 candidaturas).

#### PR5 (opcional) — Importação em massa (⏳ pendente)

- **212** `bulk_import_staff_key.sql` — registro em `migration_modules` (padrão OP-1).
- Edge Function `bulk-import-staff` — INSERT em `staff` sem criar auth/profile.
- Reaproveita `ModuleImportWizard` do hub `/admin/migracao`.

#### Ordem de execução revisada

1. **PR1** ✅ fundacional.
2. **PR2** ✅ kanban — base do PR3 e PR3a.
3. **PR3a** ✅ seeds `resume_extractor`/`resume_screener` + `extractPdfText.ts` (reaproveitados).
4. **PR3** ⏳ captação pública automática + remove botão manual do `CandidatoDrawer` (substitui PR3 manual original + PR4 original).
5. **PR4** ⏳ v2 — `best_fit_selector` sobre base reserva.
6. **PR5** ⏳ opcional — bulk import.

Commit/push via `./scripts/push-all.sh` a cada PR completo (branch `base`, sem force-push). Folha de pagamento e módulo `rh-folha` permanecem como ⏳ Pendente v2.

#### §10.17.B — Entregas pós-PR3.1 (hardening de produção, PR4 → PR10)

Depois do PR3.1 a Fase 16 recebeu 7 PRs incrementais endereçando os gaps da auditoria (§10.17.A) + operação real com o cliente Batista. Todas as migrations 213→221 estão aplicadas em `dinbwugbwnkrzljuocbs` e o código está no `base`/`main` via `./scripts/push-all.sh`.

**PR4 — `best_fit_selector` (✅ 2026-04-18, migration 214)**
- Seed do agente `best_fit_selector` em `ai_agents` (Haiku 4.5, wrapper defensivo, retorna top-5 com score+pros+cons).
- RPC `list_reserva_candidates_for_job(p_job_id UUID)` agrega candidaturas reserva da mesma área da vaga para alimentar o agente.
- Nova aba **Reserva** no `VagaDrawer` invoca o agente via `ai-orchestrator` e exibe cards rankeados com CTA "Mover para triagem" (cria/atualiza `job_applications` linkada à vaga).

**PR5 — Importação em massa de colaboradores (✅ 2026-04-18, migration 215)**
- Migration normaliza `role_permissions.can_create=true` em `rh-colaboradores` para admin/super_admin.
- Edge function `bulk-import-staff` (`verify_jwt=true`) — INSERT em `staff` sem criar `auth.users`/`profiles` (padrão OP-1).
- Reaproveita `ModuleImportWizard` com step opcional "Revisar" (`perRowOverrides`).
- Registra chave `staff` em `migration_modules` para aparecer no hub `/admin/migracao`.

**PR6 — Umbrella RH + Dashboard (✅ 2026-04-18, migration 216)**
- Novo módulo granular `rh-dashboard` (grupo `rh`, position 299, ícone `LayoutDashboard`) em `modules` + defaults em `role_permissions` (super_admin ALL, admin/coordinator view-only).
- `src/admin/pages/rh/RhPage.tsx` passa a ser umbrella com sub-tabs **Dashboard / Colaboradores / Processo seletivo** — mesmo padrão de `/admin/gestao` e `/admin/academico`.
- Sidebar: grupo "RH" visível quando o usuário tem view em pelo menos uma das 3 chaves.
- Dashboard mostra KPIs cross-submódulo (colaboradores ativos, vagas publicadas, candidatos por stage, taxa de conversão IA→entrevista).

**PR7 — Hero whitelabel de `/trabalhe-conosco` (✅ 2026-04-18, migrations 217+218)**
- `appearance.vagas` em `system_settings` com `{badge, title, highlight, subtitle, video_url, image_url, ...}` — mesma estrutura das páginas institucionais já whitelabel.
- Nova sub-aba **Vagas** em `/admin/configuracoes → Site → Aparência` (drag-drop, preview).
- `/trabalhe-conosco` renderiza hero full-height com stepper abaixo; conteúdo editorial (áreas, thank you, LGPD) migrado de `content.careers` → `content.vagas` para agrupar com o hero na mesma sub-aba.
- Migration 218 **amplia leitura anônima** em `system_settings` para `category IN ('branding','appearance','navigation','content')` com `key` whitelisted — unifica RLS das 4 categorias que alimentam a SPA pública antes de qualquer login.

**PR8 — RLS `pre_screening_sessions` (✅ 2026-04-18, migration 219)**
- A migration 208 habilitou RLS na tabela sem criar policies — edge functions (service-role) passavam, mas **admin autenticado era bloqueado** e a aba "Chat" do `CandidatoDrawer` voltava vazia em produção (bug só reproduzível com JWT real).
- Policies adicionadas:
  - `pre_screening_sessions_admin_all` — `FOR ALL` a quem tem `profiles.role ∈ (super_admin,admin)`.
  - `pre_screening_sessions_select_by_perm` — `FOR SELECT` via `get_effective_permissions('rh-seletivo', can_view)`.
- Padrão espelha o de `job_applications`.

**PR9 — Notificações WhatsApp no pipeline de RH (✅ 2026-04-19, migration 220)**
- Antes: admin movia candidato no kanban e nada era enviado — comunicação manual via WhatsApp individual.
- Agora: 4 transições (`entrevista`, `proposta`, `contratado`, `descartado`) disparam template automático via infra `auto-notify` (Fase 11/12), com dedup por stage.
- **Banco**:
  - `whatsapp_templates.category` CHECK estendido com `'rh-seletivo'`.
  - Coluna `job_applications.notified_stages TEXT[] DEFAULT '{}'` — array de stages já notificados; idempotente (voltar/avançar não re-dispara).
  - Seed de `system_settings.general.site_url` (fallback para `{{schedule_url}}`/`{{careers_url}}`) + `hr.required_docs` (lista para o template "contratado").
  - Trigger `trg_notify_on_rh_stage_change` (BEFORE UPDATE OF stage) — valida `trigger_secret`, `pg_net.http_post` para `auto-notify`, marca `notified_stages` na mesma transação.
  - Seed de `whatsapp_template_categories` com slug `rh-seletivo` + 9 variáveis (`candidate_name`, `candidate_first_name`, `job_title`, `job_area`, `school_name`, `business_hours_text`, `schedule_url`, `careers_url`, `required_docs_list`).
  - Seed dos 4 templates com body padrão em pt-BR.
- **Edge function `auto-notify`** (versão atual): novo branch `module === 'rh-seletivo'` resolve `candidates` + `job_openings` + `content.careers.thank_you_message`, monta variáveis e dispara via UazAPI. Dedup via `whatsapp_send_log` + marca de stage no BEFORE UPDATE.
- **Frontend**: `TemplatesPage` ganhou tag "RH — Seleção" no editor (lê catálogo dinâmico de `whatsapp_template_categories`).

**PR10 — CPF como chave natural + hardening do wizard público (✅ 2026-04-19, migration 221)**
- **Mudança de chave de negócio**: migration 221 **remove** `candidates_email_key UNIQUE` — o CPF (já UNIQUE desde 205) passa a ser a identidade humana do candidato. Um mesmo CPF pode atualizar email ao longo do tempo.
- **Validação**:
  - `src/lib/cpf.ts` — `cleanCpf`, `maskCpf`, `validateCpf` (checksum oficial Receita Federal, rejeita sequências repetidas).
  - `supabase/functions/_shared/cpf.ts` — cópia Deno (edge functions não importam de `src/`).
- **Wizard público** (`/trabalhe-conosco`):
  - CPF obrigatório no step 2, com máscara progressiva `000.000.000-00` e feedback visual de inválido.
  - Phone com máscara (10/11 dígitos).
  - Checkbox LGPD continua obrigatório; timestamp/IP/versão persistidos desde PR3.1.
- **Edge function `careers-intake`**:
  - `upsertCandidateByCpf` substitui `upsertCandidateByEmail` — lookup por CPF, atualiza email/telefone no UPDATE.
  - Rejeita CPF inválido (400) antes do UPSERT.
  - Sanitização: ignora `cpf === null` do CV extraído para não corromper candidatos legados.
- **`CandidatoDrawer`** (admin):
  - Novos campos: **CPF** (máscara + validador), **RG**, **data de nascimento**, endereço completo (`street/number/complement/neighborhood/city/state/zip`).
  - Backfill automático: ao criar candidatura via wizard, `extracted_payload` do CV preenche endereço + birth_date — admin não precisa redigitar.
  - **Alerta visual** acima do drawer quando há dados no `extracted_payload` que ainda não estão nos campos do candidato (ex.: candidato legado antes da extração): CTA "Preencher com dados do CV" copia em um clique.
  - **Máscara de telefone** aplicada no campo — resolve bug de persistência (input salvava só dígitos, drawer lia formatado).
  - **Chat da entrevista** (wizard público): `<textarea>` de 3 linhas com rolagem automática + Enter envia / Shift+Enter quebra linha. Bold `**texto**` renderizado via `src/lib/renderInline.tsx`.
  - **Exclusão unificada com banner**: dois botões vermelhos no rodapé (**Candidatura** / **Candidato**). Clicar abre banner explicativo com o escopo exato (candidatura = só aquela linha; candidato = cadastro + todas as candidaturas) + Confirmar/Cancelar. Substitui o padrão antigo de duplo-clique com timer de 3s.
- **Persistência corrigida**: bug em `updateCandidateByEmail` criava candidato órfão quando legacy tinha `cpf=null`. Drawer em modo edição agora usa `updateCandidate(application.candidate.id, ...)` direto.

**Hardening do `{{schedule_url}}` (✅ 2026-04-19, sem migration)**
- Gap descoberto em produção: template enviado com `https://agendar-visita` (sem host) porque `system_settings.general.site_url` estava vazio/parcial.
- **Solução dinâmica**:
  - `AdminLayout.tsx` faz upsert de `general.site_url = window.location.origin` no primeiro render, **apenas em origens públicas** (ignora localhost, `127.*`, `*.local`, redes privadas `10.*`/`192.168.*`/`172.16-31.*`).
  - Se o admin já salvou uma URL válida (via Config > Institucional > **Domínio de Produção**), o sync não sobrescreve — campo manual funciona como trava.
  - Edge function `auto-notify` valida com `new URL(...)` — valores sem host caem para path relativo `/agendar-visita` em vez de gerar link quebrado.
- Novo card **Domínio de Produção** (ícone `Globe`) no topo de `/admin/configuracoes → Institucional` com o campo `site_url`.
- Corrigido vazamento visual: chaves `lost_found_*` (category=`general` por migration 105) + `site_url` vazavam na "safety net" do final do painel institucional. Filtro atualizado.

**Integração com edge function `auto-notify`** (resumo do contrato atual para o módulo `rh-seletivo`):
- Input (body): `{ event: 'on_status_change', module: 'rh-seletivo', record_id, old_status, new_status }`.
- Resolve candidato (`candidates`), vaga (`job_openings`), identidade (`system_settings.branding.identity`), `business_hours` (`system_settings.general.business_hours`), documentos (`system_settings.hr.required_docs`) e URL pública (`system_settings.general.site_url` ou env `SITE_URL`).
- Monta variáveis padrão + `{{schedule_url}}` = `${siteUrl}/agendar-visita` e `{{careers_url}}` = `${siteUrl}/trabalhe-conosco`.
- Dispara via UazAPI com dedup em `whatsapp_send_log`; marca `notified_stages` na mesma transação do trigger.

**Itens de backlog que permanecem (pós-v1)**:
- Rotina `pg_cron` para `purge_discarded_resumes` (180 dias) — ainda não implementada (§10.17.A item 3).
- Email de confirmação ao candidato após submissão/finalização da entrevista (§10.17.A item 9) — depende de integração SMTP (hoje só WhatsApp).
- `localStorage` do token da entrevista para retomar após fechar browser (§10.17.A item 10).
- Teste E2E Playwright do wizard público (§10.17.A item 17).
- Padronização do rate-limit key `rate_limit` → `rate_limit_per_hour` (§10.17.A item 16) — ainda em double-read defensivo no `careers-intake`.

---

### 10.18 Auditoria & Hardening de Autenticacao dos 3 Portais

**Status**: ✅ Concluido (2026-04-18) — steps 1, 2 e 3 entregues. Os tres portais (aluno, responsavel, professor) agora tem gate `must_change_password` e os portais publicos (responsavel e professor) tem auto-servico de "esqueci minha senha" via WhatsApp.

**Contexto**. Auditoria comparou os fluxos de login dos portais Aluno (`/portal`), Responsavel (`/responsavel`) e Professor (`/professor`). Lacunas encontradas: (a) o flag `must_change_password` so existia em `profiles` e `guardian_profiles` — o portal do aluno nao tinha gate; (b) o "primeiro acesso" do responsavel pedia que o proprio responsavel escolhesse uma senha sem validar telefone, o que tornava o cadastro inicial fraco e abria caminho para enumeracao de CPF; (c) o portal do professor nao tinha fluxo proprio de "esqueci a senha" — depende hoje do reset feito pelo admin via `reset-user-password`.

#### Step 1 — Gate `must_change_password` nos 3 portais ✅

- **Migration 189** `must_change_password_students` (✅ aplicada) — adiciona o flag em `students`.
- **Edge function `change-password` v36** (✅ deployada) — UPDATE paralelo em `profiles` / `guardian_profiles` / `students` conforme o user logado, zerando o flag de qualquer um dos tres.
- **Tela compartilhada** `src/shared/components/PortalChangePasswordPage.tsx` + 3 wrappers `pages/trocar-senha/TrocarSenhaPage.tsx` (aluno/responsavel/professor) — reusa `PasswordCriteriaChecker` e a politica vigente em `system_settings.password_policy`.
- **Contextos atualizados**: `StudentAuthContext`, `GuardianAuthContext`, `ProfessorAuthContext` carregam `must_change_password` da tabela respectiva e expoem `clearMustChangePassword`.
- **`*ProtectedRoute`** redireciona para `/{portal}/trocar-senha` quando `mustChangePassword=true` e a rota atual nao for ela mesma. Rotas `trocar-senha` declaradas FORA do layout de cada portal pra evitar loop do guard.

Commit `20c076b feat(auth): gate must_change_password nos 3 portais`.

#### Step 2 — Primeiro acesso / esqueci-a-senha do responsavel via WhatsApp ✅

- **Migration 190** `guardian_access_attempts` (✅ aplicada) — rate-limit + auditoria; RLS habilitado sem policies (service_role only).
- **Edge function `guardian-request-access`** (✅ deployada v1, `verify_jwt=false`) — fluxo unico para primeiro acesso e esqueci-a-senha: valida CPF+telefone em `student_guardians` com match liberal de DDI, anti-enumeracao (mesma resposta generica para CPF inexistente e telefone divergente), rate-limit 3 envios/CPF/h e 10 tentativas/IP/10min, checa `chat/check` na UazAPI, gera senha provisoria (mesma rotina do `create-admin-user`), cria/atualiza `auth.users` + upsert em `guardian_profiles` (ou faz reset no caso esqueci-a-senha) e seta `must_change_password=true`, envia template `senha_temporaria` via UazAPI `/send/text` direto (a senha provisoria nunca trafega pro client) e loga em `whatsapp_message_log`.
- **`GuardianAuthContext`**: substitui `firstAccess(cpf, newPwd)` por `requestAccess(cpf, phone)` que invoca o edge function.
- **`/responsavel/login`**: tab "Primeiro acesso" agora pede CPF + telefone; estados `sent` ("Verifique seu WhatsApp"), `no_whatsapp` (com link `/agendar-visita`) e `rate_limited`. Form de login ganhou link "Esqueci minha senha / primeiro acesso".

Combinado com o gate do Step 1, o responsavel cai direto em `/responsavel/trocar-senha` no primeiro login com a senha provisoria.

Commit `fbb7c43 feat(auth): primeiro acesso/esqueci-a-senha do responsavel via WhatsApp`.

#### Step 3 — Reset / esqueci-a-senha do professor via WhatsApp ✅

- **Migration 191** `teacher_access_attempts` (✅ aplicada) — espelha a 190 (RLS sem policies, indices por email + por IP, mesmas chaves de `result` adaptadas: `email_not_found`/`no_phone`/`no_whatsapp`/...).
- **Edge function `professor-request-access`** (✅ deployada v1, `verify_jwt=false`) — analoga ao `guardian-request-access`, mas keyed em e-mail:
  - Body: `{ email, system_url? }`.
  - Lookup em `profiles` (`role='teacher' AND is_active=true`); sem match → resposta generica (anti-enumeracao).
  - Profile sem `phone` → mesma resposta generica (nao revela "tem cadastro mas falta telefone").
  - `chat/check` na UazAPI; sem WhatsApp → mensagem especifica orientando contato com a coordenacao.
  - Gera senha provisoria (`generateTempPassword`), `auth.admin.updateUserById`, marca `profiles.must_change_password=true`, envia template `senha_temporaria` via UazAPI direto e loga em `whatsapp_message_log` (`related_module='auth_teacher'`).
  - Rate-limit: 3 envios/email/h + 10 tentativas/IP/10min.
- **`ProfessorAuthContext`**: adiciona `requestAccess(email)` que invoca a edge function.
- **`/professor/login`**: novo modo "Recuperar senha" acionado pelo link "Esqueci minha senha"; mesmos estados de UX do responsavel (`sent`/`no_whatsapp`/`rate_limited`) e botao "Voltar para o login".

Combinado com o gate do Step 1, o professor cai direto em `/professor/trocar-senha` no proximo login com a senha provisoria.

**Fora de escopo (mantido)**: o admin continua podendo resetar via `/admin/usuarios` (`reset-user-password`); o novo fluxo e auto-servico, nao substitui o admin.

---

### 10.19 Carrinho Hibrido — localStorage + Supabase com Merge no Login

**Status**: ✅ **Entregue (2026-04-18)** — migration 192 (`store_carts`) aplicada, `useCart` reescrito com merge bidirecional no login, debounce de 1s para UPSERT, DELETE pos-checkout. Anti-loop via `mergedOnceRef`; subscription via `supabase.auth.onAuthStateChange` direto (provider scope do `GuardianAuthProvider` nao cobre `/loja/*`). Commit `ef40520`.

**Contexto**. Hoje `src/hooks/useCart.ts` opera 100% em `localStorage` (chave `store_cart`) com a TODO declarada na linha 74: `// TODO: when guardian auth is present, sync cart to Supabase store_cart table`. Isso e proposital — pre-login a loja nao pode pedir autenticacao (mata conversao), entao localStorage e o caminho zero-friccao para navegacao anonima. O problema aparece no usuario que abre a loja num device, monta o carrinho, e abre depois noutro device ja logado: o carrinho some.

**Decisao**: hibrido com **merge no login**, nao migracao total. Pre-login continua localStorage como antes. Ao detectar sessao do responsavel autenticado, `useCart` faz merge bidirecional com `store_carts` no servidor. Dai em diante, toda mutacao grava em ambos (localStorage como cache otimista, debounce de 1s para UPSERT no servidor). Logout limpa apenas o servidor; mantem o local.

**Por que nao so servidor**: anonimo perde carrinho ao trocar de device de qualquer jeito (nao tem identidade), e exigir login pra adicionar item mata a conversao. O ganho do TODO e o usuario logado — nao precisa cobrir mais.

#### 10.19.1 Schema (migration 192 planejada)

```sql
CREATE TABLE store_carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL UNIQUE REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  items       JSONB NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_store_carts_guardian_id ON store_carts(guardian_id);

ALTER TABLE store_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_carts_self" ON store_carts
  FOR ALL USING (
    guardian_id IN (SELECT id FROM guardian_profiles WHERE user_id = auth.uid())
  );

-- admin RLS via helper de modulo (admin/super_admin ALL) na convencao usada em store_orders
CREATE POLICY "store_carts_admin" ON store_carts
  FOR ALL USING (is_admin_or_super());

CREATE TRIGGER set_store_carts_updated_at
  BEFORE UPDATE ON store_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Convencao confirmada via auditoria**: `store_orders` (migration 95) usa `guardian_id UUID REFERENCES guardian_profiles(id)` e RLS `guardian_id IN (SELECT id FROM guardian_profiles WHERE user_id = auth.uid())`. A proposta original mencionava `guardian_user_id` — corrigido para alinhar com a convencao existente.

**JSONB schema** (validado via tipo `CartItem` em `useCart.ts`):
```json
[
  { "variantId": "uuid", "productName": "string", "variantDescription": "string",
    "sku": "string", "quantity": 2, "unitPrice": 49.90 }
]
```

#### 10.19.2 Politica de merge

Uniao por `variantId`, quantidade = `max(local.qty, server.qty)`. Assume "o que ele queria mais" — evita perder itens em qualquer direcao. Trade-off documentado: usuario que removeu item no device A e re-adicionou no B com qty menor pode ver a qty maior reaparecer; aceitavel para v1 (caso raro, comportamento previsivel).

```typescript
function mergeCartItems(local: CartItem[], server: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...server, ...local]) {
    const existing = map.get(item.variantId);
    map.set(item.variantId, existing
      ? { ...item, quantity: Math.max(existing.quantity, item.quantity) }
      : item);
  }
  return Array.from(map.values());
}
```

#### 10.19.3 Fluxo no `useCart`

1. **Mount** — le localStorage (comportamento atual mantido).
2. **Auth subscription** — `useEffect` registra `supabase.auth.onAuthStateChange`; quando `session?.user?.id` muda de `null` para um UUID:
   - SELECT em `store_carts` por `guardian_id` (via subquery `guardian_profiles.user_id = auth.uid()`).
   - Merge com o estado atual de `items`.
   - SetState com resultado mergeado + UPSERT imediato no servidor (sincroniza ambos os lados).
3. **Mutacoes** (`addItem`/`removeItem`/`updateQuantity`/`clearCart`) — atualizam `items` (que ja persiste em localStorage via effect existente). Se ha sessao ativa, agenda UPSERT no servidor com debounce de 1s (`useRef<number>` para timer + cleanup no unmount).
4. **Logout** — `onAuthStateChange` com session `null`: nao mexe no local (permite seguir comprando como anonimo); opcionalmente limpa o registro no servidor se preferirmos isolar contas (decisao: **mantem** o registro do servidor — proximo login do mesmo guardian recupera).
5. **Checkout** — quando `clearCart` e chamado pos-pedido, deleta tambem o servidor (DELETE direto, sem debounce).

**Por que ler sessao via `supabase.auth` direto e nao via `useGuardian`**: `GuardianAuthProvider` envolve apenas `/responsavel/*` (vide `src/responsavel/routes.tsx`). As paginas da loja (`/loja/*`) **nao** estao dentro desse provider, entao `useGuardian()` retornaria sempre o `defaultValue` (guardian: null) — e o `useCart` quebraria como dependencia. Solucao: `useCart` ouve `supabase.auth.getSession()` + `onAuthStateChange` direto. Sem dependencia ciclica entre `hooks/useCart.ts` e `responsavel/contexts/`.

#### 10.19.4 Esforco

- 1 migration (`00000000000192_store_carts.sql`).
- ~30 LOC adicionadas em `src/hooks/useCart.ts` (effect de auth + merge + debounce + DELETE no checkout).
- Sem mudancas em UI da loja (`ProdutoPage`, `CarrinhoPage`, `CheckoutPage`) — API publica do hook permanece.
- Sem alteracao no `GuardianAuthProvider` ou rotas.

#### 10.19.5 Notas de validacao (achados da auditoria do codigo)

- ✅ `useCart.ts:74` ja documenta a intencao via TODO — recomendacao aprovada sem reformulacao.
- ⚠️ Nome de coluna corrigido: `guardian_id` (FK pra `guardian_profiles.id`), nao `guardian_user_id`. Alinha com `store_orders` (migration 95).
- ⚠️ `GuardianAuthProvider` envolve so `/responsavel/*`. `useCart` precisa ler sessao direto via `supabase.auth` (nao via `useGuardian`).
- 🐛 **Achado lateral, fora de escopo**: `src/pages/loja/CheckoutPage.tsx:5,24` ja importa `useGuardian()` estando fora do provider — sempre cai no `defaultValue` (`guardian: null`) e o guard `if (!guardian) navigate('/responsavel/login')` redireciona em loop. Bug pre-existente que merece sprint propria (mover redirect para depois de validar sessao via `supabase.auth`, ou subir o `GuardianAuthProvider` para envolver `/loja/*` tambem). Nao bloqueia esta sprint do carrinho, mas precisa ser anotado pra nao "embolar" no merge.
- ✅ Politica de merge "uniao por variant_id, qty=max" mantida — simples e previsivel.
- ✅ Custo: zero risco de prejudicar conversao anonima (localStorage continua sendo a fonte de verdade pre-login).

---

### 10.20 Primeiro Acesso do Aluno via Responsavel (v2)

**Status**: ✅ **Entregue (2026-04-18)** — migration 193 (`student_access_attempts`), edge function `student-grant-access` deployada (v1, `verify_jwt=true`), `GrantStudentAccessButton` no DashboardPage do responsavel e banner CTA na aba "Primeiro acesso" do `/portal/login` (fluxo legado mantido como fallback, auditado como `channel='self_legacy'`). Commit `bedfb2a`.

**Contexto**. O fluxo atual em `src/portal/contexts/StudentAuthContext.tsx` (`firstAccess(enrollmentNumber, guardianCpf, newPassword)`) faz **self-signup** com dois dados que circulam socialmente — matricula do aluno + CPF do responsavel — e deixa o proprio usuario escolher a senha. Sem canal validado. Comparado com os fluxos do responsavel (Step 2 da auditoria, §10.18) e do professor (Step 3), e o elo fraco da cadeia: enumeracao por matricula + CPF e plausivel, e a "prova" de que quem cadastrou e quem deveria nao existe.

**Recomendacao original (2026-04-18)** — dois gaps:
1. Self-signup com CPF do responsavel e fraco. Idealmente, primeiro acesso do aluno deveria seguir o mesmo padrao do responsavel (canal validado), ou ficar gateado pelo responsavel ja autenticado ("Liberar portal do meu filho" no portal do responsavel).
2. `must_change_password` — `StudentAuthContext` deve checar pos-login e empurrar pra `/portal/trocar-senha` antes de liberar qualquer rota.

**Estado dos gaps**:
- **Gap 2 — JA FECHADO** no Step 1 da auditoria (§10.18). Migration 189 adicionou `students.must_change_password`, `StudentAuthContext` carrega o flag e `StudentProtectedRoute` redireciona pra `/portal/trocar-senha`. Sem trabalho adicional.
- **Gap 1 — pendente**, escopo desta sprint.

**Decisao**: gate primario via responsavel autenticado + canal WhatsApp do responsavel. Sem novo canal pelo aluno (na maioria dos casos e menor de idade e nao tem `phone` proprio em `students`). O fluxo legado de self-signup (`firstAccess`) e mantido como fallback degradado para escolas que ainda nao tenham nenhum responsavel digital cadastrado, mas com mensagem "Peca ao seu responsavel para liberar pelo portal dele" como CTA primario.

#### 10.20.1 Fluxo recomendado (gate via responsavel)

1. Responsavel autentica em `/responsavel` (fluxo ja seguro pos-Step 2).
2. No dashboard ou em `StudentSelector`, cada filho exibe um card. Card mostra badge "Acesso ao portal: liberado / nao liberado" baseado em `students.auth_user_id IS NOT NULL`.
3. Filho sem acesso → botao "Liberar acesso ao portal do meu filho" abre confirmacao.
4. Confirmacao chama edge function `student-grant-access` (`verify_jwt=true`) com body `{ student_id }`:
   - Valida que o `auth.uid()` do caller e um guardian vinculado ao `student_id` via `student_guardians.guardian_user_id`.
   - Carrega `students.full_name`, `students.enrollment_number`, `guardian_profiles.phone`.
   - Gera senha provisoria (`generateTempPassword`), cria `auth.users` com email sintetico (`{enrollment}@aluno.local` — mesmo padrao usado em `toEmail()`), seta `auth_user_id` em `students` e `must_change_password=true`.
   - `chat/check` na UazAPI no telefone do guardian.
   - Envia template `senha_temporaria` via UazAPI `/send/text` direto, com `{{user_name}}`=nome do aluno, `{{temp_password}}`, `{{system_url}}=/portal/login`.
   - Loga em `whatsapp_message_log` (`related_module='auth_student'`, `related_id=student_id`) e em `student_access_attempts` (`channel='guardian_grant'`).
5. Resposta: `{ status: 'sent' }` → UI mostra "Senha provisoria enviada para o WhatsApp do responsavel"; aluno usa enrollment_number + senha provisoria → cai direto em `/portal/trocar-senha` (gate do Step 1).

**Reenvio**: se `students.auth_user_id IS NOT NULL`, o mesmo botao vira "Reenviar acesso" e dispara reset (`auth.admin.updateUserById` com nova senha + `must_change_password=true`) — mesmo edge function, branch logico interno.

**Rate-limit**: 3 grants/student/h + 5 grants por `granted_by_guardian_user_id`/h (auditados em `student_access_attempts`).

#### 10.20.2 Fallback legado (`firstAccess` self-signup)

Mantido por enquanto em `/portal/login` aba "Primeiro acesso", mas com:
- Banner topo da aba: "**Recomendado**: peca ao seu responsavel para liberar o acesso pelo portal dele". Link para `/responsavel/login`.
- Fluxo legado fica **abaixo** desse aviso, com label "Nao tenho responsavel digital? Use a matricula + CPF".
- Logado em `student_access_attempts` com `channel='self_legacy'` para podermos medir uso e desativar quando residual.
- **Hardening minimo no legado**: adiciona rate-limit por IP (5 tentativas/10min) e bloqueio se ja existir `auth_user_id` (mensagem "Acesso ja ativado, peca ao responsavel para reenviar").

Roadmap futuro (nao nesta sprint): apos 90 dias monitorando uso, se `self_legacy` ficar abaixo de 1% das ativacoes, **remover** o fluxo legado e deixar apenas o gate via responsavel.

#### 10.20.3 Schema (migration 193 planejada)

```sql
CREATE TABLE student_access_attempts (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                    UUID REFERENCES students(id) ON DELETE SET NULL,
  granted_by_guardian_user_id   UUID,  -- auth.users.id do responsavel autenticado (nullable para self_legacy)
  ip_address                    TEXT,
  user_agent                    TEXT,
  channel                       TEXT NOT NULL CHECK (channel IN ('guardian_grant','self_legacy')),
  result                        TEXT NOT NULL CHECK (result IN (
    'sent','student_not_found','no_guardian_phone','no_whatsapp',
    'rate_limited','whatsapp_send_failed','invalid_input','wa_not_configured','unauthorized'
  )),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_access_attempts_student_created
  ON student_access_attempts(student_id, created_at DESC);
CREATE INDEX idx_student_access_attempts_guardian_created
  ON student_access_attempts(granted_by_guardian_user_id, created_at DESC);
ALTER TABLE student_access_attempts ENABLE ROW LEVEL SECURITY;
-- sem policies — service_role only (mesmo padrao das migrations 190/191)
```

#### 10.20.4 Edge functions

- **Nova**: `supabase/functions/student-grant-access/index.ts` (`verify_jwt=true`):
  - Body: `{ student_id }` + `system_url?`.
  - Autorizacao: `auth.uid()` precisa estar em `student_guardians.guardian_user_id` para o `student_id`. Caso contrario, log `result='unauthorized'` e 403.
  - Rate-limit: 3 envios por `student_id` em 1h; 5 envios por `granted_by_guardian_user_id` em 1h.
  - Carrega telefone via `guardian_profiles.phone` (do guardian autenticado, nao do `student_guardians.guardian_phone` — fonte de verdade pos-Fase 10).
  - Branch interno: se `students.auth_user_id IS NULL` → `auth.admin.createUser` + `update students set auth_user_id=...`; caso contrario → `auth.admin.updateUserById` (reset de senha).
  - Em ambos os branches: `update students set must_change_password=true, password_changed_at=NULL`.
  - WhatsApp: mesma rotina de `guardian-request-access` / `professor-request-access` — UazAPI `/chat/check` + `/send/text` direto, sem trafegar a senha pelo client.
- **Modificada (opcional)**: `student-self-firstaccess/index.ts` (extracao do `firstAccess` legado de dentro do `StudentAuthContext` para edge function dedicada com rate-limit por IP e auditoria em `student_access_attempts` channel `self_legacy`). Justifica para anti-enumeracao + telemetria. Pode ficar fora desta sprint se preferirmos manter o client-side flow durante a transicao.

#### 10.20.5 UI

**Portal do responsavel** (`/responsavel`):
- Novo componente `<GrantStudentAccessButton studentId={...} hasAccess={...} />` em:
  - `src/responsavel/components/StudentSelector.tsx` (botao discreto no card de cada filho)
  - Dashboard / pagina principal do responsavel (CTA destacado quando algum filho nao tem acesso)
- Estados: `idle` / `confirming` / `sending` / `sent` (mensagem "Senha provisoria enviada para o seu WhatsApp") / `error`.
- Reenvio: confirmacao extra ("Vamos enviar uma nova senha. A anterior deixa de funcionar.").

**Portal do aluno** (`/portal/login`):
- Aba "Primeiro acesso" reescrita com banner CTA primario ("Peca ao responsavel para liberar pelo portal dele" + link `/responsavel/login`).
- Fluxo legado mantido visualmente abaixo, com aviso "Recomendamos passar pelo seu responsavel".

**`StudentAuthContext`**: nenhum metodo novo precisa ser exposto — o fluxo gateado e disparado pelo responsavel; o aluno ja consegue logar com a senha provisoria normalmente via `signIn` (que ja existe).

#### 10.20.6 Esforco

- 1 migration (`00000000000193_student_access_attempts.sql`).
- 1 edge function nova (`student-grant-access` ~180 LOC, espelha `guardian-request-access`).
- 1 componente novo (`GrantStudentAccessButton.tsx` ~80 LOC) + integracao em 2 telas do portal do responsavel.
- Reescrita parcial do `LoginPage` do aluno (banner + aviso).
- Total: ~400 LOC + migration + edge function. Comparavel ao Step 2 da auditoria.

#### 10.20.7 Notas de validacao (achados da auditoria do codigo)

- ✅ `StudentAuthContext.firstAccess` confirmado: `signUp` puro com email sintetico + senha escolhida pelo user. Sem canal validado. Gap 1 confirmado.
- ✅ Gap 2 (`must_change_password` no portal do aluno) **ja foi resolvido** no Step 1 da §10.18. Sem trabalho extra.
- ✅ `student_guardians.guardian_user_id` (FK `auth.users`, migration 44) habilita o gate "responsavel autenticado". Indice ja existe (`idx_student_guardians_user_id`).
- ✅ `students.auth_user_id` ja serve de chave logica de "tem acesso ou nao" — reaproveitavel pelo botao de grant/reenvio.
- ✅ Reuso completo da rotina de WhatsApp + `generateTempPassword` ja consolidada nos Steps 2 e 3 — diff de codigo concentrado em (a) novo edge function e (b) UI do botao.
- ⚠️ **Decisao consciente**: senha vai pro WhatsApp do **responsavel**, nao do aluno (aluno geralmente e menor; `students` nao tem `phone` proprio na schema atual). Caso futuro queira canal direto, alteracao seria aditiva (campo `student_phone` + opcao no botao).
- ⚠️ **Coexistencia legada**: durante o periodo de monitoramento, dois caminhos possiveis para criar acesso. Ambos auditados em `student_access_attempts` para podermos medir e remover o legado quando seguro.

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

## 12. Auditoria de Pipelines — Gaps Criticos (2026-04-17)

> Levantamento tecnico completo dos pipelines criticos do sistema, identificando desconexoes entre modulos. Ordenado por severidade e impacto operacional.

---

### 12.1 Pipeline Financeiro

#### F-1 — NF-e de entrada NAO cria lancamento em `financial_payables` [CRITICO] ✅ Resolvido (Sprint 9.6, migration 135)

**Arquivo:** `src/admin/pages/financial/NfeEntradasPage.tsx`, funcao `handleSave()` (linhas ~307–382)

O fluxo de importacao de XML persiste em `nfe_entries` + `nfe_entry_items` e encerra. Nenhuma chamada para `financial_payables` e o campo `nfe_entries.status` fica eternamente em `'imported'` — nunca transita para `'processed'`. Compras de fornecedores existem no modulo fiscal mas sao **invisiveis para o modulo financeiro**, causando subnotificacao sistematica de despesas.

**Solucao:** Apos a importacao (ou via botao "Processar NF-e"), criar automaticamente um `financial_payables` com `amount = valor_total_nfe`, `fornecedor_id`, `due_date` configuravel, e atualizar `nfe_entries.status = 'processed'`. Adicionar coluna `nfe_entry_id UUID REFERENCES nfe_entries` em `financial_payables` para rastreabilidade bidirecional. Migration necessaria.

---

#### F-2 — Baixa de A/P e A/R nao cria movimentacao no caixa [ALTO] ✅ Resolvido (Sprint 9.6, migration 136)

**Arquivo:** `FinancialPayablesPage.tsx` funcao `payPayable()` (linhas ~303–318); padrao identico em `FinancialReceivablesPage.tsx`

`payPayable()` faz `UPDATE financial_payables SET status = 'paid'` e encerra. Nao cria `financial_cash_movements` com `type = 'outflow'`. O caixa fisico (`financial_cash_registers.current_balance`) nao e reduzido. O mesmo padrao ocorre em receivables — recebimentos marcados manualmente nao entram no caixa.

**Solucao:** Ao confirmar pagamento/recebimento, criar automaticamente um `financial_cash_movements` vinculado ao caixa aberto do dia. Se nenhum caixa estiver aberto, exibir modal de confirmacao antes de registrar.

---

#### F-3 — PDV manual: insert de `financial_cash_movements` falha silenciosamente [CRITICO] ✅ Resolvido (Sprint 9.6, migration 136)

**Arquivo:** `src/admin/pages/loja/PDVPage.tsx` linhas ~300–306

O PDV insere `reference_type: 'order'` mas a constraint do banco aceita apenas `'receivable' | 'payable'`. O insert tambem omite `cash_register_id` (NOT NULL FK) e `balance_after` (NOT NULL). O erro e capturado pelo `catch` e ignorado. Toda venda PDV manual registra `store_orders` mas **nenhum movimento financeiro e criado**.

**Solucao:** (a) Adicionar `'order'` ao CHECK de `reference_type` em `financial_cash_movements` via migration; (b) buscar o caixa aberto do dia e incluir `cash_register_id` e `balance_after` calculado no insert; (c) se nenhum caixa estiver aberto, bloquear a finalizacao e orientar o usuario a abrir caixa primeiro.

---

#### F-4 — Pedido online pago via webhook NAO cria lancamento financeiro [CRITICO] ✅ Resolvido (Sprint 9.6, migration 138)

**Arquivo:** `supabase/functions/payment-gateway-webhook/index.ts` linhas ~297–313

O webhook de confirmacao de pagamento apenas faz `UPDATE store_orders SET status = 'payment_confirmed'`. Nao cria `financial_receivables`, `financial_cash_movements` nem atualiza parcelas. Toda receita da loja virtual e **invisivel** para o modulo financeiro.

**Solucao:** Apos confirmar o pagamento no webhook, criar um `financial_receivables` com `source_type = 'store_order'`, `source_id = order_id`, `amount = total_amount`, e opcionalmente um `financial_cash_movements` se existir caixa do dia aberto. Tornar idempotente via `ON CONFLICT DO NOTHING`.

---

#### F-5 — `store_orders` ausente das views de relatorio financeiro [ALTO] ✅ Resolvido (Sprint 9.6, migration 139)

**Arquivo:** `supabase/migrations/00000000000073_financial_report_views.sql`

As views `financial_cash_flow_view` e `financial_dre_view` consolidam `financial_receivables + financial_installments + financial_payables + financial_cash_movements`. Nenhuma delas inclui `store_orders`. Mesmo apos F-4 ser corrigido (pedidos gerando receivables), as views devem ser auditadas para garantir que a cadeia esteja completa.

**Solucao:** Apos implementar F-3 e F-4, auditar as views e incluir `store_orders` como fonte direta de receita caso o modelo de dados justifique (vs. transitar sempre via `financial_receivables`).

---

#### F-6 — Pagamento manual de parcela nao atualiza o caixa [ALTO] ✅ Resolvido (Sprint 9.6, migration 136)

**Arquivo:** `src/admin/pages/financial/FinancialInstallmentsPage.tsx` funcao `handlePay()` (linhas ~125–157)

`handlePay()` faz `UPDATE financial_installments SET status = 'paid'` e encerra. Nao cria `financial_cash_movements` nem atualiza `current_balance` do caixa aberto. Pagamentos em dinheiro na secretaria nao refletem no caixa fisico.

**Solucao:** Mesmo padrao de F-2 — ao confirmar pagamento manual, criar movimento no caixa aberto do dia.

---

### 12.2 Pipeline Academico

#### A-1 — Frequencia por disciplina nunca gravada: `AttendanceTab` omite `discipline_id` [CRITICO] ✅ Resolvido (Sprint 9.7, migration 140)

**Arquivo:** `src/admin/pages/teacher/tabs/AttendanceTab.tsx` linha ~55

O upsert de presenca usa `{ student_id, class_id, date, status }` — sem `discipline_id`. A migration 50 adicionou a coluna mas o frontend nunca a preenche. Consequencias em cascata:
- `AlertasFrequenciaPage.tsx` tenta agrupar por `discipline_id` mas todos os registros sao `null` — % de frequencia por disciplina e invalido
- `calculate-grades` (Edge Function) le `student_attendance.discipline_id` para calcular `attendance_pct` no boletim — resultado incorreto para todas as turmas

**Solucao:** Passar `discipline_id` no upsert de frequencia; adicionar seletor de disciplina na UI do `AttendanceTab` (pode ser derivado do horario do dia via `class_schedules`).

---

#### A-2 — Provas (`class_exams`) desconectadas do boletim: sem tabela de resultados por aluno [CRITICO] ✅ Resolvido (Sprint 9.7, migration 140)

**Arquivo:** `ProvasAdminPage.tsx`, `supabase/migrations/00000000000080_class_exams.sql`

`class_exams` armazena a prova mas nao ha tabela `exam_results` ou `exam_student_scores`. Nao e possivel registrar a nota de um aluno numa prova especifica. O modulo de provas esta conceitualmente completo mas **desconectado do boletim** — nenhuma nota de prova alimenta `grades` automaticamente. O professor precisaria lancar manualmente em `GradesTab` sem vinculo com a prova.

**Solucao:** Criar tabela `exam_results (exam_id FK, student_id FK, score, feedback, graded_at, graded_by)` com upsert no portal do professor. Conectar ao `calculate-grades` para incluir nota de prova na media do periodo. Migration necessaria.

---

#### A-3 — Dois cadastros de disciplinas paralelos sem mapeamento [CRITICO] ✅ Resolvido (Sprint 9.8, migration 141)

**Arquivos:** `ObjetivosPage.tsx` (usa `school_subjects`); `GradeHorariaPage.tsx`, `class_exams`, `grades`, `AttendanceTab` (usam `disciplines`)

`school_subjects` (tabela legada, usada no diario e objetivos BNCC) e `disciplines` (tabela atual, usada em grade horaria, notas e frequencia) coexistem sem FK nem tabela de mapeamento. E impossivel vincular um objetivo BNCC diretamente a uma disciplina da grade, ou correlacionar o diario de classe com notas reais.

**Solucao:** Migration de consolidacao: adicionar `discipline_id UUID REFERENCES disciplines` em `school_subjects`, criar migration de mapeamento para registros existentes, e deprecar progressivamente `school_subjects` migrando referencias para `disciplines`. Ou inverso: adicionar `subject_id` em `disciplines`. Decisao de design necessaria antes da migracao.

---

#### A-4 — `student_results` (boletim) so atualiza via "Fechar Periodo" manual [ALTO] ✅ Resolvido (Sprint 9.7, migration 140)

**Arquivo:** `src/admin/pages/academico/BoletimPage.tsx` linha ~159

A tabela `student_results` fica desatualizada ate o admin clicar em "Fechar Periodo". Lancar uma nota nao atualiza o boletim em tempo real.

**Solucao:** Trigger Postgres em `grades` e `student_attendance` que chame `calculate-grades` de forma incremental (ou via pg_net para invocar a Edge Function), ou executar o calculo como cron diario. Para MVP: exibir aviso no boletim indicando data do ultimo calculo.

---

#### A-5 — Grade horaria e diario do professor completamente desconectados [ALTO] ✅ Resolvido (Sprint 9.8, migration 141)

**Arquivos:** `GradeHorariaPage.tsx`, `DiarioAdminPage.tsx`, `supabase/migrations/00000000000077_class_diary.sql`

Nao existe logica que, ao abrir o diario, pré-popule as aulas com base na grade configurada. O campo `class_diary_entries.lesson_plan_id` tem comentario "FK para lesson_plans (add depois)" — nunca implementado. O professor escreve qualquer coisa em qualquer data sem referencia ao horario programado.

**Solucao:** Ao abrir o diario para uma data, buscar `class_schedules` para aquele dia e pre-popular entradas de diario com `discipline_id`, `teacher_id` e `class_id` correspondentes. O professor confirma e complementa o conteudo.

---

#### A-6 — `AlertasFrequenciaPage` carrega todo historico sem filtro de ano letivo [ALTO] ✅ Resolvido (Sprint 9.6, migration 139)

**Arquivo:** `src/admin/pages/academico/AlertasFrequenciaPage.tsx` linha ~104

SELECT sem `.eq('school_year', ...)` — em producao com varios anos letivos, carrega todos os registros, degradando performance e calculando % incorretos (mistura anos).

**Solucao:** Adicionar filtro por `school_year = current_year` (ou seletor de ano na toolbar). Simples de implementar.

---

#### A-7 — Parcelas de matricula sempre iniciam em janeiro, criando vencidas retroativas [ALTO] ✅ Resolvido (Sprint 9.6, migration 137)

**Arquivo:** `supabase/migrations/00000000000046_financial_module.sql` linha ~408

`generate_installments_for_contract` calcula vencimentos a partir de `make_date(school_year, 1, 1)`. Uma matricula em abril gera parcelas jan-abr com status `'overdue'` imediatamente. O sistema infla artificialmente a inadimplencia e envia cobranças erroneas.

**Solucao:** Adicionar parametro `p_start_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)` a funcao e iniciar a geracao no mes da matricula. Oferecer opcao de cobrar retroativamente ou nao no wizard de contrato.

---

### 12.3 Tabela Resumo — Priorizacao

| # | Gap | Severidade | Impacto | Sprint | Status |
|---|-----|-----------|---------|--------|--------|
| F-3 | PDV manual nao grava no caixa | **CRITICO** | Caixa do dia incorreto | 9.6 | ✅ Resolvido |
| F-4 | Pedido online invisivel para financeiro | **CRITICO** | Receita nao contabilizada | 9.6 | ✅ Resolvido |
| A-1 | Frequencia por disciplina sempre nula | **CRITICO** | Boletim e alertas incorretos | 9.7 | ✅ Resolvido |
| A-2 | Provas sem tabela de resultados por aluno | **CRITICO** | Modulo inteiro nao funcional | 9.7 | ✅ Resolvido |
| A-3 | Dois cadastros de disciplinas sem mapeamento | **CRITICO** | Bloqueia integracao de modulos | 9.8 | ✅ Resolvido |
| F-1 | NF-e nao gera contas a pagar | **CRITICO** | Despesas nao contabilizadas | 9.6 | ✅ Resolvido |
| F-2 | Baixa A/P e A/R nao atualiza caixa | Alto | Caixa inconsistente | 9.6 | ✅ Resolvido |
| F-6 | Parcela paga manualmente nao atualiza caixa | Alto | Caixa inconsistente | 9.6 | ✅ Resolvido |
| A-4 | Boletim so atualiza com "Fechar Periodo" | Alto | UX degradada | 9.7 | ✅ Resolvido |
| A-5 | Grade horaria desconectada do diario | Alto | Diario sem contexto | 9.8 | ✅ Resolvido |
| A-6 | Frequencia sem filtro de ano letivo | Alto | Performance + dados errados | 9.6 | ✅ Resolvido |
| A-7 | Parcelas iniciam sempre em janeiro | Alto | Inadimplencia inflada | 9.6 | ✅ Resolvido |
| F-5 | store_orders fora das views de relatorio | Alto | Relatorios incompletos | 9.6 | ✅ Resolvido |

---

### 12.4 Sprints Concluidos

#### Sprint 9.6 — Pontes Financeiras ✅ (migrations 133–139, 2026-04-17)

| Item | Arquivo | Resultado |
|------|---------|-----------|
| F-1 | `NfeEntradasPage.tsx` + migration 135 | `handleSave()` cria `financial_payables`; `nfe_entry_id` FK adicionado |
| F-2 | `FinancialPayablesPage.tsx`, `FinancialReceivablesPage.tsx` | Baixa cria `financial_cash_movements` no caixa aberto (migration 136) |
| F-3 | `PDVPage.tsx` + migration 136 | `reference_type 'order'` adicionado ao CHECK; `cash_register_id` e `balance_after` incluidos |
| F-4 | `payment-gateway-webhook/index.ts` + migration 138 | Cria `financial_receivables` idempotente apos confirmacao de pagamento |
| F-5 | migration 139 | `store_orders` incluidos em `financial_cash_flow_view` e `financial_dre_view` |
| F-6 | `FinancialInstallmentsPage.tsx` | `handlePay()` cria movimento no caixa aberto (migration 136) |
| A-6 | `AlertasFrequenciaPage.tsx` | Filtro de `school_year` adicionado no SELECT (migration 139) |
| A-7 | migration 137 | Parametro `p_start_month` em `generate_installments_for_contract` |
| Bonus | `PDVPage.tsx`, `CheckoutPage.tsx`, `FinancialSettingsPanel` + migrations 133–134 | `store_payment_surcharges`: acrescimo por forma de pagamento |

#### Sprint 9.7 — Pipeline Academico ✅ (migration 140, 2026-04-17)

| Item | Arquivo | Resultado |
|------|---------|-----------|
| A-1 | `AttendanceTab.tsx` | Seletor de disciplina adicionado; `discipline_id` no upsert de chamada |
| A-2 | migration 140 + `ProvasAdminPage.tsx` | Tabela `exam_results` criada; UI de lancamento de notas por aluno; `discipline_id` e `period` em `class_exams` |
| A-4 | migration 140 + `GradesTab.tsx`, `BoletimPage.tsx` | `GradesTab` dispara `calculate-grades` apos cada nota; `BoletimPage` exibe timestamp do ultimo calculo |

#### Sprint 9.8 — Consolidacao de Disciplinas ✅ (migration 141, 2026-04-17)

| Item | Arquivo | Resultado |
|------|---------|-----------|
| A-3 | migration 141 + `DiarioAdminPage.tsx` | `disciplines` eleita tabela canonica; `discipline_id` em `class_diary_entries`; tipo `ClassDiaryEntry` criado; `ProfessorAuthContext` expoe `subject_id` |
| A-5 | `DiarioEntradaPage.tsx`, `DiarioPage.tsx` | Busca disciplinas de `disciplines`; salva `discipline_id` + `subject_id`; auto-sugere disciplina com base em `class_schedules` do dia da semana |

#### Sprint UX-1 — Auditoria de Permissoes Frontend ✅ (commits 71b3868–9905df4, 2026-04-17)

Fechou 7 gaps de seguranca/UX no sistema de permissoes granulares do painel admin (sem migrations — mudancas puramente frontend):

| Item | Arquivos | Resultado |
|------|---------|-----------|
| Sub-tabs de SettingsPage gateadas | `SettingsPage.tsx` | 16 abas filtradas por `canView(requiredModule)`; primeiro tab permitido selecionado automaticamente; empty-state se nenhum for acessivel |
| Sub-tabs de FinancialPage gateadas | `FinancialPage.tsx` | 15 abas filtradas por modulo granular |
| Sub-tabs de GestaoPage, LojaPage, AcademicoPage, SecretariaPage | 4 arquivos | Cada aba filtrada por `canView(moduleKey)` |
| PermissionGate em acoes CRUD | `EnrollmentsPage`, `ContactsPage`, `ProdutosTab` | Botoes de criar/editar/excluir so aparecem para quem tem a permissao correspondente |
| Rotas granulares em routes.tsx | `routes.tsx` | `alunos/importar` exige `import`; `diario` exige `teacher-diary`; `provas` exige `teacher-exams` |
| AchadosPerdidosPage | `AchadosPerdidosPage.tsx` | Link de Configuracoes gateado por `can('settings','view')` |
| Padrão anyModuleKeys — menus umbrella | `umbrella-modules.ts`, `admin.types.ts`, `ModuleGuard.tsx`, `Sidebar.tsx`, `admin-navigation.ts`, `routes.tsx` | Menu e rota de umbrella (Configuracoes, Gestao, Academico, Loja, Secretaria, Financeiro) visiveis iff usuario tem `view` em ao menos uma sub-tab; closes bug em que professor via menu de Configuracoes sem nenhuma sub-permissao liberada |
| Hotfix ProtectedRoute | `ProtectedRoute.tsx` | Revertida chamada `usePermissions()` dentro de ProtectedRoute que quebrava `/admin` (PermissionsProvider vive dentro de AdminLayout, filho de ProtectedRoute) |

#### Sprint UX-2 — Breadcrumb URL Sync ✅ (commit 498b22c, 2026-04-17)

Corrigiu o breadcrumb do admin que nao exibia a sub-aba ativa ao navegar dentro das paginas umbrella (sem migrations):

| Item | Arquivos | Resultado |
|------|---------|-----------|
| SUB_TAB_LABELS incompleto | `AdminHeader.tsx` | Adicionadas entradas `loja` (5 abas) e `secretaria` (4 abas) ao mapa de rotulos |
| Paginas nao escreviam ?tab= na URL | `GestaoPage`, `SettingsPage`, `LojaPage`, `FinancialPage`, `AcademicoPage`, `SecretariaPage` | Clicar em aba chama `setSearchParams({ tab: key }, { replace: true })`; URL sempre reflete aba ativa |
| Paginas sem leitura de ?tab= no mount | `LojaPage`, `FinancialPage`, `AcademicoPage`, `SecretariaPage` | Importado `useSearchParams`; `initialTab` prioriza `?tab=` da URL (links diretos, favoritos, reload) |

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
| SKU | Codigo unico de produto por variacao (cor + tamanho); unidade minima de controle de estoque |
| PDV | Ponto de Venda; interface de atendimento presencial para vendas em balcao |
| Grade | Matriz de variacoes de produto (ex.: cor x tamanho); cada celula da matriz e um SKU |
| Protocolo de retirada | Documento gerado no momento da entrega, assinado pelo retirador; arquivado no historico do pedido |
| Sangria | Retirada de dinheiro do caixa durante o turno (reduz saldo; nao e venda) |
| Suprimento | Adicao de dinheiro ao caixa durante o turno (aumenta saldo; nao e receita) |
| Kit escolar | Conjunto de produtos (uniforme, material) sugerido por serie/segmento |

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
| `pedidos` | `#166534` (verde escuro) | Loja e PDV | ⏳ Fase 14 |
