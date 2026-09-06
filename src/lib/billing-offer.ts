export type BillingProductOffer = {
  price: number;
  currency: string;
  billingType: string;
  billingPeriod: string;
  status: string;
};

/** Return operator-facing reasons a provider product contradicts our offer. */
export function billingOfferMismatches(
  product: BillingProductOffer,
  expectedMonthlyUsd: number
): string[] {
  const expectedCents = expectedMonthlyUsd * 100;
  const mismatches: string[] = [];

  if (product.price !== expectedCents) {
    mismatches.push(`price=${product.price}, expected=${expectedCents}`);
  }
  if (product.currency.toUpperCase() !== "USD") {
    mismatches.push(`currency=${product.currency}, expected=USD`);
  }
  if (product.billingType !== "recurring") {
    mismatches.push(`billingType=${product.billingType}, expected=recurring`);
  }
  if (product.billingPeriod !== "every-month") {
    mismatches.push(`billingPeriod=${product.billingPeriod}, expected=every-month`);
  }
  if (product.status !== "active") {
    mismatches.push(`status=${product.status}, expected=active`);
  }

  return mismatches;
}
