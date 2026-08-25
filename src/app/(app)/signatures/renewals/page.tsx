import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { getOrgCaller } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRenewalsDue } from "@/lib/renewals";
import { EmptyState } from "@/components/empty-state";
import { RenewalsTable } from "@/components/renewals-table";
import { canManageTemplates } from "@/lib/permissions";

export default async function RenewalsPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  // Any templates with a renewal window at all?
  const admin = createAdminClient();
  const { count: withExpiry } = await admin
    .from("waiver_templates")
    .select("id", { count: "exact", head: true })
    .eq("org_id", caller.orgId)
    .not("expiry_months", "is", null);

  const items = await findRenewalsDue(caller.orgId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Renewals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signers whose waiver is expiring soon or has expired.
          </p>
        </div>
        <Link href="/signatures" className="text-sm text-muted-foreground underline">
          ← All signatures
        </Link>
      </div>

      {(withExpiry ?? 0) === 0 ? (
        <EmptyState
          className="mt-8"
          icon={RefreshCw}
          title="No waiver has renewal turned on"
          description="Open a waiver and set a renewal window (e.g. every 12 months) to start tracking who needs to re-sign."
        />
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={RefreshCw}
          title="Everyone's up to date"
          description="No signatures are expiring in the next 30 days. Check back later — or reminders go out automatically each day."
        />
      ) : (
        <RenewalsTable
          canManage={canManageTemplates(caller.role)}
          items={items.map((i) => ({
            signedWaiverId: i.signedWaiverId,
            signerName: i.signerName,
            signerEmail: i.signerEmail,
            templateName: i.templateName,
            expiresAtIso: i.expiresAtIso,
            state: i.state,
            remindedAt: i.remindedAt,
          }))}
        />
      )}
    </div>
  );
}
