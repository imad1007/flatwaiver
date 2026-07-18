"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CustomerRowActions } from "@/components/admin/customer-row-actions";
import type { CustomerRow } from "@/lib/admin-data";

const fmt = (n: number) => n.toLocaleString("en-US");

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-primary/10 text-primary",
  past_due: "bg-warning/20 text-warning",
  canceled: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string | null }) {
  const label =
    status === "past_due" ? "Past due" : status ? status : "No sub";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        STATUS_STYLES[status ?? ""] ?? "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.ownerEmail ?? "").toLowerCase().includes(needle)
    );
  }, [q, rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {fmt(filtered.length)}
          {filtered.length === 1 ? " customer" : " customers"}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Signatures</TableHead>
              <TableHead className="text-right">Waivers</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.orgId}>
                  <TableCell className="max-w-[15rem]">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.suspended && (
                        <span className="inline-flex shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                          Suspended
                        </span>
                      )}
                    </div>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.ownerEmail ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                    {r.status === "trialing" && r.trialEndsAt && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        ends {fmtDate(r.trialEndsAt)}
                      </span>
                    )}
                    {r.status === "active" && r.currentPeriodEnd && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        renews {fmtDate(r.currentPeriodEnd)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{fmt(r.signatureCount)}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {fmt(r.signaturesThisMonth)} this mo
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(r.publishedCount)}/{fmt(r.templateCount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <CustomerRowActions
                      orgId={r.orgId}
                      name={r.name}
                      ownerUserId={r.ownerUserId}
                      suspended={r.suspended}
                      deletable={r.deletable}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
