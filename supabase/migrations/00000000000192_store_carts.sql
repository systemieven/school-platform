-- Migration 192: store_carts (Carrinho Hibrido — §10.19)
-- Snapshot do carrinho do responsavel autenticado.
-- Pre-login a UI mantem o carrinho em localStorage; no login, useCart faz
-- merge bidirecional com este registro (uniao por variantId, qty=max).
-- Nota: guardian_profiles.id JA e a FK pra auth.users(id), entao
-- comparamos guardian_id = auth.uid() direto (sem subquery).

CREATE TABLE IF NOT EXISTS store_carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL UNIQUE REFERENCES guardian_profiles(id) ON DELETE CASCADE,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_carts_guardian_id ON store_carts(guardian_id);

ALTER TABLE store_carts ENABLE ROW LEVEL SECURITY;

-- Self: guardian autenticado le/escreve seu proprio carrinho
CREATE POLICY "store_carts_self_all" ON store_carts
  FOR ALL
  USING (guardian_id = auth.uid())
  WITH CHECK (guardian_id = auth.uid());

-- Admin: super_admin/admin podem visualizar (auditoria/suporte). Sem write.
CREATE POLICY "store_carts_admin_select" ON store_carts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin','admin')
    )
  );

CREATE TRIGGER set_store_carts_updated_at
  BEFORE UPDATE ON store_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE store_carts IS
  'Snapshot 1:1 do carrinho do responsavel autenticado. Mergeado com localStorage no login (§10.19). JSONB items: array de {variantId, productName, variantDescription, sku, quantity, unitPrice}.';
COMMENT ON COLUMN store_carts.items IS
  'Array JSONB com itens do carrinho. Schema validado client-side via tipo CartItem em useCart.ts.';
