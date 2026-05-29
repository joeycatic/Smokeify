import { FREE_SHIPPING_THRESHOLD_EUR } from "@/lib/shippingPolicy";

export function getFreeShippingProgress(subtotal: number) {
  const safeSubtotal = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD_EUR - safeSubtotal);
  const progress =
    FREE_SHIPPING_THRESHOLD_EUR <= 0
      ? 100
      : Math.min(100, Math.max(0, (safeSubtotal / FREE_SHIPPING_THRESHOLD_EUR) * 100));

  return {
    threshold: FREE_SHIPPING_THRESHOLD_EUR,
    subtotal: safeSubtotal,
    remaining,
    reached: remaining <= 0,
    progress,
  };
}

export function getCartMilestoneCopy(itemCount: number) {
  if (itemCount <= 0) return null;
  if (itemCount === 1) return "Erste Komponente im Vault.";
  if (itemCount === 2) return "Dein Setup nimmt Form an.";
  return "Setup wächst.";
}


