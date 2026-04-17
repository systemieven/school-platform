import type { StoreChannel, StorePaymentSurcharge } from '../admin/types/admin.types';

/**
 * Compute the surcharge for a given payment method and channel.
 * Returns { pct: 0, amount: 0 } if no active rule matches.
 */
export function computeSurcharge(
  baseAmount: number,
  paymentMethod: string,
  surcharges: StorePaymentSurcharge[],
  channel: StoreChannel
): { pct: number; amount: number } {
  if (!paymentMethod) return { pct: 0, amount: 0 };
  const rule = surcharges.find(
    s =>
      s.is_active &&
      s.payment_method === paymentMethod &&
      (s.applies_to === 'all' || s.applies_to === channel)
  );
  if (!rule || rule.surcharge_pct === 0) return { pct: 0, amount: 0 };
  const amount = parseFloat((baseAmount * rule.surcharge_pct / 100).toFixed(2));
  return { pct: rule.surcharge_pct, amount };
}
