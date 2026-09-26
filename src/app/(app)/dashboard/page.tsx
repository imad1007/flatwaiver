import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, FilePlus2, FileSignature, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { GettingStarted, type GuideStep } from "@/components/getting-started";
import { SignaturesChart, type DayCount } from "@/components/signatures-chart";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/data-load-error";
import { cn } from "@/lib/utils";

const CHART_DAYS = 30;

export default async function DashboardPage() {
  const supabase = await createClient();
  const todayStart = startOfUtcDay(new Date());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const monthStart = new Date(todayStart);
  monthStart.setUTCDate(1);
  const chartStart = new Date(todayStart);
  chartStart.setUTCDate(chartStart.getUTCDate() - (CHART_DAYS - 1));

  const results = await Promise.all([
    supabase.from("signed_waivers").select("id", { count: "exact", head: true }).gte("signed_at", todayStart.toISOString()),
    supabase.from("signed_waivers").select("id", { count: "exact", head: true }).gte("signed_at", yesterdayStart.toISOString()).lt("signed_at", todayStart.toISOString()),
    supabase.from("checkins").select("id", { count: "exact", head: true }).gte("checked_in_at", todayStart.toISOString()),
    supabase.from("checkins").select("id", { count: "exact", head: true }).gte("checked_in_at", yesterdayStart.toISOString()).lt("checked_in_at", todayStart.toISOString()),
    supabase.from("signed_waivers").select("id", { count: "exact", head: true }).gte("signed_at", monthStart.toISOString()),
    supabase.from("signed_waivers").select("id", { count: "exact", head: true }),
    supabase.from("signed_waivers").select("id", { count: "exact", head: true }).eq("flagged", true).gte("signed_at", monthStart.toISOString()),
    supabase.from("signed_waivers").select("id, signer_name, flagged, signed_at, signing_channel, template_id").order("signed_at", { ascending: false }).limit(8),
    supabase.from("waiver_templates").select("id, name, status"),
    supabase.from("signed_waivers").select("signed_at, signing_channel").gte("signed_at", chartStart.toISOString()).range(0, 9999),
    supabase.from("organizations").select("branding").maybeSingle(),
  ]);

  if (results.some((result) => result.error)) {
    console.error("Dashboard data load failed", results.filter((result) => result.error).map((result) => result.error));
    return (
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DataLoadError className="mt-6" retryHref="/dashboard" title="We couldn't load your dashboard" description="Your account data is still safe. Try loading the dashboard again." />
      </div>
    );
  }

  const [
    { count: signedToday }, { count: signedYesterday }, { count: checkedInToday },
    { count: checkedInYesterday }, { count: signedThisMonth }, { count: totalSigned },
    { count: flaggedThisMonth }, { data: recent }, { data: templates },
    { data: recentWindow }, { data: org },
  ] = results;

  const templateNames = new Map((templates ?? []).map((template) => [template.id, template.name]));
  const publishedCount = (templates ?? []).filter((template) => template.status === "published").length;
  const firstDraft = (templates ?? []).find((template) => template.status === "draft");
  const firstPublished = (templates ?? []).find((template) => template.status === "published");
  const branding = (org?.branding ?? null) as { logo_path?: string } | null;
  const guideSteps: GuideStep[] = [
    { key: "create", title: "Create your first waiver", description: "Upload the PDF you already use — AI converts it into a signable form.", href: templates?.length ? "/waivers" : "/waivers/new", cta: "New waiver", done: Boolean(templates?.length) },
    { key: "publish", title: "Review and publish it", description: "Check the clauses and publish to lock the exact wording to every signature.", href: firstDraft ? `/waivers/${firstDraft.id}` : "/waivers", cta: "Review and publish", done: publishedCount > 0 },
    { key: "brand", title: "Add your logo", description: "Add your logo to the signing page and signed PDF.", href: "/settings/branding", cta: "Add branding", done: Boolean(branding?.logo_path) },
    { key: "collect", title: "Collect your first signature", description: "Share the link, print the QR code, or open kiosk mode at the front desk.", href: firstPublished ? `/waivers/${firstPublished.id}/share` : "/waivers", cta: "Get signing link", done: (totalSigned ?? 0) > 0 },
  ];

  const days: DayCount[] = Array.from({ length: CHART_DAYS }, (_, index) => {
    const date = new Date(chartStart);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
  const dayIndex = new Map(days.map((day, index) => [day.date, index]));
  const channelCounts: Record<string, number> = { link: 0, qr: 0, kiosk: 0 };
  for (const row of recentWindow ?? []) {
    const index = dayIndex.get(row.signed_at.slice(0, 10));
    if (index !== undefined) days[index].count += 1;
    channelCounts[row.signing_channel] = (channelCounts[row.signing_channel] ?? 0) + 1;
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="dashboard-heading" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Your day at a glance</p>
            <h1 id="dashboard-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Ready for a great day.</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Today&apos;s signing activity and front-desk progress in one place.</p>
          </div>
          <Button variant="outline" render={<Link href="/waivers/new" />}><Sparkles className="size-4 text-primary" />New waiver</Button>
        </div>
        <div className="grid border-t border-border md:grid-cols-3">
          <Metric label="Waivers signed" value={signedToday ?? 0} previous={signedYesterday ?? 0} comparison="vs yesterday" icon={FileSignature} tone="brand" />
          <Metric label="Checked in" value={checkedInToday ?? 0} previous={checkedInYesterday ?? 0} comparison="vs yesterday" icon={ClipboardCheck} tone="green" />
          <Metric label="Live waivers" value={publishedCount} comparison="ready to share" icon={Check} tone="orange" />
        </div>
      </section>

      <GettingStarted steps={guideSteps} />

      <section aria-labelledby="recent-signatures-heading" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div><h2 id="recent-signatures-heading" className="font-bold">Recent signatures</h2><p className="mt-0.5 text-sm text-muted-foreground">The latest completed waivers across your business.</p></div>
          <Link href="/signatures" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View all<ArrowRight className="size-3.5" /></Link>
        </div>
        {!recent?.length ? (
          <div className="p-5 sm:p-6">
            {publishedCount === 0 ? (
              <EmptyState icon={FilePlus2} title="Your first waiver is five minutes away" description="Upload the PDF you already use, review it, and publish your signing link." action={<Button size="lg" render={<Link href="/waivers/new" />}>Create your first waiver</Button>} />
            ) : (
              <EmptyState icon={Send} title="Your waiver is live — now share it" description="Send the link, print the QR code, or open kiosk mode. New signatures will appear here." action={<Button size="lg" render={<Link href={firstPublished ? `/waivers/${firstPublished.id}/share` : "/waivers"} />}>Get your signing link</Button>} />
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-border md:hidden">
              {recent.map((signature) => <RecentSignatureCard key={signature.id} signature={signature} waiverName={templateNames.get(signature.template_id)} />)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted/35 text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-3 font-semibold">Participant</th><th className="px-5 py-3 font-semibold">Waiver</th><th className="px-5 py-3 font-semibold">Channel</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-6 py-3 text-right font-semibold">Signed</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {recent.map((signature) => (
                    <tr key={signature.id} className="transition-colors hover:bg-muted/25">
                      <td className="px-6 py-3.5"><Link href={`/signatures/${signature.id}`} className="flex items-center gap-3 font-semibold hover:underline"><Initials name={signature.signer_name} /><span className="max-w-48 truncate">{signature.signer_name}</span></Link></td>
                      <td className="max-w-56 truncate px-5 py-3.5 text-muted-foreground">{templateNames.get(signature.template_id) ?? "Waiver"}</td>
                      <td className="px-5 py-3.5 capitalize text-muted-foreground">{signature.signing_channel}</td>
                      <td className="px-5 py-3.5"><StatusBadge flagged={signature.flagged} /></td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-right text-muted-foreground">{formatRecentDate(signature.signed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="activity-heading" className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 id="activity-heading" className="font-bold">Signing activity</h2><p className="mt-1 text-sm text-muted-foreground">Daily completed waivers over the last 30 days.</p></div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><SummaryPill value={signedThisMonth ?? 0} label="this month" /><SummaryPill value={totalSigned ?? 0} label="all time" />{(flaggedThisMonth ?? 0) > 0 && <SummaryPill value={flaggedThisMonth ?? 0} label="flagged" warning />}</div>
        </div>
        <div className="mt-5"><SignaturesChart days={days} /></div>
        {(recentWindow ?? []).length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">{(["link", "qr", "kiosk"] as const).filter((channel) => channelCounts[channel] > 0).map((channel) => <span key={channel}><strong className="font-semibold text-foreground">{channelCounts[channel]}</strong> via {channel}</span>)}</div>}
      </section>
    </div>
  );
}

function startOfUtcDay(date: Date) { const result = new Date(date); result.setUTCHours(0, 0, 0, 0); return result; }

function Metric({ label, value, previous, comparison, icon: Icon, tone }: { label: string; value: number; previous?: number; comparison: string; icon: typeof FileSignature; tone: "brand" | "green" | "orange" }) {
  const change = previous === undefined ? null : percentageChange(value, previous);
  return (
    <div className="relative min-h-40 overflow-hidden border-b border-border px-5 py-5 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0 sm:px-7">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className={cn("flex size-9 items-center justify-center rounded-xl", tone === "brand" && "bg-brand-500/10 text-primary", tone === "green" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", tone === "orange" && "bg-orange-500/10 text-orange-600 dark:text-orange-400")}><Icon className="size-4.5" /></span></div>
      <div className="mt-5 flex items-end gap-3"><strong className={cn("text-4xl font-bold tracking-tight tabular-nums", tone === "green" && "text-emerald-600 dark:text-emerald-400", tone === "orange" && "text-orange-600 dark:text-orange-400")}>{value.toLocaleString()}</strong>{change && <TrendBadge {...change} />}</div>
      <p className="mt-2 text-xs text-muted-foreground">{comparison}</p>
      <span className={cn("absolute inset-x-5 bottom-0 h-0.5 rounded-full sm:inset-x-7", tone === "brand" && "bg-primary/70", tone === "green" && "bg-emerald-500/70", tone === "orange" && "bg-orange-500/70")} />
    </div>
  );
}

function percentageChange(current: number, previous: number) {
  if (current === 0 && previous === 0) return { label: "No change", positive: null };
  if (previous === 0) return { label: "New", positive: true };
  const percentage = Math.round(((current - previous) / previous) * 100);
  return { label: `${percentage > 0 ? "+" : ""}${percentage}%`, positive: percentage >= 0 };
}

function TrendBadge({ label, positive }: { label: string; positive: boolean | null }) {
  return <span className={cn("mb-1 rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums", positive === true && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", positive === false && "bg-red-500/10 text-red-700 dark:text-red-300", positive === null && "bg-muted text-muted-foreground")}>{label}</span>;
}

function Initials({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials}</span>;
}

function StatusBadge({ flagged }: { flagged: boolean }) {
  return flagged ? <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Flagged</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><Check className="size-3" />Signed</span>;
}

function RecentSignatureCard({ signature, waiverName }: { signature: { id: string; signer_name: string; flagged: boolean; signed_at: string; signing_channel: string }; waiverName?: string }) {
  return (
    <Link href={`/signatures/${signature.id}`} className="block p-4 transition-colors hover:bg-muted/25">
      <div className="flex items-start gap-3"><Initials name={signature.signer_name} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate font-semibold">{signature.signer_name}</p><StatusBadge flagged={signature.flagged} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{waiverName ?? "Waiver"}</p><div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="capitalize">{signature.signing_channel}</span><time dateTime={signature.signed_at}>{formatRecentDate(signature.signed_at)}</time></div></div></div>
    </Link>
  );
}

function formatRecentDate(value: string) { return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

function SummaryPill({ value, label, warning = false }: { value: number; label: string; warning?: boolean }) {
  return <span className={cn("rounded-full bg-muted px-3 py-1.5", warning && "bg-amber-500/10 text-amber-700 dark:text-amber-300")}><strong className="font-semibold text-foreground">{value.toLocaleString()}</strong> {label}</span>;
}
