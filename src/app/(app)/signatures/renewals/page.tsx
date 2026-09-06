import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { getOrgCaller } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findRenewalsDue } from "@/lib/renewals";
import { EmptyState } from "@/components/empty-state";
import { RenewalsTable } from "@/components/renewals-table";
import { canManageTemplates } from "@/lib/permissions";
import { DataLoadError } from "@/components/data-load-error";

export default async function RenewalsPage() {
  const caller = await getOrgCaller();
  if (!caller) redirect("/login");

  // Any templates with a renewal window at all?
  const admin = createAdminClient();
  const { count: withExpiry, error: expiryCountError } = await admin
    .from("waiver_templates")
    .select("id", { count: "exact", head: true })
    .eq("org_id", caller.orgId)
    .not("expiry_months", "is", null);
  if (expiryCountError) {
    console.error("Renewal-enabled waiver count failed", expiryCountError);
  }

  let items: Awaited<ReturnType<typeof findRenewalsDue>> | null;
  try {
    items = await findRenewalsDue(caller.orgId);
  } catch (error) {
    console.error("Renewals data load failed", error);
    items = null;
  }

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

      {expiryCountError || items === null ? (
        <DataLoadError
          className="mt-8"
          retryHref="/signatures/renewals"
          title="We couldn't load renewals"
          description="No reminders were changed. Try loading the renewal list again."
        />
      ) : (withExpiry ?? 0) === 0 ? (
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
