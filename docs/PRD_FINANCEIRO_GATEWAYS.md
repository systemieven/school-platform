# PRD — Módulo Financeiro: Integração Multi-Gateway
## Suplemento da Fase 8 · PRD ERP Complementar v1.0

> **Versão**: 1.0  
> **Data**: 13 de abril de 2026  
> **Complementa**: `PRD_ERP_COMPLEMENTAR.md` — Fase 8, seção 3.2.7  
> **Contexto**: Arquitetura multi-tenant — cada escola configura seu(s) próprio(s) gateway(s)

---

## Índice

1. [Contexto e Decisões de Design](#1-contexto-e-decisões-de-design)
2. [Gateways Suportados e Perfis de Uso](#2-gateways-suportados-e-perfis-de-uso)
3. [Arquitetura de Abstração](#3-arquitetura-de-abstração)
4. [Schema do Banco de Dados](#4-schema-do-banco-de-dados)
5. [Credenciais por Gateway — Schema Dinâmico](#5-credenciais-por-gateway--schema-dinâmico)
6. [Fluxos de Operação](#6-fluxos-de-operação)
7. [Webhook Normalizado](#7-webhook-normalizado)
8. [Edge Functions](#8-edge-functions)
9. [Interface de Configuração (Admin)](#9-interface-de-configuração-admin)
10. [Integração com Módulos Existentes](#10-integração-com-módulos-existentes)
11. [Modo Manual (sem gateway)](#11-modo-manual-sem-gateway)
12. [Segurança e Armazenamento de Credenciais](#12-segurança-e-armazenamento-de-credenciais)

---

## 1. Contexto e Decisões de Design

### O problema do gateway único

O PRD complementar original mencionava a integração com o Asaas como gateway prioritário. Isso não se sustenta em um produto multi-tenant: cada escola tem sua história bancária, sua cooperativa, seu contrato de taxa já negociado. Uma escola do interior do RS usa Sicredi há 20 anos. Uma rede de colégios em São Paulo já integrou com Pagar.me. Um cursinho pequeno só precisa de PIX via Efí. Forçar um gateway específico é um bloqueador de vendas.

### Princípio central: abstração total

O sistema **não fala diretamente com nenhum gateway**. Toda operação passa por uma camada de adaptadores que normaliza a API específica de cada provedor para um contrato interno comum. O módulo financeiro do ERP não sabe — e não precisa saber — se está falando com Asaas ou Vindi. Ele emite um `ChargeRequest` e recebe um `GatewayCharge`.

### Multi-gateway por tenant

Cada escola pode ter **mais de um gateway ativo simultaneamente**. Casos de uso reais:
- Boleto via Sicredi (banco da cooperativa) + cartão recorrente via Pagar.me
- PIX via Efí + boleto via Asaas (contas diferentes, taxas diferentes)
- Gateway A para Educação Básica + Gateway B para Cursos Livres (planos distintos)

### Modo manual sempre disponível

Nenhum gateway é obrigatório. Escolas que preferem gerenciar cobranças fora do sistema (planilha, banco próprio) usam o **modo manual**: registram pagamentos manualmente, sem geração de boleto ou PIX automatizado. O módulo financeiro funciona integralmente no modo manual — apenas sem o link de pagamento.

---

## 2. Gateways Suportados e Perfis de Uso

### Levantamento de uso no ambiente educacional brasileiro

A pesquisa de mercado identificou os gateways mais presentes em sistemas de gestão escolar e ERPs educacionais no Brasil:

| Gateway | Perfil de uso escolar | Diferencial relevante | Complexidade de integração |
|---------|----------------------|----------------------|:-------------------------:|
| **Asaas** | Escolas privadas de médio porte; startups edtech | Conta digital PJ integrada; régua de cobrança nativa; API mais acessível do mercado; WhatsApp de cobrança próprio | 🟢 Baixa |
| **Efí (Gerencianet)** | Escolas de menor porte; cooperativas de ensino; cursos livres | Especializado em PIX/boleto; carnê digital; certificado ICP-Brasil para PIX API | 🟡 Média |
| **Iugu** | Plataformas edtech SaaS; redes de ensino; cursos online | Excelente para recorrência e split; API robusta; marketplace educacional | 🟡 Média |
| **Vindi** | Escolas com contratos de assinatura; redes franqueadas | Melhor da classe em gestão de assinaturas; Dunning automático | 🟡 Média |
| **Pagar.me (Stone)** | Redes de ensino maiores; marketplace de cursos | Full-stack de pagamentos; cartão recorrente + split | 🟡 Média |
| **PagSeguro (PagBank)** | Escolas com operação presencial também | Maquininha + gateway; reconhecimento de marca pelos pais | 🟢 Baixa |
| **Mercado Pago** | Escolas que já usam ecosistema ML | Link de pagamento fácil; reconhecimento de marca | 🟢 Baixa |
| **Sicredi (API direta)** | Cooperativas; escolas do Sul e Centro-Oeste | Banco da própria cooperativa escolar; taxa zero em muitos casos | 🔴 Alta (mTLS + OAuth) |
| **Manual** | Qualquer escola; fase inicial; escolas menores | Sem taxas; controle total; baixa digital no sistema | 🟢 Nenhuma |

### Prioridade de implementação

```
V1 (lançamento)         V2 (3 meses)          V3 (6 meses)
────────────────         ─────────────          ─────────────
✅ Manual               ✅ Efí                 🔜 Vindi
✅ Asaas                ✅ Iugu                🔜 PagSeguro
                        ✅ Pagar.me            🔜 Mercado Pago
                        ✅ Sicredi             🔜 Outros sob demanda
```

A priorização considera: adoção em escolas de pequeno/médio porte (foco do produto), complexidade de integração, e demanda esperada da base de clientes.

---

## 3. Arquitetura de Abstração

### Visão geral do fluxo

```
Admin do ERP
    │
    ▼
FinancialModule (React)
    │  ChargeRequest (gateway-agnostic)
    ▼
Edge Function: payment-gateway-proxy
    │  Lê payment_gateways → seleciona adapter
    ▼
┌─────────────────────────────────────────────┐
│             GatewayRouter                   │
│  switch(provider) { case 'asaas': ... }     │
└──────┬──────┬──────┬──────┬──────┬──────────┘
       │      │      │      │      │
    Asaas   Efí   Iugu  Pagar.me Sicredi  ...
  Adapter Adapter Adapter Adapter Adapter
       │      │      │      │      │
    API    API    API    API    API externas
       │      │      │      │      │
       └──────┴──────┴──────┴──────┘
                    │
              GatewayCharge (normalizado)
                    │
              financial_installments
                    │
              whatsapp_message_log (notificação)
```

### Contrato interno — TypeScript Interfaces

```typescript
// ─── REQUEST TYPES ───────────────────────────────────────────

interface GatewayCustomerData {
  external_ref: string      // student_id (nosso ID)
  name: string
  cpf: string
  email?: string
  phone?: string
  address?: {
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    zip_code: string
  }
}

interface ChargeRequest {
  external_ref: string          // installment_id (nosso ID — vai no metadata do gateway)
  customer_external_id: string  // ID do cliente já criado no gateway
  amount_cents: number          // valor em centavos
  due_date: string              // 'YYYY-MM-DD'
  description: string           // ex: "Mensalidade Março/2026 - João Pedro"
  payment_methods: Array<'boleto' | 'pix' | 'credit_card' | 'debit_card'>
  interest_rate_pct?: number    // % ao dia
  late_fee_pct?: number         // % de multa
  discount?: {
    type: 'fixed' | 'percentage'
    value: number
    deadline_days?: number      // ex: desconto se pagar 5 dias antes
  }
  notification_disabled?: boolean  // true = não enviar notificações do próprio gateway
  metadata?: Record<string, string>
}

// ─── RESPONSE TYPES ──────────────────────────────────────────

interface GatewayCustomer {
  provider_id: string     // ID gerado pelo gateway
  external_ref: string    // nosso ID de volta
  raw?: unknown           // resposta bruta para debug
}

interface GatewayCharge {
  provider_id: string         // ID da cobrança no gateway
  external_ref: string        // nosso installment_id de volta
  status: GatewayChargeStatus
  boleto_url?: string
  boleto_barcode?: string
  pix_code?: string           // copia-e-cola
  pix_qr_code_url?: string    // URL da imagem do QR code
  payment_link?: string       // link de pagamento unificado
  due_date: string
  amount_cents: number
  raw?: unknown
}

type GatewayChargeStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded'
  | 'failed'

// ─── ADAPTER INTERFACE ────────────────────────────────────────

interface GatewayAdapter {
  // Cadastrar o cliente (responsável financeiro) no gateway
  createCustomer(data: GatewayCustomerData): Promise<GatewayCustomer>

  // Buscar cliente existente pelo nosso external_ref
  findCustomer(externalRef: string): Promise<GatewayCustomer | null>

  // Criar cobrança (boleto/PIX/cartão)
  createCharge(charge: ChargeRequest): Promise<GatewayCharge>

  // Cancelar cobrança
  cancelCharge(providerChargeId: string): Promise<void>

  // Consultar status atualizado de uma cobrança
  getCharge(providerChargeId: string): Promise<GatewayCharge>

  // Normalizar payload de webhook para formato interno
  normalizeWebhook(rawPayload: unknown): NormalizedWebhookEvent

  // Testar conectividade com as credenciais fornecidas
  ping(): Promise<{ ok: boolean; message?: string }>
}

// ─── WEBHOOK NORMALIZED EVENT ────────────────────────────────

interface NormalizedWebhookEvent {
  provider_charge_id: string    // ID da cobrança no gateway
  installment_id: string        // nosso ID (extraído do metadata/external_ref)
  event_type: 'payment_received' | 'payment_failed' | 'payment_refunded' | 'charge_cancelled' | 'overdue'
  status: GatewayChargeStatus
  paid_at?: string              // ISO datetime
  paid_amount_cents?: number
  payment_method?: string
  gateway_fee_cents?: number    // taxa cobrada pelo gateway, se disponível
  raw: unknown                  // payload original preservado
}
```

### Gateway Router (Deno — Edge Function)

```typescript
// supabase/functions/payment-gateway-proxy/adapters/index.ts

import { AsaasAdapter } from './asaas.ts'
import { EfiAdapter } from './efi.ts'
import { IuguAdapter } from './iugu.ts'
import { PagarmeAdapter } from './pagarme.ts'
import { ManualAdapter } from './manual.ts'
// ... outros adapters

export function getAdapter(
  provider: string,
  credentials: Record<string, string>,
  environment: 'production' | 'sandbox'
): GatewayAdapter {
  switch (provider) {
    case 'asaas':    return new AsaasAdapter(credentials, environment)
    case 'efi':      return new EfiAdapter(credentials, environment)
    case 'iugu':     return new IuguAdapter(credentials, environment)
    case 'pagarme':  return new PagarmeAdapter(credentials, environment)
    case 'manual':   return new ManualAdapter()
    default:         throw new Error(`Provider não suportado: ${provider}`)
  }
}
```

---

## 4. Schema do Banco de Dados

### Migration 28-A: `payment_gateways` (adição à migration 28 do PRD original)

```sql
-- Gateways configurados por tenant
CREATE TABLE payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidade
  provider TEXT NOT NULL CHECK (provider IN (
    'asaas', 'efi', 'iugu', 'vindi',
    'pagarme', 'pagseguro', 'mercadopago',
    'sicredi', 'manual'
  )),
  label TEXT NOT NULL,
  -- Exemplo: "Asaas — Conta Principal", "Sicredi — Cooperativa Caruaru"

  -- Estado
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  environment TEXT DEFAULT 'production'
    CHECK (environment IN ('production', 'sandbox')),

  -- Credenciais criptografadas (ver seção 12)
  -- Estrutura JSONB varia por provider (ver seção 5)
  credentials JSONB NOT NULL DEFAULT '{}',

  -- Webhook
  webhook_secret TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  -- URL de webhook montada pelo frontend:
  -- {SUPABASE_URL}/functions/v1/payment-gateway-webhook?gw={id}&secret={webhook_secret}

  -- Métodos suportados por este gateway nesta configuração
  supported_methods TEXT[] DEFAULT ARRAY['boleto', 'pix'],

  -- Metadata de conexão (atualizado pelo ping)
  last_ping_at TIMESTAMPTZ,
  last_ping_ok BOOLEAN,
  last_ping_message TEXT,

  -- Auditoria
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: apenas 1 gateway padrão ativo por vez
CREATE UNIQUE INDEX idx_payment_gateways_default
  ON payment_gateways (is_default)
  WHERE is_default = TRUE AND is_active = TRUE;

-- Cadastro de clientes no gateway (cache — evita re-criar o mesmo cliente)
CREATE TABLE gateway_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES payment_gateways(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  provider_customer_id TEXT NOT NULL, -- ID gerado pelo gateway
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (gateway_id, student_id)
);

-- Adicionar gateway_id às tabelas existentes
ALTER TABLE financial_contracts
  ADD COLUMN gateway_id UUID REFERENCES payment_gateways(id);
  -- NULL = usa o gateway padrão

ALTER TABLE financial_installments
  ADD COLUMN gateway_id UUID REFERENCES payment_gateways(id),
  ADD COLUMN provider_charge_id TEXT,         -- ID da cobrança no gateway
  ADD COLUMN payment_link TEXT,               -- link unificado (boleto+pix+cartão)
  ADD COLUMN gateway_fee_cents INTEGER,        -- taxa do gateway ao receber
  ADD COLUMN gateway_raw_response JSONB;      -- última resposta bruta (debug)

-- Log de eventos de webhook recebidos
CREATE TABLE gateway_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES payment_gateways(id),
  provider TEXT NOT NULL,
  event_type TEXT,
  provider_charge_id TEXT,
  installment_id UUID REFERENCES financial_installments(id),
  normalized JSONB,     -- NormalizedWebhookEvent
  raw JSONB,            -- payload bruto
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  error TEXT            -- se falhou ao processar
);

CREATE INDEX idx_webhook_log_installment ON gateway_webhook_log(installment_id);
CREATE INDEX idx_webhook_log_processed ON gateway_webhook_log(processed_at DESC);

-- RLS
ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_gateways"
  ON payment_gateways FOR ALL
  USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));

CREATE POLICY "admins_view_webhook_log"
  ON gateway_webhook_log FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('super_admin', 'admin'));
```

---

## 5. Credenciais por Gateway — Schema Dinâmico

O frontend lê o schema de credenciais de um arquivo de configuração estático (em código, não no banco) e renderiza o formulário dinamicamente. Isso elimina a necessidade de codificar um formulário por gateway.

### Estrutura do schema de campos

```typescript
type FieldType =
  | 'text'      // campo de texto simples
  | 'secret'    // campo mascarado (senha) — valor nunca exibido depois de salvo
  | 'select'    // dropdown com opções fixas
  | 'file'      // upload de arquivo (ex: certificado .p12)
  | 'textarea'  // texto longo (ex: chave privada PEM)

interface CredentialField {
  key: string              // chave no JSONB credentials
  label: string            // label no formulário
  placeholder?: string
  type: FieldType
  required: boolean
  options?: { value: string; label: string }[]  // para 'select'
  hint?: string            // texto de ajuda abaixo do campo
  docs_url?: string        // link para documentação do gateway
}
```

### Schema por gateway

```typescript
// src/config/gateway-schemas.ts

export const GATEWAY_CREDENTIAL_SCHEMAS: Record<string, CredentialField[]> = {

  // ── ASAAS ─────────────────────────────────────────────────────────────
  asaas: [
    {
      key: 'api_key',
      label: 'API Key (Produção)',
      type: 'secret',
      required: true,
      placeholder: '$aas_...',
      hint: 'Encontre em: Minha conta → Integrações → Chave de API',
      docs_url: 'https://docs.asaas.com/reference/autenticacao',
    },
    {
      key: 'sandbox_api_key',
      label: 'API Key (Sandbox)',
      type: 'secret',
      required: false,
      placeholder: '$aas_... (ambiente de teste)',
      hint: 'Opcional. Usado quando o ambiente está definido como Sandbox.',
    },
  ],

  // ── EFÍ (GERENCIANET) ──────────────────────────────────────────────────
  efi: [
    {
      key: 'client_id',
      label: 'Client ID',
      type: 'text',
      required: true,
      hint: 'Gerado no portal Efí Bank → API → Aplicações',
      docs_url: 'https://dev.efipay.com.br/docs/api-cobrancas/autenticacao',
    },
    {
      key: 'client_secret',
      label: 'Client Secret',
      type: 'secret',
      required: true,
    },
    {
      key: 'pix_key',
      label: 'Chave PIX',
      type: 'text',
      required: true,
      placeholder: 'CPF, CNPJ, e-mail, telefone ou chave aleatória',
      hint: 'A chave PIX registrada na sua conta Efí que receberá os pagamentos.',
    },
    {
      key: 'certificate_b64',
      label: 'Certificado (.p12 em Base64)',
      type: 'textarea',
      required: true,
      hint: 'Certificado digital obrigatório para PIX. Gere no portal Efí → API → Certificados. Faça upload do .p12 e o sistema converte para Base64.',
      docs_url: 'https://dev.efipay.com.br/docs/api-pix/credenciais',
    },
    {
      key: 'account_identifier',
      label: 'Identificador da Conta',
      type: 'text',
      required: true,
      hint: 'Número da conta Efí (campo "conta" no painel).',
    },
  ],

  // ── IUGU ──────────────────────────────────────────────────────────────
  iugu: [
    {
      key: 'api_token',
      label: 'API Token',
      type: 'secret',
      required: true,
      hint: 'Encontre em: Configurações → Token de API no painel Iugu',
      docs_url: 'https://dev.iugu.com/reference/autentica%C3%A7%C3%A3o',
    },
    {
      key: 'account_id',
      label: 'Account ID',
      type: 'text',
      required: true,
      hint: 'ID da sua conta Iugu (visível na URL do painel ou nas configurações).',
    },
  ],

  // ── VINDI ─────────────────────────────────────────────────────────────
  vindi: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'secret',
      required: true,
      hint: 'Acesse: Configurações → Chaves de API no painel Vindi',
      docs_url: 'https://atendimento.vindi.com.br/hc/pt-br/articles/210159903',
    },
  ],

  // ── PAGAR.ME (STONE) ──────────────────────────────────────────────────
  pagarme: [
    {
      key: 'api_key',
      label: 'Secret Key (sk_...)',
      type: 'secret',
      required: true,
      placeholder: 'sk_live_... ou sk_test_...',
      hint: 'Encontre em: Dashboard Pagar.me → Configurações → Chaves de API',
      docs_url: 'https://docs.pagar.me/reference/autenticacao',
    },
    {
      key: 'public_key',
      label: 'Public Key (pk_...)',
      type: 'text',
      required: true,
      placeholder: 'pk_live_... ou pk_test_...',
      hint: 'Usada para tokenização de cartão no frontend (opcional para boleto/PIX).',
    },
  ],

  // ── PAGSEGURO ─────────────────────────────────────────────────────────
  pagseguro: [
    {
      key: 'token',
      label: 'Token de Integração',
      type: 'secret',
      required: true,
      hint: 'PagSeguro → Minha conta → Preferências → Integrações → Token',
      docs_url: 'https://dev.pagbank.uol.com.br/reference/autenticacao',
    },
    {
      key: 'email',
      label: 'E-mail da conta PagSeguro',
      type: 'text',
      required: true,
      placeholder: 'exemplo@escola.com.br',
    },
  ],

  // ── MERCADO PAGO ──────────────────────────────────────────────────────
  mercadopago: [
    {
      key: 'access_token',
      label: 'Access Token',
      type: 'secret',
      required: true,
      placeholder: 'APP_USR-...',
      hint: 'Mercado Pago → Suas integrações → Credenciais de produção → Access Token',
      docs_url: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing',
    },
    {
      key: 'public_key',
      label: 'Public Key',
      type: 'text',
      required: true,
      placeholder: 'APP_USR-...',
      hint: 'Usada para tokenização no frontend. Obrigatória para pagamentos com cartão.',
    },
  ],

  // ── SICREDI (API DIRETA) ───────────────────────────────────────────────
  sicredi: [
    {
      key: 'client_id',
      label: 'Client ID',
      type: 'text',
      required: true,
      hint: 'Gerado no portal Sicredi Developers. Requer ativação prévia com seu gerente.',
      docs_url: 'https://developers.sicredi.com.br',
    },
    {
      key: 'client_secret',
      label: 'Client Secret',
      type: 'secret',
      required: true,
    },
    {
      key: 'cooperativa',
      label: 'Código da Cooperativa',
      type: 'text',
      required: true,
      placeholder: '0101',
      hint: 'Código de 4 dígitos da cooperativa Sicredi onde a conta está registrada.',
    },
    {
      key: 'conta',
      label: 'Número da Conta',
      type: 'text',
      required: true,
      placeholder: '12345-6',
    },
    {
      key: 'convenio',
      label: 'Código do Convênio (Cedente)',
      type: 'text',
      required: true,
      hint: 'Código do convênio de cobrança. Consulte seu gerente Sicredi.',
    },
    {
      key: 'pix_key',
      label: 'Chave PIX',
      type: 'text',
      required: false,
      placeholder: 'CNPJ, e-mail, telefone ou chave aleatória',
      hint: 'Obrigatório apenas se for emitir cobranças via PIX. Deixe em branco para apenas boleto.',
    },
  ],

  // ── MANUAL (SEM GATEWAY) ──────────────────────────────────────────────
  manual: [],
  // Nenhum campo necessário.
}
```

---

## 6. Fluxos de Operação

### 6.1 Fluxo: Ativar contrato e gerar cobranças

```
Admin ativa contrato financeiro
    │
    ├─ Seleciona gateway (ou usa padrão)
    │
    ▼
Edge Function: payment-gateway-proxy
    │
    ├─ 1. Verifica se o responsável já tem `gateway_customers` entry
    │      └─ Se não: createCustomer() → salva provider_customer_id
    │
    ├─ 2. Para cada parcela do contrato:
    │      └─ createCharge(ChargeRequest) → GatewayCharge
    │           ├─ Salva provider_charge_id na installment
    │           ├─ Salva boleto_url / pix_code / payment_link
    │           └─ Status: 'pending'
    │
    └─ 3. Retorna resumo ao frontend
```

### 6.2 Fluxo: Pagamento confirmado (via webhook)

```
Gateway detecta pagamento
    │
    ▼
POST {SUPABASE_URL}/functions/v1/payment-gateway-webhook
     ?gw={gateway_id}&secret={webhook_secret}
    │
    ▼
Edge Function: payment-gateway-webhook
    │
    ├─ 1. Valida secret → busca payment_gateways row
    │
    ├─ 2. getAdapter(provider).normalizeWebhook(rawPayload)
    │      → NormalizedWebhookEvent
    │
    ├─ 3. Salva em gateway_webhook_log (sempre, independente do resultado)
    │
    ├─ 4. Busca financial_installments por provider_charge_id
    │
    ├─ 5. Atualiza installment:
    │      ├─ status: 'paid'
    │      ├─ paid_at: event.paid_at
    │      ├─ paid_amount: event.paid_amount_cents / 100
    │      └─ gateway_fee_cents: event.gateway_fee_cents
    │
    ├─ 6. Dispara trigger → auto-notify
    │      └─ Template: "pagamento-confirmado" (categoria: financeiro)
    │
    └─ 7. Retorna HTTP 200 ao gateway (evitar reenvio)
```

### 6.3 Fluxo: Parcela vence sem pagamento (régua de cobrança)

```
pg_cron: executa diariamente às 08:00
    │
    ▼
Seleciona parcelas vencidas/próximas do vencimento
    │  SELECT * FROM financial_installments
    │  WHERE status IN ('pending', 'overdue')
    │  AND due_date BETWEEN (NOW() - interval '30 days') AND (NOW() + interval '5 days')
    │
    ▼
Para cada parcela:
    │
    ├─ Calcula qual etapa da régua é aplicável (D-5, D-1, D+0, D+3, D+10, D+30)
    │   └─ Verifica financial_notification_log para evitar reenvio
    │
    ├─ Se etapa não enviada ainda:
    │   └─ Dispara Edge Function: financial-notify
    │        ├─ Busca template da categoria 'financeiro' + trigger_type
    │        ├─ Renderiza variáveis (ver Apêndice B do PRD principal)
    │        └─ Envia via uazapi-proxy (mesmo proxy WhatsApp existente)
    │
    └─ Atualiza status para 'overdue' se due_date < NOW() e status = 'pending'
```

### 6.4 Fluxo: Reenvio manual de cobrança

```
Admin clica em "Reenviar cobrança" em uma parcela
    │
    ▼
Edge Function: payment-gateway-proxy (action: 'refresh_charge')
    │
    ├─ getCharge(provider_charge_id) → verifica status atualizado no gateway
    │
    ├─ Se já foi paga no gateway mas não no ERP:
    │   └─ Sincroniza status (pagamento perdido de webhook)
    │
    ├─ Se ainda pendente:
    │   ├─ Reemite notificação WhatsApp (fora da régua automática)
    │   └─ Retorna links de pagamento atualizados (PIX renovado se expirado)
    │
    └─ Retorna ao frontend
```

### 6.5 Fluxo: Cancelamento de parcela

```
Admin cancela parcela (ex: aluno saiu da escola)
    │
    ▼
Edge Function: payment-gateway-proxy (action: 'cancel_charge')
    │
    ├─ Se provider_charge_id existe:
    │   └─ adapter.cancelCharge(provider_charge_id)
    │
    └─ Atualiza installment.status = 'cancelled'
```

---

## 7. Webhook Normalizado

Cada gateway envia webhooks em formatos completamente diferentes. Os adapters normalizam tudo para `NormalizedWebhookEvent`. Exemplos:

### Asaas → Normalizado

```json
// Payload bruto Asaas (event: PAYMENT_RECEIVED)
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_280892068777418",
    "dateCreated": "2026-03-01",
    "customer": "cus_000005113026",
    "value": 850.00,
    "netValue": 843.25,
    "billingType": "PIX",
    "paymentDate": "2026-03-10",
    "externalReference": "install_a1b2c3d4...",
    "status": "RECEIVED"
  }
}

// → Normalizado
{
  "provider_charge_id": "pay_280892068777418",
  "installment_id": "a1b2c3d4...",          // extraído de externalReference
  "event_type": "payment_received",
  "status": "paid",
  "paid_at": "2026-03-10T00:00:00Z",
  "paid_amount_cents": 85000,
  "payment_method": "pix",
  "gateway_fee_cents": 199,                  // (850.00 - 843.25) * 100
  "raw": { ...payload original... }
}
```

### Efí → Normalizado

```json
// Payload bruto Efí (pix recebido)
{
  "pix": [{
    "endToEndId": "E001163....",
    "txid": "7978c80c...",
    "valor": "850.00",
    "pagador": { "cpf": "123.456.789-00", "nome": "Maria da Silva" },
    "horario": "2026-03-10T14:32:00.000Z",
    "infoPagador": "install_a1b2c3d4..."    // nosso ID enviado como txid
  }]
}

// → Normalizado
{
  "provider_charge_id": "7978c80c...",
  "installment_id": "a1b2c3d4...",
  "event_type": "payment_received",
  "status": "paid",
  "paid_at": "2026-03-10T14:32:00.000Z",
  "paid_amount_cents": 85000,
  "payment_method": "pix",
  "raw": { ...payload original... }
}
```

### Iugu → Normalizado

```json
// Payload bruto Iugu
{
  "event": "invoice.status_changed",
  "data": {
    "id": "FATURA123",
    "status": "paid",
    "paid_at": "2026-03-10T14:00:00-03:00",
    "total_paid_cents": 85000,
    "payment_method": "bank_slip",
    "custom_variables": [
      { "name": "installment_id", "value": "a1b2c3d4..." }
    ]
  }
}

// → Normalizado
{
  "provider_charge_id": "FATURA123",
  "installment_id": "a1b2c3d4...",           // extraído de custom_variables
  "event_type": "payment_received",
  "status": "paid",
  "paid_at": "2026-03-10T17:00:00Z",         // convertido para UTC
  "paid_amount_cents": 85000,
  "payment_method": "boleto",
  "raw": { ...payload original... }
}
```

### Nota sobre idempotência

O `gateway_webhook_log` armazena cada evento recebido. Antes de atualizar uma `financial_installment`, a Edge Function verifica se já existe um evento `payment_received` processado para aquele `provider_charge_id`. Isso evita atualização duplicada em caso de reenvio pelo gateway.

---

## 8. Edge Functions

### 8.1 `payment-gateway-proxy`

```
Auth:     JWT (admin+)
Rate:     —
Método:   POST
```

**Payload de entrada**:
```json
{
  "action": "create_customer" | "create_charge" | "cancel_charge" | "get_charge" | "refresh_charge" | "ping",
  "gateway_id": "uuid",
  "data": { ... }  // ChargeRequest | GatewayCustomerData | { provider_charge_id: string }
}
```

**Responsabilidades**:
1. Autentica JWT → extrai role
2. Busca `payment_gateways` row pelo `gateway_id`
3. Descriptografa `credentials` (ver seção 12)
4. Instancia o adapter correto via `getAdapter(provider, credentials, environment)`
5. Executa a action
6. Salva resultado na tabela relevante (`gateway_customers`, `financial_installments`)
7. Retorna `GatewayCharge` | `GatewayCustomer` | status do ping

### 8.2 `payment-gateway-webhook`

```
Auth:     Secret URL param (?gw={id}&secret={webhook_secret})
Rate:     120/min por IP
Método:   POST
verify_jwt: false
```

**Responsabilidades**:
1. Valida `?secret` contra `payment_gateways.webhook_secret`
2. Identifica provider pelo `gateway_id`
3. Instancia adapter → `normalizeWebhook(rawPayload)`
4. Salva em `gateway_webhook_log` (sempre, mesmo em erro)
5. Idempotência: verifica se evento já processado
6. Atualiza `financial_installments`
7. Dispara `auto-notify` para template "pagamento-confirmado" se status = paid
8. Retorna `HTTP 200` (crítico: se retornar erro, gateways reenviam indefinidamente)

### 8.3 `financial-notify` (pg_cron)

```
Auth:     Chamado internamente via pg_net + trigger secret
Trigger:  pg_cron diário às 08:00
```

**Responsabilidades**:
1. Query parcelas elegíveis para notificação (por etapa da régua)
2. Verifica `financial_notification_log` para evitar duplicidade
3. Busca template WhatsApp da categoria `financeiro` + trigger_type correspondente
4. Renderiza variáveis (ver Apêndice B do PRD Complementar)
5. Envia via `uazapi-proxy` (Edge Function existente)
6. Registra em `financial_notification_log` + `whatsapp_message_log`

---

## 9. Interface de Configuração (Admin)

**Rota**: `/admin/configuracoes` → aba **Financeiro** → sub-aba **Gateways**

### Layout da tela

```
┌─────────────────────────────────────────────────────────────┐
│  GATEWAYS DE PAGAMENTO                        [+ Adicionar] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🟢 ASAAS — Conta Principal              [PADRÃO]  │   │
│  │  Produção  ·  Boleto · PIX · Cartão               │   │
│  │  Último teste: 13/04/2026 08:00 ✓                 │   │
│  │                    [Editar] [Testar] [Desativar]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚫ SICREDI — Cooperativa Caruaru                   │   │
│  │  Produção  ·  Boleto · PIX                         │   │
│  │  Último teste: 10/04/2026 09:15 ✓                 │   │
│  │                    [Editar] [Testar] [Ativar]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Drawer: Adicionar/Editar Gateway

**Passo 1 — Seleção do provedor**:
- Grid de cards com logo, nome e descrição curta de cada gateway
- Card "Manual (sem gateway)" sempre disponível
- Badge "V1" ou "V2" indicando disponibilidade

**Passo 2 — Formulário de credenciais**:
- Campos gerados dinamicamente a partir de `GATEWAY_CREDENTIAL_SCHEMAS[provider]`
- Campos `type: 'secret'`: exibem `••••••` após salvar; botão "Alterar" para novo valor
- Campo `type: 'file'` (certificado Efí): upload → conversão automática para base64
- Link para documentação do gateway em cada campo com `docs_url`

**Passo 3 — Configurações adicionais**:
- Label da configuração (ex: "Asaas — Conta Principal")
- Ambiente: Produção / Sandbox
- Métodos suportados: checkboxes (Boleto, PIX, Cartão de crédito, Cartão de débito)
- Definir como padrão: toggle (desmarca o anterior automaticamente)

**Passo 4 — Teste de conexão**:
- Botão "Testar conexão" → chama `payment-gateway-proxy` com `action: 'ping'`
- Resultado visual: ✅ Conectado / ❌ Erro (mensagem)
- Salvar só é habilitado após teste bem-sucedido (ou com confirmação manual se pulado)

**URL do Webhook**:
- Exibida em destaque após salvar
- Botão "Copiar URL"
- Instruções de onde configurar no gateway
- Botão "Gerar novo secret" (invalida o anterior)

### Sub-aba: Régua de Cobrança

**Rota**: `/admin/configuracoes` → Financeiro → **Régua de Cobrança**

```
┌─────────────────────────────────────────────────────────────┐
│  RÉGUA DE COBRANÇA AUTOMÁTICA                               │
│  As notificações são enviadas via WhatsApp para o           │
│  responsável financeiro de cada aluno.                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────┐  D-5  Aviso pré-vencimento      [Ativo ▼]          │
│  │ 🔔 │       Template: [Mensalidade - D5 ▼]  [Preview]   │
│  └────┘                                                     │
│                                                             │
│  ┌────┐  D-1  Véspera do vencimento     [Ativo ▼]          │
│  │ 🔔 │       Template: [Mensalidade - D1 ▼]  [Preview]   │
│  └────┘                                                     │
│  ... (D+0, D+3, D+10, D+30)                                │
│                                                             │
│  ┌────┐  Pagamento confirmado           [Ativo ▼]          │
│  │ ✅ │       Template: [Pagamento OK ▼]        [Preview]  │
│  └────┘                                                     │
│                                [Salvar Régua]               │
└─────────────────────────────────────────────────────────────┘
```

Cada etapa tem:
- Toggle ativo/inativo
- Seletor de template (filtra por categoria `financeiro`)
- Botão "Preview" (modal com renderização do template com dados fictícios)

---

## 10. Integração com Módulos Existentes

| Módulo | Como integra |
|--------|-------------|
| `financial_contracts` | `gateway_id` → qual gateway usar para este contrato (null = padrão) |
| `financial_installments` | `provider_charge_id`, `boleto_url`, `pix_code`, `payment_link`, `gateway_id` |
| `students` | `financial_guardian_cpf`, `financial_guardian_phone` → usados para criar cliente no gateway |
| `whatsapp_templates` | Régua de cobrança usa templates da categoria `financeiro` + `uazapi-proxy` existente |
| `whatsapp_message_log` | Cada notificação financeira logada normalmente |
| `financial_notification_log` | Log específico de etapas da régua (evita reenvio) |
| `audit_logs` | Criação/edição de gateways, registros de pagamento |
| `/admin/configuracoes` | Nova aba Financeiro com sub-abas: Planos, Régua, Gateways |
| Portal do Aluno `/portal/financeiro` | Exibe `boleto_url`, `pix_code`, `payment_link` da installment |
| Portal do Responsável `/responsavel/financeiro` | Mesmos dados do portal do aluno |
| Dashboard `/admin/financeiro` | Métricas independem do gateway (leem de `financial_installments`) |

---

## 11. Modo Manual (sem gateway)

O modo manual é um adapter que não faz nenhuma chamada externa. Ele simula a interface do `GatewayAdapter` retornando respostas "neutras".

**Comportamento do ManualAdapter**:
- `createCustomer()` → retorna `{ provider_id: 'manual', external_ref }`
- `createCharge()` → retorna `{ provider_id: 'manual-{uuid}', status: 'pending', ... }` sem links de pagamento
- `cancelCharge()` → no-op (sem ação)
- `getCharge()` → retorna status atual da installment (do banco)
- `normalizeWebhook()` → nunca chamado (manual não recebe webhooks)
- `ping()` → retorna `{ ok: true, message: 'Modo manual — sem integração' }`

**Fluxo de baixa manual**:
1. Admin acessa `financial_installments` → clica em "Registrar pagamento"
2. Preenche: data de pagamento, valor pago, forma de pagamento, observação
3. Status atualizado para `paid` diretamente, sem gateway
4. Notificação WhatsApp de confirmação pode ser enviada manualmente (botão "Notificar responsável")

**Uso típico do modo manual**:
- Escola que recebe em dinheiro no caixa
- Escola que usa sistema bancário próprio (arquivo remessa/retorno) sem API
- Escola em processo de migração que ainda não configurou gateway
- Casos de negociação especial onde o pagamento é feito fora do fluxo normal

---

## 12. Segurança e Armazenamento de Credenciais

### O problema

Credenciais de gateways (API keys, secrets, certificados) são dados extremamente sensíveis. Elas nunca podem aparecer em logs, respostas de API ao frontend, ou ser acessadas por roles não-admin.

### Solução: Criptografia em duas camadas

**Camada 1 — RLS**: A tabela `payment_gateways` só é acessível por `super_admin` e `admin`.

**Camada 2 — Criptografia do campo credentials**: O campo `credentials` JSONB é criptografado antes de ser salvo e descriptografado apenas dentro de Edge Functions.

```sql
-- Extensão pgcrypto (já disponível no Supabase)
-- A chave de criptografia vive em Supabase Vault (secrets)

-- Função de criptografia (chamada na Edge Function, não no SQL diretamente)
-- O campo credentials é salvo já criptografado pelo código da Edge Function
-- usando a chave armazenada em: supabase secrets set GATEWAY_ENCRYPTION_KEY=...

-- Alternativamente: usar Supabase Vault
-- SELECT vault.create_secret('{"api_key": "..."}', 'gateway_{id}');
-- SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'gateway_{id}';
```

**Implementação na Edge Function**:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENCRYPTION_KEY = Deno.env.get('GATEWAY_ENCRYPTION_KEY')! // 32 bytes hex

function encryptCredentials(credentials: Record<string, string>): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final()
  ])
  return `enc:${iv.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptCredentials(stored: string): Record<string, string> {
  if (!stored.startsWith('enc:')) return JSON.parse(stored) // legado não criptografado
  const [, ivHex, encHex] = stored.split(':')
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  )
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final()
  ])
  return JSON.parse(decrypted.toString('utf8'))
}
```

### O que o frontend NUNCA recebe

- Valores dos campos `secret` das credenciais
- O campo `credentials` completo
- O `webhook_secret` após a criação (exibido apenas uma vez)

### O que o frontend recebe

- `id`, `provider`, `label`, `is_active`, `is_default`, `environment`
- `supported_methods`, `last_ping_at`, `last_ping_ok`, `last_ping_message`
- Lista de campos com `type: 'secret'` exibidos como `"••••••"` (apenas indicador de preenchido/vazio)
- URL de webhook montada pelo frontend com o `webhook_secret` (mas sem exibir o secret em texto após salvar)

### Supabase Secret necessário

```bash
supabase secrets set GATEWAY_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

Adicionado ao checklist de onboarding de novo cliente (seção 10.3.8 do PRD v2).

---

## Apêndice — Comparativo de Capabilities por Gateway

| Capacidade | Asaas | Efí | Iugu | Vindi | Pagar.me | PagSeguro | Mercado Pago | Sicredi |
|------------|:-----:|:---:|:----:|:-----:|:--------:|:---------:|:------------:|:-------:|
| Boleto registrado | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PIX dinâmico | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cartão recorrente | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Boleto + PIX híbrido | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Webhook de confirmação | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sandbox/teste | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Régua própria (nativa) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| NF-e integrada | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Split de pagamento | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Conta digital integrada | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| mTLS obrigatório (PIX) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Nota sobre régua nativa**: Asaas e Vindi têm régua de cobrança própria. Ao usar esses gateways, a régua interna do ERP pode ser desativada para evitar notificações duplicadas. Toggle configurável em `/admin/configuracoes` → Financeiro → Régua → "Usar régua do gateway (desativa a interna)".

> **Nota sobre mTLS**: Efí e Sicredi exigem certificado digital mTLS para operações PIX. A Edge Function `payment-gateway-proxy` precisa ter acesso ao certificado armazenado criptografado no campo `credentials.certificate_b64`. O runtime Deno suporta mTLS nativo via `Deno.createHttpClient({ certChain, privateKey })`.

---

*Este documento detalha exclusivamente a arquitetura de integração com gateways de pagamento do Módulo Financeiro. Para o modelo de dados financeiro completo (planos, contratos, parcelas, dashboard), consulte o `PRD_ERP_COMPLEMENTAR.md` — Fase 8.*
