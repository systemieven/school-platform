# PRD Complementar — ERP Escolar Completo
## Módulos: Financeiro · Acadêmico · Portal do Responsável · Secretaria · Pedagógico

> **Versão**: 1.0  
> **Data**: 13 de abril de 2026  
> **Complementa**: PRD v2.1 — `PRD_V2.md`  
> **Status**: Roadmap de desenvolvimento — fases 8 a 12  
> **Arquitetura base**: Multi-tenant upstream/client repos + Supabase + React + UazAPI

---

## Índice

1. [Contexto e Objetivo](#1-contexto-e-objetivo)
2. [Análise de Gaps vs. ERP Completo](#2-análise-de-gaps)
3. [Fase 8 — Módulo Financeiro](#3-fase-8--módulo-financeiro)
4. [Fase 9 — Acadêmico Completo](#4-fase-9--acadêmico-completo)
5. [Fase 10 — Portal do Responsável](#5-fase-10--portal-do-responsável)
6. [Fase 11 — Secretaria Digital](#6-fase-11--secretaria-digital)
7. [Fase 12 — Módulo Pedagógico](#7-fase-12--módulo-pedagógico)
8. [Schema do Banco de Dados — Adições](#8-schema-do-banco-de-dados--adições)
9. [Edge Functions — Novas](#9-edge-functions--novas)
10. [Rotas Novas](#10-rotas-novas)
11. [Cadeia WhatsApp por Módulo](#11-cadeia-whatsapp-por-módulo)
12. [Sequência de Migrations](#12-sequência-de-migrations)

---

## 1. Contexto e Objetivo

O PRD v2 cobre com profundidade o **pipeline de captação**: agendamentos, pré-matrículas, CRM, leads, atendimento presencial e comunicações WhatsApp. O site institucional é totalmente editável e a arquitetura multi-tenant está consolidada.

O que falta para a plataforma competir com ERPs educacionais maduros (iScholar, Sponte, Proesc) é a **camada de operação da escola após a matrícula ser confirmada**:

```
HOJE                              COMPLEMENTAR
─────────────────────             ────────────────────────────
Captação de leads         →       ✅ já existe
Pré-matrícula             →       ✅ já existe
Aluno confirmado          →       ❌ sem gestão financeira
                          →       ⚠️ acadêmico parcial
                          →       ❌ sem portal do responsável
                          →       ❌ sem secretaria digital
                          →       ❌ sem módulo pedagógico
```

Este documento descreve as **5 fases complementares** (8–12), o schema de banco, as integrações com módulos existentes e a cadeia de notificações WhatsApp para cada domínio.

---

## 2. Análise de Gaps

### O que já existe (PRD v2)

| Módulo | Status | Observação |
|--------|--------|------------|
| Dashboard analytics | ✅ | CRM/admissões focused |
| Agendamentos + visitas | ✅ | Completo |
| Pré-matrículas | ✅ | Pipeline 8 etapas |
| CRM / Leads Kanban | ✅ | Auto-criação via trigger |
| Atendimento presencial | ✅ | Fila + painel TV |
| WhatsApp (templates/log) | ✅ | Infraestrutura sólida |
| Segmentos + Turmas | ✅ | CRUD básico |
| Alunos (ficha) | ✅ | Criado da pré-matrícula |
| Área do Professor | ✅ | Atividades, notas, frequência, materiais |
| Portal do Aluno | ✅ | 8 rotas |
| Biblioteca Virtual | ✅ | |
| Comunicados + Eventos | ✅ | |
| Site institucional editável | ✅ | Config-driven |
| Permissões granulares | ✅ | Fase 6 |
| Audit logs | ✅ | Fase 6 |
| Multi-tenant | ✅ | Fase 7 |

### Gaps críticos identificados

| Módulo | Impacto | Fase |
|--------|---------|------|
| **Financeiro** (mensalidades, cobranças, inadimplência, BI) | 🔴 Crítico | 8 |
| **Disciplinas** CRUD + **Grade horária** | 🔴 Crítico | 9 |
| **Calendário letivo** (bimestres, provas, eventos) | 🔴 Crítico | 9 |
| **Boletim formal** (fórmula de média configurável) | 🔴 Crítico | 9 |
| **Resultado final** (aprovado/recuperação/reprovado) | 🔴 Crítico | 9 |
| **Histórico escolar** | 🟡 Alto | 9 |
| **Portal do Responsável** (login, acompanhamento, pagamentos) | 🔴 Crítico | 10 |
| **Ocorrências/Bilhetes** com notif. WhatsApp | 🟡 Alto | 10 |
| **Geração de declarações** (PDF automático) | 🟡 Alto | 11 |
| **Ficha de saúde** do aluno | 🟡 Alto | 11 |
| **Rematrícula online** | 🟡 Alto | 11 |
| **Plano de aula** / conteúdo ministrado | 🟢 Médio | 12 |
| **Relatórios pedagógicos** | 🟢 Médio | 12 |

---

## 3. Fase 8 — Módulo Financeiro

> **Objetivo**: Gerenciar mensalidades, cobranças, inadimplência e BI financeiro de forma integrada ao aluno já matriculado.

### 3.1 Visão Funcional

O módulo financeiro opera sobre o conceito de **contrato financeiro por aluno/ano letivo**. Cada aluno matriculado recebe um contrato com plano de pagamento, que gera automaticamente as parcelas do ano. A régua de cobrança via WhatsApp é o diferencial central.

```
Plano de Mensalidade
    └── Contrato do Aluno (por ano letivo)
            └── Parcelas geradas automaticamente (Jan–Dez)
                    ├── status: pending → paid / overdue / negotiated / cancelled
                    └── Regime de cobrança WhatsApp automático
```

### 3.2 Sub-módulos

#### 3.2.1 Planos de Mensalidade

**Rota**: `/admin/financeiro/planos`  
**Roles**: super_admin, admin

- CRUD de planos com: nome, valor base, número de parcelas (1–12), dia de vencimento padrão (1–28), desconto pontualidade (%), juros por atraso (% a.m.), multa (%)
- **Segmentos aplicáveis**: multi-select (Ed. Infantil, Fund. I etc.)
- **Vigência por ano letivo** (ex: plano "2026 — Fundamental I")
- **Clone de plano** para criar variações rapidamente

#### 3.2.2 Contratos Financeiros

**Rota**: `/admin/financeiro/contratos`  
**Roles**: super_admin, admin

- **Criação**: vincula aluno + plano + ano letivo + desconto individual
- **Desconto por contrato**: percentual ou valor fixo; com motivo (irmão, funcionário, bolsa social, convênio)
- **Geração automática de parcelas**: ao ativar o contrato, cria N registros em `financial_installments`
- **Reajuste em lote**: atualizar valor de contratos de um plano inteiro
- **Pipeline de status do contrato**: `draft` → `active` → `suspended` → `cancelled` → `concluded`
- **Timeline de alterações** por contrato

#### 3.2.3 Parcelas e Cobranças

**Rota**: `/admin/financeiro/cobrancas`  
**Roles**: super_admin, admin

- **Listagem com filtros**: mês/período, status, turma, segmento, busca por aluno
- **Status de parcela**: `pending`, `overdue`, `paid`, `negotiated`, `cancelled`, `renegotiated`
- **Registro de pagamento manual**: data, forma (dinheiro/PIX/cartão/transferência/boleto), valor pago, juros/desconto concedido, observação
- **Negociação de dívida**: parcelamento de atraso com novo vencimento
- **Ações em lote**: baixa em lote, gerar cobrança WhatsApp em lote
- **Cálculo automático** de: dias de atraso, juros acumulados, valor atualizado

> **Nota sobre gateway de pagamento**: A geração de boletos bancários e PIX dinâmico requer integração com gateway (ex: Asaas, Pagar.me, Efí/Gerencianet). Esta integração é configurável via `system_settings[financial.gateway]` e ativada como módulo opcional. Na ausência de gateway, o sistema opera com cobrança manual + registro de baixa. Ver seção 3.2.7.

#### 3.2.4 Dashboard Financeiro (BI)

**Rota**: `/admin/financeiro` (rota raiz do módulo)  
**Roles**: super_admin, admin

Métricas por período (mês atual, mês anterior, ano):

| Métrica | Cálculo |
|---------|---------|
| **Receita prevista** | Soma de parcelas `pending` + `paid` no período |
| **Receita realizada** | Soma de parcelas `paid` no período |
| **Inadimplência R$** | Soma de parcelas `overdue` |
| **Inadimplência %** | overdue / (overdue + paid) × 100 |
| **Ticket médio** | Receita realizada / qtd alunos ativos |
| **Alunos em dia** | Alunos sem parcela overdue |
| **Alunos inadimplentes** | Alunos com ≥1 parcela overdue |

Gráficos:
- Evolução mensal: previsto vs. realizado (linha 12 meses)
- Distribuição de inadimplência por turma/segmento (barras)
- Aging de inadimplência: 1–30d / 31–60d / 61–90d / +90d (pizza)
- Top 10 alunos inadimplentes

#### 3.2.5 Régua de Cobrança WhatsApp

**Configurada em**: `/admin/configuracoes` → aba Financeiro

A régua de cobrança é um conjunto de templates WhatsApp com **gatilhos temporais** relativos ao vencimento da parcela. Disparados automaticamente por `pg_cron` + trigger da Edge Function `auto-notify`.

| Gatilho | Timing | Template sugerido | Configurável |
|---------|--------|-------------------|:----------:|
| Aviso pré-vencimento | D-5 | "Olá {{nome}}, sua mensalidade de {{mes_referencia}} ({{valor}}) vence em 5 dias, em {{data_vencimento}}." | ✅ |
| Lembrete véspera | D-1 | "Amanhã vence sua mensalidade de {{mes_referencia}} ({{valor_atualizado}}). Pague pelo PIX: {{chave_pix}}" | ✅ |
| Dia do vencimento | D+0 | "Hoje é o vencimento da sua mensalidade de {{mes_referencia}} ({{valor}}). Regularize para evitar juros." | ✅ |
| Primeiro aviso atraso | D+3 | "Sua mensalidade de {{mes_referencia}} está em atraso há 3 dias. Valor atualizado: {{valor_atualizado}}. Entre em contato." | ✅ |
| Segundo aviso atraso | D+10 | "Aviso: mensalidade de {{mes_referencia}} com {{dias_atraso}} dias de atraso. Valor com juros: {{valor_atualizado}}." | ✅ |
| Último aviso | D+30 | "Prezado(a) {{responsavel}}, sua mensalidade de {{mes_referencia}} está há 30 dias em aberto..." | ✅ |

**Cada etapa é configurável**: ativar/desativar, alterar timing, selecionar template. Destinatário: responsável financeiro do aluno (`students.financial_guardian_phone`).

**Variáveis disponíveis para templates financeiros**:
`{{nome_aluno}}`, `{{responsavel}}`, `{{turma}}`, `{{mes_referencia}}`, `{{valor}}`, `{{valor_atualizado}}`, `{{data_vencimento}}`, `{{dias_atraso}}`, `{{chave_pix}}`, `{{link_boleto}}`

**Nova categoria WhatsApp**: `financeiro` (cor: verde escuro `#14532d`)

#### 3.2.6 Relatórios Financeiros

Adicionado ao módulo existente `/admin/relatorios`:

| Relatório | Filtros | Export |
|-----------|---------|--------|
| Extrato por aluno | aluno, período | PDF, CSV |
| Receita mensal | mês, turma, segmento | CSV, XLSX |
| Inadimplência detalhada | status, aging, turma | CSV, XLSX |
| Fluxo de caixa | período, forma de pagamento | CSV, XLSX |
| Projeção de receita | próximos N meses | CSV |
| Contratos por status | ano letivo, plano, segmento | CSV |

#### 3.2.7 Integração com Gateway de Pagamento (Módulo Opcional)

**Configurado em**: `/admin/configuracoes` → aba Financeiro → Gateway

Provedores suportados na V1 (via abstração):

| Provedor | Suporte | Notas |
|----------|---------|-------|
| **Asaas** | ✅ Prioridade | API REST, boleto + PIX dinâmico, webhook de confirmação |
| **Efí (Gerencianet)** | 🔜 V2 | |
| **Pagar.me** | 🔜 V2 | |

**Fluxo com Asaas**:
1. Ao criar/ativar contrato: `POST /api/asaas/customers` → cria cliente no Asaas
2. Para cada parcela: `POST /api/asaas/payments` → cria cobrança (boleto/PIX)
3. Webhook Asaas → Edge Function `asaas-webhook` → atualiza status da parcela automaticamente
4. Link de pagamento ou código PIX copiado nos templates WhatsApp

**Edge Function**: `asaas-proxy` (proxy autenticado, token em Supabase secrets)  
**Edge Function**: `asaas-webhook` (recebe confirmações, rate limited, valida webhook token)

### 3.3 Integração com Módulos Existentes

| Módulo existente | Integração |
|-----------------|------------|
| `students` | `financial_contracts.student_id` → visibilidade financeira na ficha do aluno |
| `school_classes` | Filtros de cobrança por turma |
| `enrollments` | Ao confirmar pré-matrícula → sugerir criação de contrato financeiro |
| `whatsapp_templates` | Nova categoria `financeiro`; régua usa `auto-notify` existente |
| `notifications` | Alerta interno: aluno inadimplente há +30d; receita abaixo de meta |
| `/admin` dashboard | Card "Inadimplência do mês" + "Receita realizada" |
| `audit_logs` | Todos os pagamentos registrados com usuário + IP |

### 3.4 Portal do Aluno — Financeiro (adição à Fase 8)

Nova aba no Portal do Aluno: **`/portal/financeiro`**

- Lista de parcelas: mês, valor, vencimento, status (visual claro: verde/vermelho/amarelo)
- Parcelas pagas: data de pagamento, valor pago
- Parcelas em aberto: valor atualizado com juros
- Botão "Ver boleto" / "Copiar PIX" (quando integrado com gateway)

---

## 4. Fase 9 — Acadêmico Completo

> **Objetivo**: Completar o módulo acadêmico com disciplinas, grade horária, calendário letivo, boletim formal com fórmula configurável, resultado final e histórico escolar.

### 4.1 Disciplinas

**Rota**: `/admin/disciplinas`  
**Roles**: super_admin, admin, coordinator

- **CRUD** de disciplinas: nome, código (ex: MAT, PORT), carga horária semanal (horas), cor de identificação, ativo/inativo
- **Associação por segmento**: quais disciplinas fazem parte de qual segmento
- **Atribuição a turmas**: disciplina + turma + professor responsável (tabela `class_disciplines`)
- Disciplina é a unidade base para: notas, frequência, grade horária, plano de aula

> **Integração com existente**: a tabela `activities` já tem `subject` (varchar livre). Com este módulo, `activities.discipline_id` passa a ser FK para `disciplines`. Migration inclui atualização dos registros existentes.

### 4.2 Grade Horária

**Rota**: `/admin/grade-horaria`  
**Roles**: super_admin, admin, coordinator

- **Cadastro por turma**: dia da semana (seg–sex), horário início/fim, disciplina, professor
- **Visualização em grade**: tabela dia × horário com células coloridas por disciplina
- **Conflito de professor**: alerta ao atribuir professor já ocupado no mesmo slot
- **Export PDF**: grade da turma (para distribuição)
- **Portal do Aluno e Responsável**: visualização da grade horária pessoal em `/portal/grade`

### 4.3 Calendário Letivo

**Rota**: `/admin/calendario`  
**Roles**: super_admin, admin, coordinator

- **Períodos letivos configuráveis**: bimestres / trimestres / semestres (toggle em configurações)
  - Ex: Bimestre 1 (01/02–30/04), Bimestre 2 (02/05–31/07), etc.
- **Tipos de evento no calendário**:
  - `holiday` — feriado (bloqueia frequência)
  - `exam_period` — período de provas
  - `recess` — recesso escolar
  - `event` — evento institucional (integra com `school_events`)
  - `deadline` — prazo administrativo (entrega de notas, fechamento de período)
- **Visão mensal e anual** com cores por tipo
- **Sincronização**: feriados do calendário letivo substituem `visit.holidays` em `system_settings`
- **Portal**: alunos/responsáveis visualizam o calendário

### 4.4 Boletim Formal e Fórmula de Média

**Configurado em**: `/admin/configuracoes` → aba Acadêmico

#### Fórmula de média configurável por segmento

| Tipo | Configuração | Exemplo |
|------|-------------|---------|
| **Simples** | Média aritmética de N avaliações | (P1 + P2 + P3) / 3 |
| **Ponderada** | Pesos por tipo de avaliação | (P1×2 + P2×3 + P3×5) / 10 |
| **Por bimestre** | Média de notas do período → média final | (B1 + B2 + B3 + B4) / 4 |
| **Customizada** | Fórmula livre com variáveis | Definida pelo admin |

**Configurações por segmento**:
- Nota mínima de aprovação (ex: 6.0)
- Nota mínima para recuperação (ex: 4.0)
- Frequência mínima para aprovação (ex: 75%)
- Casas decimais no boletim (1 ou 2)
- Escala: numérica (0–10) ou conceitual (A/B/C/D)

#### Resultado Final

Calculado automaticamente ao fechar o período letivo:

```
média_final >= nota_aprovação → APROVADO
nota_recuperação <= média_final < nota_aprovação → RECUPERAÇÃO
média_final < nota_recuperação → REPROVADO (por nota)
frequência < frequência_mínima → REPROVADO (por falta)
```

**Registro em**: `student_results` (por aluno × ano letivo × disciplina)

### 4.5 Boletim e Relatório de Notas

**Admin**: `/admin/boletim`  
**Portal do Aluno**: `/portal/notas` (já existe — enriquecido)

#### Admin
- Visão por turma: grade de notas (alunos × disciplinas × períodos)
- Edição inline de notas
- Fechamento de período: cálculo de médias e resultado final
- Geração de boletim PDF por aluno (individual) ou por turma (lote)
- Exportação XLSX: turma completa

#### Enriquecimento do Portal
- Boletim com médias por período e média final
- Indicador visual: verde (aprovado), amarelo (recuperação), vermelho (reprovado)
- Histórico de notas por bimestre

### 4.6 Frequência — Alertas e Relatórios

**Complementa**: área do professor já registra frequência por dia

Adições:

- **Cálculo de % de frequência**: por disciplina, por período, por ano letivo
- **Alerta automático de faltas via WhatsApp** ao responsável:
  - Configurável: disparar ao atingir X% de faltas acumuladas (ex: ao atingir 15%, 20%, 25%)
  - Template da categoria `academico`
- **Relatório de frequência**: por aluno, turma, disciplina
- **Admin**: painel de alunos em risco (abaixo de 75% de presença)

### 4.7 Histórico Escolar

**Rota**: `/admin/alunos/:id/historico`  
**Roles**: super_admin, admin, coordinator

- Registro automático ao fechar o ano letivo: aluno, turma, disciplinas, médias finais, resultado, frequência
- Visualização como histórico escolar formal
- Exportação PDF (declaração de histórico escolar)
- Integração com `student_transcripts`

### 4.8 Integração com Módulos Existentes

| Módulo | Integração |
|--------|-----------|
| `activities` | `discipline_id` → FK para `disciplines` |
| `grades` | Conecta ao período letivo + fórmula de média |
| `attendance` | Conecta ao calendário letivo + cálculo de % |
| `school_classes` | Adiciona `class_disciplines[]` como entidade |
| `students` | `student_results` + `student_transcripts` |
| Portal do Aluno | Grade horária + calendário + boletim enriquecido |
| `announcements` | Comunicados de fechamento de período / resultado |
| `school_events` | Integração com calendário letivo |

---

## 5. Fase 10 — Portal do Responsável

> **Objetivo**: Criar um portal dedicado ao responsável (pai/mãe/guardião), com autenticação própria, acompanhamento completo do filho e canal de comunicação escola-família.

### 5.1 Autenticação do Responsável

**Rota de login**: `/responsavel/login`

- **Credenciais**: CPF do responsável + código de acesso (gerado pela secretaria ou enviado via WhatsApp)
- **E-mail fictício**: `{cpf}@responsavel.{school_slug}.com.br` (mesmo padrão do Portal do Aluno)
- **Contexto React isolado**: `GuardianAuthContext` com `GuardianProtectedRoute`
- **Múltiplos filhos**: um responsável pode ter vários filhos no sistema; seletor de filho ativo no topo
- **Primeiro acesso**: CPF + matrícula do filho → definir senha
- **Senha temporária**: gerada pelo admin, enviada via WhatsApp

**Edge Function**: `create-guardian-user` (análoga ao `create-admin-user`)

### 5.2 Dashboard do Responsável

**Rota**: `/responsavel`

Cards de resumo por filho selecionado:
- Próximas atividades (com data de entrega)
- Últimas notas lançadas
- Faltas desta semana
- Parcelas em aberto (com valor)
- Comunicados não lidos
- Próximos eventos

### 5.3 Páginas do Portal do Responsável

| Rota | Página | Descrição |
|------|--------|-----------|
| `/responsavel` | Dashboard | Resumo por filho |
| `/responsavel/notas` | Boletim | Notas + médias + resultado por disciplina |
| `/responsavel/frequencia` | Frequência | Presenças/faltas por dia e disciplina + % |
| `/responsavel/financeiro` | Financeiro | Parcelas, boletos, histórico de pagamentos |
| `/responsavel/comunicados` | Comunicados | Todos os comunicados do filho |
| `/responsavel/eventos` | Eventos | Com RSVP (confirmar presença do filho) |
| `/responsavel/grade` | Grade Horária | Horário semanal de aulas |
| `/responsavel/ocorrencias` | Ocorrências | Bilhetes enviados pela escola + respostas |
| `/responsavel/biblioteca` | Biblioteca | Materiais da turma |
| `/responsavel/perfil` | Perfil | Dados pessoais, troca de senha, dados do filho |

### 5.4 Módulo de Ocorrências / Bilhetes

> Substitui o simples campo de ocorrências já existente na ficha do aluno. Cria um canal estruturado de comunicação escola-família.

**Admin**: `/admin/ocorrencias`  
**Portal do Responsável**: `/responsavel/ocorrencias`

#### Fluxo

```
Escola (professor/coordenador) cria ocorrência
  → Notificação WhatsApp automática para responsável
  → Responsável visualiza no portal
  → Responsável pode responder (texto)
  → Escola recebe notificação interna
  → Status: open → read → resolved
```

#### Tipos de Ocorrência

| Tipo | Ícone | Cor | Gravidade |
|------|-------|-----|-----------|
| `behavioral` | ⚠️ | Laranja | Alta |
| `academic` | 📚 | Azul | Média |
| `health` | 🏥 | Vermelho | Alta |
| `administrative` | 📋 | Cinza | Baixa |
| `commendation` | ⭐ | Verde | — |
| `absence_justification` | 📅 | Roxo | Baixa |

#### Funcionalidades Admin

- **Criação**: selecionar aluno, tipo, gravidade, descrição, evidências (anexo)
- **Visibilidade**: `visible_to_guardian` toggle
- **Resposta**: admin pode responder à resposta do responsável
- **Filtros**: turma, tipo, status, período
- **Relatório de ocorrências**: por aluno, turma, tipo

#### Notificação WhatsApp (nova categoria `ocorrencia`)

Template automático ao criar ocorrência:
> "Prezado(a) {{responsavel}}, o(a) aluno(a) {{nome_aluno}} ({{turma}}) recebeu um registro escolar do tipo {{tipo}}. Acesse o portal para visualizar e responder: {{link_portal}}"

### 5.5 Autorização de Atividades

**Admin**: `/admin/autorizacoes`  
**Portal do Responsável**: `/responsavel/autorizacoes`

- **Criação pelo admin**: título, descrição, evento vinculado (opcional), prazo de resposta
- **Opções de resposta**: Autorizo / Não autorizo / (campo livre opcional)
- **Notificação WhatsApp** ao responsável com link direto para autorizar
- **Status**: `pending` → `authorized` / `not_authorized` / `expired`
- **Relatório**: quantos autorizaram por atividade

### 5.6 Integração com Módulos Existentes

| Módulo | Integração |
|--------|-----------|
| `students` | `financial_guardian_phone`, `guardian_cpf` → auth do responsável |
| `enrollments` | Dados do responsável já capturados (nome, CPF, telefone) |
| `financial_installments` | Visíveis no portal do responsável |
| `grades`, `attendance` | Leitura no portal |
| `announcements`, `events` | Filtrados por filho (turma/segmento) |
| `whatsapp_templates` | Novas categorias `responsavel`, `ocorrencia`, `autorizacao` |
| `school_events` + RSVP | Responsável confirma presença pelo portal |

---

## 6. Fase 11 — Secretaria Digital

> **Objetivo**: Automatizar os processos de secretaria: geração de declarações, rematrícula online, ficha de saúde e transferências.

### 6.1 Geração de Declarações

**Admin**: `/admin/secretaria/declaracoes`  
**Portal do Responsável**: `/responsavel/declaracoes`

#### Templates de declaração (configuráveis)

| Declaração | Variáveis | Gerado em |
|------------|-----------|-----------|
| **Declaração de Matrícula** | nome, turma, ano letivo, segmento, data | PDF |
| **Declaração de Frequência** | nome, turma, % presença no período | PDF |
| **Declaração de Transferência** | nome, turma, situação, notas, data | PDF |
| **Histórico Escolar** | anos cursados, disciplinas, médias, resultado | PDF |
| **Declaração de Conclusão** | nome, série, data, notas finais | PDF |

**Fluxo**:
1. Admin cria template com editor de texto rico + variáveis `{{variavel}}`
2. Responsável solicita declaração no portal → vai para fila de aprovação
3. Admin aprova (ou assina digitalmente) → PDF gerado
4. Notificação WhatsApp com link para download (Supabase Storage, signed URL)

**Edge Function**: `generate-document` — renderiza template HTML → PDF via Puppeteer ou jsPDF

**Tabelas**: `document_templates`, `document_requests`, `generated_documents`

### 6.2 Ficha de Saúde

**Admin**: `/admin/alunos/:id` → aba "Saúde"  
**Roles**: super_admin, admin, coordinator

Campos da ficha de saúde:

| Categoria | Campos |
|-----------|--------|
| **Alergias** | Lista de alergias (alimentar, medicamentosa, ambiental) com nível de gravidade |
| **Medicamentos** | Nome, dosagem, horário, prescrição médica (upload) |
| **Necessidades especiais** | Tipo (física, cognitiva, sensorial), descrição, adaptações necessárias |
| **Informações médicas** | Tipo sanguíneo, condições crônicas, deficiências |
| **Contato de emergência** | Nome, parentesco, telefone (diferente do responsável principal) |
| **Convênio médico** | Plano de saúde, número da carteirinha |
| **Observações gerais** | Campo livre para a equipe |

- **RLS**: visível apenas para admin/coordinator — **nunca** para o aluno no portal
- **Alerta no atendimento**: se aluno tem alergia grave, flag visível na ficha de atendimento presencial
- **Export**: PDF da ficha de saúde (para arquivamento físico ou enfermaria)

**Tabela**: `student_health_records`

### 6.3 Rematrícula Online

**Admin**: `/admin/rematricula`  
**Portal do Responsável**: `/responsavel/rematricula`

#### Fluxo de Rematrícula

```
1. Admin abre campanha de rematrícula (ano letivo alvo, datas, desconto antecipado)
2. Notificação WhatsApp automática para responsáveis de alunos elegíveis
3. Responsável acessa portal → confirma dados → aceita plano → assina digitalmente
4. Admin recebe notificação → revisa → confirma rematrícula
5. Contrato financeiro do novo ano letivo é gerado automaticamente
```

**Configuração da campanha** (em `/admin/configuracoes` → Rematrícula):
- Período de abertura/fechamento
- Desconto por antecipação (% por período)
- Plano de mensalidade padrão para o novo ano
- Documentos a atualizar (se houver)
- Texto personalizado para a notificação WhatsApp

**Status do processo por aluno**:
`not_started` → `notified` → `in_progress` → `pending_signature` → `completed` → `cancelled`

**Tabelas**: `reenrollment_campaigns`, `reenrollment_applications`

### 6.4 Transferências e Movimentações

**Admin**: `/admin/secretaria/transferencias`  
**Roles**: super_admin, admin, coordinator

| Tipo | Descrição |
|------|-----------|
| **Transferência interna** | Mudar aluno de turma dentro da escola |
| **Saída / Transferência externa** | Aluno deixa a escola (com declaração de transferência) |
| **Trancamento** | Suspensão temporária da matrícula |
| **Cancelamento** | Cancelamento definitivo |

**Fluxo de saída**:
1. Registrar motivo + data + escola de destino (opcional)
2. Gerar declaração de transferência
3. Marcar contrato financeiro como encerrado
4. Aluno inativo no sistema (mantido para histórico)
5. Notificação WhatsApp de confirmação ao responsável

**Impacto no financeiro**: parcelas futuras após a data de saída → status `cancelled`

### 6.5 Integração com Módulos Existentes

| Módulo | Integração |
|--------|-----------|
| `students` | `health_records`, status de transferência |
| `financial_contracts` | Gerado após rematrícula confirmada |
| `enrollments` | Rematrícula cria novo registro com `origin: rematricula` |
| `document_templates` | Novo tipo de template + geração via Edge Function |
| `whatsapp_templates` | Nova categoria `secretaria` |
| Audit logs | Toda ação de secretaria registrada |

---

## 7. Fase 12 — Módulo Pedagógico

> **Objetivo**: Dotar professores e coordenadores de ferramentas para planejamento, registro de conteúdo e análise pedagógica.

### 7.1 Plano de Aula

**Rota**: `/admin/area-professor` → aba "Diário"  
**Roles**: teacher, coordinator, admin

O diário é o coração do módulo pedagógico. Cada aula registrada conecta:

```
Data da aula
  └── Turma + Disciplina
        ├── Conteúdo ministrado (o que foi ensinado)
        ├── Objetivos de aprendizagem atingidos
        ├── Metodologia utilizada
        ├── Recursos utilizados (link para `library_resources`)
        ├── Atividades vinculadas (link para `activities`)
        ├── Observações da turma
        └── Frequência dos alunos (integra com `attendance`)
```

**Funcionalidades**:
- Registro rápido via formulário pré-estruturado
- Planejamento antecipado: preencher antes da aula, confirmar depois
- Status: `planned` → `completed` | `cancelled`
- Visualização em calendário semanal/mensal por disciplina
- **Cobertura do plano**: % de aulas planejadas realizadas (por turma/disciplina)

**Tabela**: `lesson_plans`

### 7.2 Objetivos de Aprendizagem

**Admin**: `/admin/objetivos`  
**Roles**: super_admin, admin, coordinator

- **CRUD** de objetivos por disciplina + série/segmento
- Campo opcional de referência BNCC (código da habilidade, ex: EF06MA01)
- Associação ao plano de aula: professor indica quais objetivos foram trabalhados
- **Relatório de cobertura**: quais objetivos foram trabalhados vs. planejados no período

**Tabelas**: `learning_objectives`, `lesson_plan_objectives` (N:N)

### 7.3 Relatórios Pedagógicos

**Rota**: `/admin/relatorios` → aba "Pedagógico"

| Relatório | Destinatário | Descrição |
|-----------|-------------|-----------|
| **Desempenho por turma** | Coordenador | Média geral + distribuição de notas por disciplina |
| **Alunos em risco** | Coordenador | Abaixo da média + frequência crítica |
| **Cobertura do currículo** | Coordenador | % do conteúdo planejado ministrado por professor |
| **Evolução individual** | Professor | Curva de notas do aluno ao longo do ano |
| **Análise comparativa** | Admin | Desempenho entre turmas do mesmo segmento |
| **Aulas registradas** | Admin | Assiduidade dos professores no diário |

### 7.4 Integração com Módulos Existentes

| Módulo | Integração |
|--------|-----------|
| `activities` | Vinculadas ao plano de aula |
| `attendance` | Registrada junto com o diário |
| `grades` | Métricas pedagógicas nos relatórios |
| `library_resources` | Recursos utilizados na aula |
| Portal do Aluno | Conteúdo da aula visível em `/portal/diario` (o que foi ensinado) |

---

## 8. Schema do Banco de Dados — Adições

### 8.1 Módulo Financeiro (Migration 28)

```sql
-- Planos de mensalidade
CREATE TABLE financial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 12,
  due_day INTEGER NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  punctuality_discount_pct NUMERIC(5,2) DEFAULT 0,
  late_fee_pct NUMERIC(5,2) DEFAULT 2,
  interest_rate_pct NUMERIC(5,2) DEFAULT 0.033, -- ao dia
  segment_ids UUID[],
  school_year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos financeiros por aluno
CREATE TABLE financial_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  plan_id UUID NOT NULL REFERENCES financial_plans(id),
  school_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','cancelled','concluded')),
  discount_type TEXT CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_reason TEXT,
  net_amount NUMERIC(10,2) NOT NULL, -- valor final após desconto
  payment_method TEXT DEFAULT 'boleto' CHECK (payment_method IN ('boleto','pix','card','cash','transfer')),
  gateway_customer_id TEXT, -- ID no Asaas/gateway
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, school_year)
);

-- Parcelas individuais
CREATE TABLE financial_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES financial_contracts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  installment_number INTEGER NOT NULL, -- 1..12
  reference_month TEXT NOT NULL, -- '2026-01'
  due_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','negotiated','cancelled','renegotiated')),
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(10,2),
  payment_method TEXT,
  late_fee_amount NUMERIC(10,2) DEFAULT 0,
  discount_granted NUMERIC(10,2) DEFAULT 0,
  days_overdue INTEGER GENERATED ALWAYS AS (
    CASE WHEN status = 'overdue' THEN EXTRACT(DAY FROM NOW() - due_date)::INTEGER ELSE 0 END
  ) STORED,
  gateway_payment_id TEXT,
  boleto_url TEXT,
  pix_code TEXT,
  notes TEXT,
  registered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de notificações financeiras (régua de cobrança)
CREATE TABLE financial_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES financial_installments(id),
  trigger_type TEXT NOT NULL, -- 'D-5','D-1','D+0','D+3','D+10','D+30'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_message_id UUID REFERENCES whatsapp_message_log(id),
  status TEXT DEFAULT 'sent'
);

-- Índices
CREATE INDEX idx_installments_student ON financial_installments(student_id);
CREATE INDEX idx_installments_status ON financial_installments(status);
CREATE INDEX idx_installments_due_date ON financial_installments(due_date);
CREATE INDEX idx_installments_contract ON financial_installments(contract_id);
```

### 8.2 Módulo Acadêmico (Migrations 29–31)

```sql
-- Disciplinas (Migration 29)
CREATE TABLE disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT, -- MAT, PORT, HIS...
  weekly_hours NUMERIC(4,1) DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  segment_ids UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disciplinas por turma + professor
CREATE TABLE class_disciplines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES disciplines(id),
  teacher_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, discipline_id)
);

-- Grade horária (Migration 29)
CREATE TABLE class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  discipline_id UUID NOT NULL REFERENCES disciplines(id),
  teacher_id UUID REFERENCES profiles(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=seg
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendário letivo (Migration 30)
CREATE TABLE school_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('holiday','exam_period','recess','deadline','institutional','period_start','period_end')),
  start_date DATE NOT NULL,
  end_date DATE,
  school_year INTEGER NOT NULL,
  period_number INTEGER, -- bimestre/trimestre (1..4)
  segment_ids UUID[], -- null = todos
  color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fórmula de média por segmento (Migration 30)
CREATE TABLE grade_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES school_segments(id),
  formula_type TEXT NOT NULL DEFAULT 'simple'
    CHECK (formula_type IN ('simple','weighted','by_period','custom')),
  config JSONB NOT NULL DEFAULT '{}',
  -- ex: {"weights": {"prova": 0.5, "trabalho": 0.3, "participacao": 0.2}}
  passing_grade NUMERIC(4,2) DEFAULT 6.0,
  recovery_grade NUMERIC(4,2) DEFAULT 4.0,
  min_attendance_pct NUMERIC(5,2) DEFAULT 75.0,
  decimal_places INTEGER DEFAULT 1,
  grade_scale TEXT DEFAULT 'numeric' CHECK (grade_scale IN ('numeric','conceptual')),
  school_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(segment_id, school_year)
);

-- Resultado final do aluno por disciplina/ano (Migration 31)
CREATE TABLE student_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  discipline_id UUID NOT NULL REFERENCES disciplines(id),
  class_id UUID NOT NULL REFERENCES school_classes(id),
  school_year INTEGER NOT NULL,
  period1_avg NUMERIC(5,2),
  period2_avg NUMERIC(5,2),
  period3_avg NUMERIC(5,2),
  period4_avg NUMERIC(5,2),
  recovery_grade NUMERIC(5,2),
  final_avg NUMERIC(5,2),
  attendance_pct NUMERIC(5,2),
  result TEXT CHECK (result IN ('approved','recovery','failed_grade','failed_attendance','in_progress')),
  calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, discipline_id, school_year)
);

-- Histórico escolar
CREATE TABLE student_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  school_year INTEGER NOT NULL,
  class_id UUID REFERENCES school_classes(id),
  segment_id UUID REFERENCES school_segments(id),
  final_result TEXT CHECK (final_result IN ('approved','failed','transferred','cancelled')),
  closed_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.3 Portal do Responsável (Migration 32)

```sql
-- Auth do responsável (senha gerenciada pelo Supabase Auth)
-- Credencial principal: CPF vinculado ao responsável da matrícula

-- Sessões / perfis de responsável
CREATE TABLE guardian_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  cpf TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  student_ids UUID[] NOT NULL, -- filhos vinculados
  is_active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_guardian_cpf ON guardian_profiles(cpf);

-- Ocorrências / bilhetes
CREATE TABLE student_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  class_id UUID REFERENCES school_classes(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('behavioral','academic','health','administrative','commendation','absence_justification')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  visible_to_guardian BOOLEAN DEFAULT TRUE,
  guardian_response TEXT,
  guardian_responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','read','resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Autorizações de atividades
CREATE TABLE activity_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_id UUID REFERENCES school_events(id),
  deadline DATE NOT NULL,
  target_class_ids UUID[],
  target_segment_ids UUID[],
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE authorization_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL REFERENCES activity_authorizations(id),
  student_id UUID NOT NULL REFERENCES students(id),
  guardian_id UUID NOT NULL REFERENCES guardian_profiles(id),
  response TEXT CHECK (response IN ('authorized','not_authorized')),
  notes TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(authorization_id, student_id)
);
```

### 8.4 Secretaria Digital (Migration 33)

```sql
-- Templates de declaração
CREATE TABLE document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('enrollment','frequency','transfer','transcript','graduation','custom')),
  html_content TEXT NOT NULL, -- HTML com {{variáveis}}
  variables JSONB DEFAULT '[]', -- variáveis disponíveis
  is_active BOOLEAN DEFAULT TRUE,
  requires_signature BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações e documentos gerados
CREATE TABLE document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  template_id UUID NOT NULL REFERENCES document_templates(id),
  requested_by UUID, -- pode ser guardian_profiles.id
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','generated','delivered','rejected')),
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  file_url TEXT, -- Supabase Storage signed URL
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ficha de saúde
CREATE TABLE student_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  blood_type TEXT,
  allergies JSONB DEFAULT '[]',
  -- [{type: 'food', name: 'amendoim', severity: 'critical'}]
  medications JSONB DEFAULT '[]',
  -- [{name: 'Ritalina', dosage: '10mg', schedule: '08:00', prescription_url: '...'}]
  special_needs JSONB DEFAULT '[]',
  -- [{type: 'cognitive', description: '...', adaptations: '...'}]
  chronic_conditions TEXT,
  health_insurance TEXT,
  health_insurance_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone TEXT,
  notes TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Campanhas de rematrícula
CREATE TABLE reenrollment_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  school_year INTEGER NOT NULL, -- ano alvo
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  early_discount_pct NUMERIC(5,2) DEFAULT 0,
  early_discount_deadline DATE,
  default_plan_id UUID REFERENCES financial_plans(id),
  message_template TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reenrollment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES reenrollment_campaigns(id),
  student_id UUID NOT NULL REFERENCES students(id),
  status TEXT DEFAULT 'not_started'
    CHECK (status IN ('not_started','notified','in_progress','pending_signature','completed','cancelled')),
  plan_id UUID REFERENCES financial_plans(id),
  signed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, student_id)
);
```

### 8.5 Módulo Pedagógico (Migration 34)

```sql
-- Plano de aula / diário de classe
CREATE TABLE lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES school_classes(id),
  discipline_id UUID NOT NULL REFERENCES disciplines(id),
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  lesson_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned','completed','cancelled')),
  content_taught TEXT,        -- conteúdo ministrado
  methodology TEXT,           -- metodologia utilizada
  resources_used JSONB DEFAULT '[]', -- [{library_resource_id, title, url}]
  activities_linked UUID[],   -- activity IDs vinculados
  observations TEXT,          -- observações da turma
  school_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Objetivos de aprendizagem
CREATE TABLE learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id UUID NOT NULL REFERENCES disciplines(id),
  segment_id UUID NOT NULL REFERENCES school_segments(id),
  school_year INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  bncc_code TEXT, -- EF06MA01 (opcional)
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- N:N plano de aula × objetivos
CREATE TABLE lesson_plan_objectives (
  lesson_plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES learning_objectives(id),
  PRIMARY KEY (lesson_plan_id, objective_id)
);

CREATE INDEX idx_lesson_plans_class ON lesson_plans(class_id);
CREATE INDEX idx_lesson_plans_teacher ON lesson_plans(teacher_id);
CREATE INDEX idx_lesson_plans_date ON lesson_plans(lesson_date);
```

---

## 9. Edge Functions — Novas

| Função | Auth | Descrição |
|--------|------|-----------|
| `financial-notify` | Trigger secret | Disparado por pg_cron; itera parcelas `overdue`/`pending` por timing; renderiza templates financeiros; envia via `uazapi-proxy` |
| `generate-document` | JWT (admin+) | Renderiza template HTML com variáveis → gera PDF; salva em Storage; retorna signed URL |
| `asaas-proxy` | JWT (admin+) | Proxy autenticado para API Asaas; token em secrets; abstrai boleto/PIX/webhook |
| `asaas-webhook` | Secret URL param | Recebe confirmações de pagamento Asaas; atualiza `financial_installments.status`; dispara notificação |
| `create-guardian-user` | JWT (super_admin) | Cria usuário Supabase Auth para responsável + `guardian_profiles`; gera senha temporária |
| `calculate-grades` | JWT (admin+) | Calcula médias e resultado final por turma/período usando a `grade_formula` do segmento |
| `occurrence-notify` | Trigger secret | Disparado ao inserir em `student_occurrences`; envia WhatsApp ao responsável do aluno |

---

## 10. Rotas Novas

### Admin (16 novas rotas)

| Rota | Módulo | Roles |
|------|--------|-------|
| `/admin/financeiro` | Dashboard Financeiro | admin+ |
| `/admin/financeiro/planos` | Planos de Mensalidade | admin |
| `/admin/financeiro/contratos` | Contratos | admin+ |
| `/admin/financeiro/cobrancas` | Parcelas / Cobranças | admin+ |
| `/admin/disciplinas` | Disciplinas | admin+ |
| `/admin/grade-horaria` | Grade Horária | admin+ |
| `/admin/calendario` | Calendário Letivo | admin+ |
| `/admin/boletim` | Boletim Formal | admin+ |
| `/admin/ocorrencias` | Ocorrências | admin+, teacher |
| `/admin/autorizacoes` | Autorizações | admin+ |
| `/admin/secretaria/declaracoes` | Declarações | admin+ |
| `/admin/secretaria/saude` | Fichas de Saúde | admin+ |
| `/admin/rematricula` | Campanhas de Rematrícula | admin |
| `/admin/secretaria/transferencias` | Transferências | admin+ |
| `/admin/diario` | Diário / Plano de Aula | admin+, teacher |
| `/admin/objetivos` | Objetivos de Aprendizagem | admin+, coordinator |

### Portal do Responsável (10 novas rotas)

| Rota | Página |
|------|--------|
| `/responsavel/login` | Login |
| `/responsavel` | Dashboard |
| `/responsavel/notas` | Boletim |
| `/responsavel/frequencia` | Frequência |
| `/responsavel/financeiro` | Financeiro |
| `/responsavel/comunicados` | Comunicados |
| `/responsavel/eventos` | Eventos + RSVP |
| `/responsavel/grade` | Grade Horária |
| `/responsavel/ocorrencias` | Ocorrências |
| `/responsavel/autorizacoes` | Autorizações |
| `/responsavel/declaracoes` | Solicitação de Declarações |
| `/responsavel/rematricula` | Rematrícula Online |
| `/responsavel/perfil` | Perfil |

### Portal do Aluno (2 novas rotas)

| Rota | Página |
|------|--------|
| `/portal/financeiro` | Parcelas e pagamentos |
| `/portal/grade` | Grade horária |
| `/portal/diario` | Conteúdo das aulas (read-only) |

---

## 11. Cadeia WhatsApp por Módulo

### 11.1 Novas Categorias de Template

| Categoria | Cor | Módulo |
|-----------|-----|--------|
| `financeiro` | `#14532d` (verde escuro) | Cobranças, inadimplência |
| `academico` | `#1e3a5f` (azul escuro) | Notas, faltas, resultado |
| `ocorrencia` | `#7c2d12` (vermelho escuro) | Bilhetes/ocorrências |
| `responsavel` | `#4c1d95` (roxo) | Portal do responsável |
| `secretaria` | `#374151` (cinza) | Declarações, rematrícula |

### 11.2 Régua Financeira Completa

```
Parcela vence em 5 dias → Template D-5 (aviso pré-vencimento)
Parcela vence amanhã   → Template D-1 (último aviso + PIX/boleto)
Parcela vence hoje     → Template D+0 (vencimento)
3 dias de atraso       → Template D+3 (primeiro aviso atraso)
10 dias de atraso      → Template D+10 (segundo aviso + valor atualizado)
30 dias de atraso      → Template D+30 (aviso final)
Pagamento confirmado   → Template "pagamento-confirmado" (confirmação)
```

### 11.3 Cadeia Acadêmica

| Evento | Template | Gatilho |
|--------|---------|---------|
| Nota lançada (abaixo da média) | `nota-baixa` | `on_status_change` em `grades` |
| X% de faltas atingido | `alerta-faltas` | Cron diário + trigger |
| Resultado final disponível | `resultado-final` | ao fechar o período letivo |
| Nova atividade criada | `nova-atividade` | `on_create` em `activities` |
| Atividade próxima do prazo | `prazo-atividade` | Cron: D-2 antes do `due_date` |

### 11.4 Ocorrências e Autorizações

| Evento | Destinatário | Template |
|--------|-------------|---------|
| Nova ocorrência criada | Responsável | `nova-ocorrencia` |
| Escola respondeu à resposta | Responsável | `ocorrencia-atualizada` |
| Autorização solicitada | Responsável | `nova-autorizacao` |
| Prazo de autorização próximo (D-1) | Responsável | `autorizacao-prazo` |

### 11.5 Secretaria / Rematrícula

| Evento | Destinatário | Template |
|--------|-------------|---------|
| Campanha de rematrícula aberta | Responsáveis elegíveis | `rematricula-aberta` |
| Prazo de rematrícula em 7 dias | Não rematriculados | `rematricula-prazo` |
| Rematrícula confirmada | Responsável | `rematricula-confirmada` |
| Declaração pronta para download | Responsável | `declaracao-pronta` |
| Senha temporária do portal | Responsável | `senha-portal-responsavel` (categoria: `responsavel`) |

---

## 12. Sequência de Migrations

| Migration | Nome | Módulo | Fase |
|-----------|------|--------|------|
| 28 | `financial_module` | Financeiro | 8 |
| 29 | `disciplines_and_schedule` | Acadêmico | 9 |
| 30 | `school_calendar_and_formulas` | Acadêmico | 9 |
| 31 | `student_results_and_transcripts` | Acadêmico | 9 |
| 32 | `guardian_portal` | Portal Responsável | 10 |
| 33 | `secretaria_digital` | Secretaria | 11 |
| 34 | `pedagogico_module` | Pedagógico | 12 |

---

## Apêndice A — Priorização e Estimativa de Esforço

| Fase | Módulo | Complexidade | Valor de negócio | Recomendação |
|------|--------|:------------:|:----------------:|:------------:|
| **8** | Financeiro | 🔴 Alta | 🔴 Crítico | **Desenvolver primeiro** |
| **9** | Acadêmico completo | 🟡 Média | 🔴 Crítico | **Em paralelo com Fase 8** |
| **10** | Portal do Responsável | 🟡 Média | 🔴 Crítico | Após 8+9 |
| **11** | Secretaria Digital | 🟢 Baixa | 🟡 Alto | Após 10 |
| **12** | Pedagógico | 🟡 Média | 🟢 Médio | Última fase |

### Prioridade de desenvolvimento dentro da Fase 8

1. Schema + migrations financeiras
2. Planos + contratos (admin)
3. Geração de parcelas (automática ao ativar contrato)
4. Tela de cobranças + baixa manual
5. Dashboard financeiro (BI)
6. Régua de cobrança WhatsApp (integra com `auto-notify` existente)
7. `/portal/financeiro` (Portal do Aluno)
8. Integração com gateway (Asaas) — última subetapa, ativável como módulo

---

## Apêndice B — Variáveis WhatsApp — Financeiro

Estas variáveis são resolvidas pela Edge Function `financial-notify` ao renderizar templates:

| Variável | Fonte | Exemplo |
|----------|-------|---------|
| `{{nome_aluno}}` | `students.name` | João Pedro |
| `{{responsavel}}` | `students.financial_guardian_name` | Maria da Silva |
| `{{turma}}` | `school_classes.name` | 7º Ano A |
| `{{mes_referencia}}` | `financial_installments.reference_month` | Março/2026 |
| `{{valor}}` | `financial_installments.amount` | R$ 850,00 |
| `{{valor_atualizado}}` | calculado (amount + juros) | R$ 867,35 |
| `{{data_vencimento}}` | `financial_installments.due_date` | 10/03/2026 |
| `{{dias_atraso}}` | `days_overdue` (coluna gerada) | 15 |
| `{{chave_pix}}` | `system_settings[financial.pix_key]` | 12.345.678/0001-00 |
| `{{link_boleto}}` | `financial_installments.boleto_url` | https://... |
| `{{link_portal}}` | `system_settings[general.portal_url]` | https://portal.escola.com |

---

## Apêndice C — Modificações em Tabelas Existentes

| Tabela | Campo adicionado | Tipo | Motivo |
|--------|-----------------|------|--------|
| `students` | `financial_guardian_name` | TEXT | Nome do responsável financeiro |
| `students` | `financial_guardian_phone` | TEXT | Telefone para régua de cobrança |
| `students` | `financial_guardian_cpf` | TEXT | CPF para auth do portal |
| `students` | `status` | TEXT | `active`/`inactive`/`transferred`/`cancelled` |
| `students` | `school_year` | INTEGER | Ano letivo ativo |
| `activities` | `discipline_id` | UUID FK | Vinculo à tabela `disciplines` |
| `attendance` | `school_calendar_event_id` | UUID FK | Vinculo a feriados/eventos |
| `whatsapp_template_categories` | seed de 5 novas categorias | — | `financeiro`, `academico`, `ocorrencia`, `responsavel`, `secretaria` |
| `system_settings` | chave `financial.*` | JSONB | Config financeira: PIX, gateway, régua |

---

*Este documento complementa o PRD v2.1. As fases 1–7 estão concluídas conforme documentado em `PRD_V2.md`. As fases 8–12 descritas aqui representam a evolução do produto para um ERP escolar completo, mantendo todos os princípios arquiteturais já estabelecidos: multi-tenant, config-driven, event-driven, zero dados hardcoded.*
