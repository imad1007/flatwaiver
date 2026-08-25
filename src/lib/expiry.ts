// Waiver renewal math. PURE and client-safe — shared by the renewal setting UI,
// the renewals dashboard, and the reminder cron.

/** A signature within this many days of expiry counts as "expiring soon". */
export const RESIGN_WINDOW_DAYS = 30;

export type ExpiryState = "active" | "expiring" | "expired";

/** When a signature made at `signedAtIso` expires, or null if it never does. */
export function expiresAt(
  signedAtIso: string,
  expiryMonths: number | null | undefined
): Date | null {
  if (!expiryMonths || expiryMonths <= 0) return null;
  const d = new Date(signedAtIso);
  d.setMonth(d.getMonth() + expiryMonths);
  return d;
}

/** Renewal state, or null when the template has no expiry configured. */
export function expiryState(
  signedAtIso: string,
  expiryMonths: number | null | undefined,
  now: Date = new Date()
): ExpiryState | null {
  const exp = expiresAt(signedAtIso, expiryMonths);
  if (!exp) return null;
  const msLeft = exp.getTime() - now.getTime();
  if (msLeft <= 0) return "expired";
  if (msLeft <= RESIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000) return "expiring";
  return "active";
}

export const EXPIRY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Never expires" },
  { value: 3, label: "Every 3 months" },
  { value: 6, label: "Every 6 months" },
  { value: 12, label: "Every 12 months" },
  { value: 24, label: "Every 24 months" },
];

export function expiryLabel(expiryMonths: number | null | undefined): string {
  if (!expiryMonths) return "Never expires";
  const match = EXPIRY_OPTIONS.find((o) => o.value === expiryMonths);
  return match ? match.label : `Every ${expiryMonths} months`;
}
