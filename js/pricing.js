// Pricing helper — mirrors landing-page Pricing.astro (same constants as the
// old web-terminal's lib/pricing.js). Used for the Subscribe/Reactivate button
// label; active subscriptions render controller-supplied price_cents directly
// so existing subscribers stay grandfathered.

export const VM_PRICING_EUR = { xs: 5.50, s: 11.00, m: 19.80, l: 51.00, xl: 102.00 };
export const DISK_PRICE_PER_GB_EUR = 0.04;
export const MARGIN_MULTIPLIER = 1.5;
export const VAT_MULTIPLIER = 1.19;

export function computeMonthlyPrice(vmSize, volumeSizeGb) {
  const vmCost = VM_PRICING_EUR[vmSize];
  if (vmCost === undefined || !Number.isFinite(volumeSizeGb)) return null;
  const total = (vmCost + volumeSizeGb * DISK_PRICE_PER_GB_EUR) * MARGIN_MULTIPLIER * VAT_MULTIPLIER;
  return Math.round(total * 100) / 100;
}

export function centsToEur(cents) {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}
