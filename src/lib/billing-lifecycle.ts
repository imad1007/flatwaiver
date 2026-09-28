export const TRIAL_WARNING_HOURS = 48;
export const TRIAL_SUSPENSION_HOURS = 72;

export type BillingLifecycleSubscription = {
  status: string;
  trial_ends_at: string | null;
  public_signing_suspended_at?: string | null;
};

export type BillingLifecyclePhase =
  | "active"
  | "trial"
  | "grace"
  | "warning"
  | "suspended";

export function billingLifecyclePhase(
  subscription: BillingLifecycleSubscription | null,
  now = Date.now(),
): BillingLifecyclePhase {
  if (subscription?.status === "active") return "active";
  if (subscription?.status !== "trialing" || !subscription.trial_ends_at) {
    return "suspended";
  }

  const trialEnd = Date.parse(subscription.trial_ends_at);
  if (!Number.isFinite(trialEnd)) return "suspended";
  if (now < trialEnd) return "trial";
  if (subscription.public_signing_suspended_at) return "suspended";

  const elapsedHours = (now - trialEnd) / 3_600_000;
  if (elapsedHours >= TRIAL_SUSPENSION_HOURS) return "suspended";
  if (elapsedHours >= TRIAL_WARNING_HOURS) return "warning";
  return "grace";
}

export function canAcceptPublicSignatures(
  subscription: BillingLifecycleSubscription | null,
  now = Date.now(),
): boolean {
  return billingLifecyclePhase(subscription, now) !== "suspended";
}
