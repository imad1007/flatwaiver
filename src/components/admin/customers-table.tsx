"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, ArrowRight, SlidersHorizontal } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerRowActions } from "@/components/admin/customer-row-actions";
import { customerPlan, CUSTOMER_PLANS, filterCustomers } from "@/lib/customer-table";
import type { CustomerRow } from "@/lib/admin-data";

const fmt = (n: number) => n.toLocaleString("en-US");
const date = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
const styles: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  trialing: "bg-primary/10 text-primary",
  trial_ended: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
  past_due: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};
const defaults = { query: "", plan: "all", activity: "all", access: "all", sort: "newest" };

export function CustomersTable({ rows, now }: { rows: CustomerRow[]; now: number }) {
  const [filters, setFilters] = useState(defaults);
  const [page, setPage] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const filtered = filterCustomers(rows, filters, now);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const current = Math.min(page, pages - 1);
  const update = (key: keyof typeof defaults, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(0); };
  const reset = () => { setFilters(defaults); setPage(0); };
  const count = (plan: string) => plan === "all" ? rows.length : rows.filter(r => customerPlan(r, now) === plan).length;
  const select = (label: string, key: keyof typeof defaults, options: Record<string, string>) => (
    <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select value={filters[key]} onChange={e => update(key, e.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        {Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["all", "All customers"], ["trialing", "Live trials"], ["trial_ended", "Trials ended · no subscription"], ["active", "Active plans"]].map(([key, label]) => (
          <button key={key} onClick={() => update("plan", key)} aria-pressed={filters.plan === key} className={cn("rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50", filters.plan === key ? "border-primary ring-1 ring-primary/20" : "border-border")}>
            <span className="block text-xs font-medium text-muted-foreground">{label}</span>
            <span className={cn("mt-2 block text-3xl font-semibold tabular-nums", key === "trial_ended" && "text-orange-600 dark:text-orange-400")}>{fmt(count(key))}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input aria-label="Search customers by name or email" placeholder="Search business or owner email…" value={filters.query} onChange={e => update("query", e.target.value)} className="h-10 pl-9" />
          </div>
          <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw className={cn("size-4", pending && "animate-spin")} />Refresh</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {select("Plan status", "plan", { all: "All plans", ...CUSTOMER_PLANS, ending_soon: "Trial ends in 7 days" })}
          {select("Waiver activity", "activity", { all: "Any activity", unused: "No signatures yet", month: "Signed this month" })}
          {select("Account access", "access", { all: "All accounts", enabled: "Not suspended", suspended: "Suspended" })}
          {select("Sort by", "sort", { newest: "Newest first", oldest: "Oldest first", name: "Business A–Z", signatures: "Most signatures", recent_activity: "Most recent signature" })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span role="status">{fmt(filtered.length)} of {fmt(rows.length)} customers · dates in UTC</span>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-primary hover:bg-primary/5"><SlidersHorizontal className="size-3.5" />Reset filters</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Business / owner</TableHead><TableHead>Plan status</TableHead>
            <TableHead className="text-right">Signatures</TableHead><TableHead className="text-right">Waivers</TableHead>
            <TableHead>Last signed</TableHead><TableHead>Joined</TableHead><TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="py-14 text-center"><p className="font-medium">No customers match these filters</p><button onClick={reset} className="mt-2 text-sm text-primary underline">Clear filters</button></TableCell></TableRow> :
              filtered.slice(current * 20, current * 20 + 20).map(row => {
                const plan = customerPlan(row, now);
                return <TableRow key={row.orgId}>
                  <TableCell className="min-w-52 max-w-80 py-4">
                    <p className="truncate font-medium" title={row.name}>{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground" title={row.ownerEmail ?? undefined}>{row.ownerEmail ?? "No owner email"}</p>
                    {row.suspended && <span className="mt-1 inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Suspended</span>}
                  </TableCell>
                  <TableCell className="min-w-40">
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", styles[plan] ?? "bg-muted text-muted-foreground")}>{CUSTOMER_PLANS[plan] ?? plan}</span>
                    {row.status === "trialing" && <p className="mt-1 text-xs text-muted-foreground">{plan === "trial_ended" ? "Ended" : "Ends"} {date(row.trialEndsAt)}</p>}
                    {row.status === "active" && row.currentPeriodEnd && <p className="mt-1 text-xs text-muted-foreground">Period ends {date(row.currentPeriodEnd)}</p>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums"><p className="font-medium">{fmt(row.signatureCount)}</p><p className="text-xs text-muted-foreground">{fmt(row.signaturesThisMonth)} this month</p></TableCell>
                  <TableCell className="text-right tabular-nums"><p>{fmt(row.publishedCount)} live</p><p className="text-xs text-muted-foreground">{fmt(row.templateCount)} total</p></TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.lastSignedAt ? date(row.lastSignedAt) : "No signatures yet"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{date(row.createdAt)}</TableCell>
                  <TableCell><CustomerRowActions orgId={row.orgId} name={row.name} ownerUserId={row.ownerUserId} suspended={row.suspended} deletable={row.deletable} /></TableCell>
                </TableRow>;
              })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-xs text-muted-foreground">
          <span>{filtered.length ? `${current * 20 + 1}–${Math.min((current + 1) * 20, filtered.length)} of ${fmt(filtered.length)}` : "0 results"} · 20 per page</span>
          <div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button><span>{current + 1} / {pages}</span><Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next<ArrowRight className="size-3.5" /></Button></div>
        </div>
      </div>
    </div>
  );
}
