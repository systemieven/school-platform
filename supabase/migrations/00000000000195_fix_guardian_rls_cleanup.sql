-- Migration 195: Limpeza/correcao do fix da migration 194.
-- A 194 nao casou com os nomes reais de algumas policies originais
-- (088 "guardian view own ...", 089 idem, 091 "guardian_view_own_*",
-- 096 "pickup_protocols_*"), entao ficaram conviventes: a quebrada
-- original + a nova com nome inventado por mim. Esta migration remove
-- ambas e recria com os nomes originais corretos + logica nova.

-- ── 088: nome original e "guardian view own absence_communications" ──────────
DROP POLICY IF EXISTS "guardian view own absence_communications" ON absence_communications;
DROP POLICY IF EXISTS "guardian read absence_communications" ON absence_communications;
CREATE POLICY "guardian view own absence_communications" ON absence_communications
  FOR SELECT USING (guardian_id = auth.uid());

-- ── 089: nome original e "guardian view own exit_authorizations" ─────────────
DROP POLICY IF EXISTS "guardian view own exit_authorizations" ON exit_authorizations;
DROP POLICY IF EXISTS "guardian read exit_authorizations" ON exit_authorizations;
CREATE POLICY "guardian view own exit_authorizations" ON exit_authorizations
  FOR SELECT USING (guardian_id = auth.uid());

-- ── 091: nome original e "guardian_view_own_health_requests" ─────────────────
DROP POLICY IF EXISTS "guardian_view_own_health_requests" ON health_record_update_requests;
DROP POLICY IF EXISTS "guardian_read_health_requests" ON health_record_update_requests;
CREATE POLICY "guardian_view_own_health_requests" ON health_record_update_requests
  FOR SELECT USING (guardian_id = auth.uid());

-- ── 096: nome original e "pickup_protocols_guardian_read" ────────────────────
DROP POLICY IF EXISTS "pickup_protocols_guardian_read" ON store_pickup_protocols;
DROP POLICY IF EXISTS "store_pickup_protocols_guardian_read" ON store_pickup_protocols;
CREATE POLICY "pickup_protocols_guardian_read" ON store_pickup_protocols
  FOR SELECT USING (
    order_id IN (SELECT id FROM store_orders WHERE guardian_id = auth.uid())
  );

COMMENT ON POLICY "store_orders_guardian_read" ON store_orders IS
  'Fixado em migrations 194+195: usa guardian_id = auth.uid() direto (guardian_profiles.id IS auth.users.id, sem coluna user_id).';
