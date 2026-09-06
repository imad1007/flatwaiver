import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAdminActivationFunnel, getAdminOverview } from "@/lib/admin-data";
import { AdminSetupNotice } from "@/components/admin-setup-notice";
import { APP } from "@/lib/config";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function AdminOverviewPage() {
  const [{ ready, rows, stats }, activation] = await Promise.all([
    getAdminOverview(),
    getAdminActivationFunnel(),
  ]);

  const topBySignatures = [...rows]
    .filter((r) => r.signatureCount > 0)
    .sort((a, b) => b.signatureCount - a.signatureCount)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide snapshot across every customer organization.
        </p>
      </div>

      {!ready ? (
        <AdminSetupNotice />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Customers" value={fmt(stats.totalOrgs)} />
            <Kpi
              label="Paying"
              value={fmt(stats.active)}
              hint={`${fmt(stats.trialing)} on trial`}
              accent="success"
            />
            <Kpi
              label="Est. MRR"
              value={`$${fmt(stats.estMrrUsd)}`}
              hint={`active × $${APP.priceMonthlyUsd}/mo`}
              accent="primary"
            />
            <Kpi
              label="Signatures"
              value={fmt(stats.totalSignatures)}
              hint={`${fmt(stats.signaturesThisMonth)} this month`}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground">
              Subscription status
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <MiniStat label="Trialing" value={stats.trialing} />
              <MiniStat label="Active" value={stats.active} />
              <MiniStat label="Past due" value={stats.pastDue} tone="warning" />
              <MiniStat
                label="Canceled"
                value={stats.canceled}
                tone="muted"
              />
              <MiniStat
                label="Suspended"
                value={stats.suspended}
                tone="destructive"
              />
            </div>
          </div>

          {activation.ready && (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Activation funnel
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Server-confirmed first occurrences; no signer identity or waiver content.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Median signup â†’ signature: {formatDuration(activation.medianHoursToSignature)}
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <FunnelStep
                  label="Organizations"
                  value={activation.totalOrgs}
                  rate={100}
                  timing="Account created"
                />
                <FunnelStep
                  label="Published a waiver"
                  value={activation.publishedOrgs}
                  rate={percentage(activation.publishedOrgs, activation.totalOrgs)}
                  timing={`Median ${formatDuration(activation.medianHoursToPublish)}`}
                />
                <FunnelStep
                  label="Collected a signature"
                  value={activation.signedOrgs}
                  rate={percentage(activation.signedOrgs, activation.totalOrgs)}
                  timing={`Median ${formatDuration(activation.medianHoursToSignature)}`}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold">Top customers by volume</h2>
              <Link
                href="/admin/customers"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
              >
                All customers
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {topBySignatures.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No signatures collected yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {topBySignatures.map((r) => (
                  <li
                    key={r.orgId}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.ownerEmail ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {fmt(r.signatureCount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(r.signaturesThisMonth)} this month
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : Math.round((value / total) * 100);
}

function formatDuration(hours: number | null): string {
  if (hours === null) return "not available";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function FunnelStep({
  label,
  value,
  rate,
  timing,
}: {
  label: string;
  value: number;
  rate: number;
  timing: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs font-semibold text-primary">{rate}%</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{fmt(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{timing}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-2 text-3xl font-bold tabular-nums " +
          (accent === "primary"
            ? "text-primary"
            : accent === "success"
              ? "text-success"
              : "")
        }
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning" | "destructive" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
      <p
        className={
          "text-2xl font-bold tabular-nums " +
          (tone === "warning"
            ? "text-warning"
            : tone === "destructive"
              ? "text-destructive"
              : tone === "muted"
                ? "text-muted-foreground"
                : "")
        }
      >
        {value.toLocaleString("en-US")}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
