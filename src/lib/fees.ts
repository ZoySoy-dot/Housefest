// Service fee applied to online (PayMongo) orders.
// Formula: max(FEE_MIN, subtotal × FEE_RATE)
// Guarantees the council nets at least ~₱20 after PayMongo's cut
// (worst-case GCash 2.23%) while scaling with larger orders.

export const FEE_RATE = 0.03;            // 3%
export const FEE_MIN = 2100;             // ₱21.00 in centavos

/** Compute the service fee (centavos) for a given subtotal (centavos). */
export function serviceFeeFor(subtotalCentavos: number): number {
  const pct = Math.round(subtotalCentavos * FEE_RATE);
  return Math.max(FEE_MIN, pct);
}

/** Format helper mirroring cart.ts formatPHP without importing the client-side module. */
export function formatCentavos(centavos: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}
