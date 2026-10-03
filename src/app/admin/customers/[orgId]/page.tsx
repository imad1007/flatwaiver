import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileCheck2, Files, Users, CalendarDays } from "lucide-react";
import { getAdminCustomerDetail } from "@/lib/admin-customer-detail";
import { CustomerTools } from "@/components/admin/customer-tools";
import { CustomerRowActions } from "@/components/admin/customer-row-actions";
import { customerPlan, CUSTOMER_PLANS } from "@/lib/customer-table";
import { canAcceptPublicSignatures } from "@/lib/billing-lifecycle";

export const dynamic = "force-dynamic";
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
}) : "Not available";
const number = (value: number) => Number(value).toLocaleString("en-US");

export default async function CustomerPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const detail = await getAdminCustomerDetail(orgId);
  if (!detail) notFound();
  const { customer: c, waivers, recent, owner, memberCount, now } = detail;
  const suspended = !!owner?.banned_until && Date.parse(owner.banned_until) > now;
  const email = owner?.email ?? c.owner_email;
  const plan = customerPlan({ status: c.status, trialEndsAt: c.trial_ends_at }, now);
  const signing = canAcceptPublicSignatures(c.status ? { status: c.status, trial_ends_at: c.trial_ends_at } : null, now);
  const names = new Map(waivers.map(w => [w.id, w.name]));

  return <div className="mx-auto max-w-7xl space-y-6 pb-8">
    <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" />All customers</Link>
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="h-1 bg-primary" />
      <div className="flex flex-wrap items-start justify-between gap-5 p-6">
        <div className="flex min-w-0 gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary">{c.name.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Customer workspace</p><h1 className="mt-1 break-words text-2xl font-semibold tracking-tight">{c.name}</h1><p className="mt-1 break-all text-sm text-muted-foreground">{email ?? "No owner email"}</p></div>
        </div>
        <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan === "active" ? "bg-emerald-100 text-emerald-800" : plan === "trial_ended" ? "bg-orange-100 text-orange-800" : "bg-primary/10 text-primary"}`}>{CUSTOMER_PLANS[plan] ?? plan}</span><CustomerRowActions orgId={orgId} name={c.name} ownerUserId={c.owner_user_id} suspended={suspended} deletable={Number(c.signature_count) === 0 && Number(c.version_count) === 0} /></div>
      </div>
      <div className="border-t bg-muted/20 px-6 py-4"><CustomerTools orgId={orgId} email={email} /></div>
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Signed waivers", value: c.signature_count, note: "All time", icon: FileCheck2 },
        { label: "Signed this month", value: c.signatures_this_month, note: "Calendar month · UTC", icon: CalendarDays },
        { label: "Published waivers", value: c.published_count, note: `${number(c.template_count)} templates total`, icon: Files },
        { label: "Team members", value: memberCount, note: "Workspace members", icon: Users },
      ].map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">{label}<Icon className="size-4 text-primary" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{number(value)}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}
    </div>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="border-b p-5"><h2 className="font-semibold">Waiver performance</h2><p className="mt-1 text-xs text-muted-foreground">Latest 20 templates · signature counts are all-time totals</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="p-4 font-medium">Waiver</th><th className="p-4 font-medium">Status</th><th className="p-4 text-right font-medium">Signed</th><th className="p-4"><span className="sr-only">Public page</span></th></tr></thead><tbody>
            {waivers.map(w => <tr key={w.id} className="border-t"><td className="max-w-80 break-words p-4 font-medium">{w.name}</td><td className="p-4 text-xs capitalize text-muted-foreground">{w.status}</td><td className="p-4 text-right font-semibold tabular-nums">{number(w.signatureCount)}</td><td className="p-4">{w.status === "published" && w.slug && <Link target="_blank" rel="noopener noreferrer" href={`/w/${encodeURIComponent(w.slug)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-primary">Public page<ArrowUpRight className="size-3.5" /></Link>}</td></tr>)}
            {!waivers.length && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">This customer has not created a waiver yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="rounded-2xl border bg-card">
          <div className="border-b p-5"><h2 className="font-semibold">Recent signing activity</h2><p className="mt-1 text-xs text-muted-foreground">Latest 20 completed signatures · dates and times in UTC</p></div>
          <div className="max-h-96 overflow-y-auto divide-y">
            {recent.map(s => <div key={s.id} className="flex items-center gap-3 px-5 py-4"><div className="rounded-full bg-emerald-50 p-2 text-emerald-700"><FileCheck2 className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{names.get(s.template_id) ?? "Waiver signed"}</p><p className="mt-1 text-xs text-muted-foreground">{date(s.signed_at)}</p></div><span className={`rounded-full px-2 py-1 text-xs ${s.flagged ? "bg-orange-100 text-orange-800" : "bg-emerald-50 text-emerald-700"}`}>{s.flagged ? "Flagged" : "Signed"}</span></div>)}
            {!recent.length && <p className="p-10 text-center text-sm text-muted-foreground">No signed waivers yet.</p>}
          </div>
        </section>
      </div>
      <aside className="space-y-5">
        <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Account & billing</h2><dl className="mt-5 space-y-5 text-sm">
          {[["Owner login", suspended ? "Suspended" : owner ? "Not suspended" : "No owner"], ["Public signing · billing", signing ? "Allowed" : "Blocked — payment required"], ["Trial ends", date(c.trial_ends_at)], ["Paid period ends", date(c.current_period_end)], ["Joined", date(c.created_at)], ["Last signed", date(c.last_signed_at)], ["Owner last login", date(owner?.last_sign_in_at)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
        </dl><p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">Login suspension and billing access are separate. Published status alone does not guarantee a public page can accept signatures.</p></section>
        <section className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Email notifications</h2><p className="mt-3 text-sm font-medium">{owner?.user_metadata?.signed_waiver_emails === true ? "Owner opted in" : "Owner notifications off"}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">This is the owner’s preference, not a delivery receipt. Signer copies depend on the email entered in the waiver.</p></section>
      </aside>
    </div>
  </div>;
}
