import type { CustomerRow } from "./admin-data";

export function customerPlan(row: Pick<CustomerRow, "status" | "trialEndsAt">, now: number): string {
  if (row.status === "trialing" && row.trialEndsAt && Date.parse(row.trialEndsAt) <= now) return "trial_ended";
  return row.status ?? "none";
}

export const CUSTOMER_PLANS: Record<string, string> = {
  trialing: "Live trial", trial_ended: "Trial ended", active: "Active",
  past_due: "Past due", canceled: "Canceled", none: "No subscription",
};

export function filterCustomers(rows: CustomerRow[], filters: {
  query: string; plan: string; activity: string; access: string; sort: string;
}, now: number) {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter(row => {
    const plan = customerPlan(row, now);
    const endingSoon = plan === "trialing" && !!row.trialEndsAt && Date.parse(row.trialEndsAt) <= now + 7 * 86400000;
    return (!needle || `${row.name} ${row.ownerEmail ?? ""}`.toLowerCase().includes(needle)) &&
      (filters.plan === "all" || (filters.plan === "ending_soon" ? endingSoon : plan === filters.plan)) &&
      (filters.access === "all" || row.suspended === (filters.access === "suspended")) &&
      (filters.activity === "all" || (filters.activity === "unused" ? row.signatureCount === 0 : row.signaturesThisMonth > 0));
  }).sort((a, b) => {
    const order = filters.sort === "name" ? a.name.localeCompare(b.name) :
      filters.sort === "signatures" ? b.signatureCount - a.signatureCount :
      filters.sort === "recent_activity" ? (Date.parse(b.lastSignedAt ?? "") || 0) - (Date.parse(a.lastSignedAt ?? "") || 0) :
      filters.sort === "oldest" ? Date.parse(a.createdAt) - Date.parse(b.createdAt) :
      Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return order || a.orgId.localeCompare(b.orgId);
  });
}
