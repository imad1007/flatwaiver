import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAdminOverview } from "@/lib/admin-data";
import { AdminSetupNotice } from "@/components/admin-setup-notice";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function AdminOverviewPage() {
  const { ready, rows, stats } = await getAdminOverview();

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
              hint="active × $39/mo"
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
