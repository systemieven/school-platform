import { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, Package } from 'lucide-react';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { supabase } from '../../../../lib/supabase';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import type { StoreProductVariant } from '../../../types/admin.types';

interface Props {
  open: boolean;
  variant: StoreProductVariant | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AjusteEstoqueDrawer({ open, variant, onClose, onSaved }: Props) {
  const { user } = useAdminAuth();
  const [quantity, setQuantity] = useState(0);
  const [justification, setJustification] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) { setQuantity(0); setJustification(''); setSaved(false); }
  }, [open]);

  const handleSave = useCallback(async () => {
    if (!variant || quantity === 0 || !justification.trim()) return;
    setSaving(true);
    try {
      const newStock = variant.stock_quantity + quantity;
      await Promise.all([
        supabase.from('store_inventory_movements').insert({
          variant_id: variant.id,
          type: 'adjustment',
          quantity,
          balance_after: newStock,
          reference_type: 'manual',
          justification: justification.trim(),
          recorded_by: user?.id ?? null,
          created_at: new Date().toISOString(),
        }),
        supabase.from('store_product_variants').update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString(),
        }).eq('id', variant.id),
      ]);
      setSaved(true);
      setTimeout(() => { onSaved(); onClose(); setSaved(false); }, 900);
    } finally {
      setSaving(false);
    }
  }, [variant, quantity, justification, user, onSaved, onClose]);

  const canSave = variant !== null && quantity !== 0 && justification.trim().length > 0;

  const footer = (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving || !canSave}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
        }`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Package className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Ajustar Estoque'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Ajuste de Estoque" icon={Package} footer={footer}>
      <DrawerCard title="Variante" icon={Package}>
        <div className="p-4 space-y-3">
          {variant ? (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-sm">
              <p className="font-medium text-gray-800 dark:text-white">{variant.sku}</p>
              <p className="text-xs text-gray-500 mt-0.5">Estoque atual: <strong>{variant.stock_quantity}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma variante selecionada</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Quantidade — Entrada (+) / Saída (−)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white"
              placeholder="Ex: 10 ou -5"
            />
            {variant && quantity !== 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Novo estoque: <strong className={quantity > 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {variant.stock_quantity + quantity}
                </strong>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Justificativa *</label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-white resize-none"
              placeholder="Motivo do ajuste…"
            />
          </div>
        </div>
      </DrawerCard>
    </Drawer>
  );
}
