-- Migration 194: Fix RLS policies que referenciam guardian_profiles.user_id (coluna inexistente)
--
-- Bug pre-existente: 5 migrations (088, 089, 091, 095, 096) escreveram policies
-- com `guardian_profiles WHERE user_id = auth.uid()`. A tabela guardian_profiles
-- (migration 075) NAO tem coluna user_id — o `id` JA e a FK pra auth.users(id).
-- Resultado: as policies ou erram em execucao ou nunca retornam linhas, bloqueando
-- responsaveis autenticados de verem seus proprios pedidos, faltas, autorizacoes
-- de saida, solicitacoes de saude e protocolos de retirada.
--
-- Fix: substituir todas as ocorrencias por comparacao direta com auth.uid()
-- (`guardian_id = auth.uid()` ou `id = auth.uid()` conforme o caso).
--
-- NOTE: alguns DROP IF EXISTS abaixo nao casaram com os nomes reais das policies
-- originais; a migration 195 faz a limpeza/recriacao com os nomes corretos.

-- ── 088: absence_communications (INSERT corrigida aqui; SELECT na 195) ────────
DROP POLICY IF EXISTS "guardian read absence_communications" ON absence_communications;
DROP POLICY IF EXISTS "guardian insert absence_communications" ON absence_communications;
CREATE POLICY "guardian insert absence_communications" ON absence_communications
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

-- ── 089: exit_authorizations (INSERT corrigida aqui; SELECT na 195) ──────────
DROP POLICY IF EXISTS "guardian read exit_authorizations" ON exit_authorizations;
DROP POLICY IF EXISTS "guardian insert exit_authorizations" ON exit_authorizations;
CREATE POLICY "guardian insert exit_authorizations" ON exit_authorizations
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

-- ── 091: health_record_update_requests (INSERT corrigida aqui; SELECT na 195) ─
DROP POLICY IF EXISTS "guardian_read_health_requests" ON health_record_update_requests;
DROP POLICY IF EXISTS "guardian_insert_health_requests" ON health_record_update_requests;
CREATE POLICY "guardian_insert_health_requests" ON health_record_update_requests
  FOR INSERT WITH CHECK (guardian_id = auth.uid());

-- ── 095: store_orders + store_order_items (nomes ja batiam) ──────────────────
DROP POLICY IF EXISTS "store_orders_guardian_read" ON store_orders;
CREATE POLICY "store_orders_guardian_read" ON store_orders
  FOR SELECT USING (guardian_id = auth.uid());

DROP POLICY IF EXISTS "store_order_items_guardian_read" ON store_order_items;
CREATE POLICY "store_order_items_guardian_read" ON store_order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM store_orders WHERE guardian_id = auth.uid())
  );

-- ── 096: store_pickup_protocols (nome real e pickup_protocols_*; corrigido na 195) ──
DROP POLICY IF EXISTS "store_pickup_protocols_guardian_read" ON store_pickup_protocols;

COMMENT ON POLICY "store_orders_guardian_read" ON store_orders IS
  'Fixado em migration 194: usa guardian_id = auth.uid() direto, ja que guardian_profiles.id IS auth.users.id (sem coluna user_id).';
