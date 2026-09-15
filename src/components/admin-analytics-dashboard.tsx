"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Users, CreditCard, Clock3, TrendingUp, RefreshCw, FileCheck2, CircleAlert, ArrowRight } from "lucide-react";
import { stageLabels, type AdminAnalytics, type AccountStage } from "@/lib/admin-analytics";
import type { AdminActivationFunnel } from "@/lib/admin-data";
import { APP } from "@/lib/config";
const number = (n: number) => n.toLocaleString("en-US");
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const colors: Record<AccountStage, string> = { subscribed: "#7560ef", trial: "#35b8ac", expired: "#f3a550", pastDue: "#ed738c", canceled: "#9a87c0", manual: "#69a4e7", other: "#94a3b8" };
const panel = "min-w-0 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6";
type Props = {
    data: AdminAnalytics;
    activation: AdminActivationFunnel;
    updatedAt: string;
    totalOrgs: number;
    signatures: number;
    monthlySignatures: number;
    suspended: number;
    top: {
        orgId: string;
        name: string;
        signatureCount: number;
        signaturesThisMonth: number;
    }[];
};
export function AdminAnalyticsDashboard({ data, activation, updatedAt, totalOrgs, signatures, monthlySignatures, suspended, top }: Props) {
    const [range, setRange] = useState(30);
    const [comparisonPeriod, setComparisonPeriod] = useState("daily");
    const comparison = data.comparisons.find(c => c.period === comparisonPeriod)!;
    const [metric, setMetric] = useState<"users" | "organizations" | "trialsEnded">("users");
    const [selected, setSelected] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const days = data.days.slice(-range);
    const selectedDay = days.find(d => d.date === selected);
    const stages = Object.entries(data.counts) as [
        AccountStage,
        number
    ][];
    const total = days.reduce((n, d) => n + d[metric], 0);
    const max = Math.max(1, ...days.map(d => d[metric]));
    const x = (i: number) => 48 + i * 704 / (days.length - 1);
    const y = (n: number) => 220 - n / max * 174;
    const points = days.map((d, i) => `${x(i)},${y(d[metric])}`).join(" ");
    let offset = 0;
    const metrics = [{ label: "Registered users", value: number(data.totalUsers), hint: "Owners and team members", Icon: Users }, { label: "Live trials", value: number(data.counts.trial), hint: `${data.endingSoon} ending in the next 7 days`, Icon: Clock3 }, { label: "Subscribers", value: number(data.counts.subscribed), hint: "Active · linked to a billing provider", Icon: CreditCard }, { label: "Estimated MRR", value: money(data.estimatedMrr), hint: `${money(data.estimatedArr)} estimated annual run rate`, Icon: TrendingUp }];
    return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Platform analytics</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your business, at a glance.</h1><p className="mt-2 text-sm text-muted-foreground">Growth, customer health, and the numbers behind {APP.name}.</p></div>
      <button onClick={() => startTransition(() => router.refresh())} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"><RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`}/>{pending ? 'Refreshing…' : 'Refresh data'}</button>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-500"/>Current snapshot · {new Date(updatedAt).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC</span><span>{number(totalOrgs)} organizations · {number(suspended)} suspended</span></div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">{comparisonPeriod === 'daily' ? 'Today vs yesterday at the same time' : comparisonPeriod === 'weekly' ? 'Last 7 days vs previous 7 days' : 'Last 30 days vs previous 30 days'} (UTC)</p>
      <div className="flex rounded-lg bg-muted p-1" aria-label="Metric comparison period">{(['daily', 'weekly', 'monthly'] as const).map(period => <button key={period} aria-pressed={comparisonPeriod === period} onClick={() => setComparisonPeriod(period)} className={`min-h-10 rounded-md px-3 text-xs font-medium capitalize ${comparisonPeriod === period ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{period}</button>)}</div>
    </div>
    <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, hint, Icon }, i) => <div key={label} className={`${panel} ${i === 3 ? 'bg-gradient-to-br from-primary/10 via-card to-violet-500/5' : ''}`}>
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
          {i === 0 ? <span aria-live="polite" title={`New registrations: ${comparison.current} vs ${comparison.previous}. This compares signups, not the all-time total.`} className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${comparison.current > comparison.previous ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : comparison.current < comparison.previous ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-muted text-muted-foreground'}`}>
            <span className="sr-only">New registration change: </span>{comparison.percent === null ? 'New growth' : `${comparison.percent > 0 ? '+' : ''}${comparison.percent.toLocaleString('en-US', {maximumFractionDigits: 1})}%`}
          </span> : <span title={`Historical ${label.toLowerCase()} snapshots are not available for this comparison.`} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">No history</span>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</p>
        {i === 0 && <p className="mt-2 text-xs text-muted-foreground">New signups: {number(comparison.current)} vs {number(comparison.previous)}{comparison.percent === null ? ' (no previous baseline)' : ''}</p>}
      </div>)}
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Growth over time</h2><p className="mt-1 text-xs text-muted-foreground">Daily activity · UTC · today is partial</p></div><div className="flex rounded-lg bg-muted p-1" aria-label="Chart date range">{[7, 30, 90].map(n => <button key={n} aria-pressed={range === n} onClick={() => { setRange(n); setSelected(null); }} className={`min-h-9 rounded-md px-3 text-xs font-medium ${range === n ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{n} days</button>)}</div></div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><label className="text-sm"><span className="sr-only">Chart metric</span><select value={metric} onChange={e => { setMetric(e.target.value as typeof metric); setSelected(null); }} className="max-w-full rounded-lg border bg-card px-3 py-2 text-sm"><option value="users">New registered users</option><option value="organizations">New organizations</option><option value="trialsEnded">Expired trials · still not subscribed</option></select></label><p className="text-2xl font-semibold tabular-nums">{number(total)} <span className="text-xs font-normal text-muted-foreground">in this period</span></p></div>
        <svg viewBox="0 0 780 260" className="mt-4 w-full overflow-visible" role="img" aria-label={`${metric}: ${total} in the last ${range} days. Daily data is available below.`}>
          <defs><linearGradient id="admin-growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7560ef" stopOpacity=".22"/><stop offset="100%" stopColor="#7560ef" stopOpacity=".015"/></linearGradient></defs>
          {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="48" x2="752" y1={y(max * i / 4)} y2={y(max * i / 4)} stroke="currentColor" className="text-border" strokeDasharray="4 5"/><text x="35" y={y(max * i / 4) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="text-muted-foreground">{Number((max * i / 4).toFixed(1))}</text></g>)}
          <polygon points={`48,220 ${points} 752,220`} fill="url(#admin-growth-fill)"/><polyline points={points} fill="none" stroke="#7560ef" strokeWidth="3" strokeLinejoin="round"/>
          {days.map((d, i) => <g key={d.date}><circle cx={x(i)} cy={y(d[metric])} r={selected === d.date ? 5 : 2} fill="#7560ef"/><rect x={x(i) - 704 / (days.length - 1) / 2} y="35" width={704 / (days.length - 1)} height="190" fill="transparent" onMouseEnter={() => setSelected(d.date)} onClick={() => setSelected(d.date)}><title>{`${d.date}: ${d[metric]}`}</title></rect></g>)}
          {[0, Math.floor(days.length / 2), days.length - 1].map(i => <text key={i} x={x(i)} y="248" textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} fontSize="11" fill="currentColor" className="text-muted-foreground">{days[i].date.slice(5)}</text>)}
        </svg>
        <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{selectedDay ? `${selectedDay.date}: ${number(selectedDay[metric])}` : total === 0 ? 'No activity recorded in this period.' : 'Hover or tap the chart to explore a day.'}</p>
        {metric === 'trialsEnded' && <p className="mt-2 text-xs text-muted-foreground">Grouped by trial end date using current status; not a historical conversion report.</p>}
        <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">View daily data</summary><div className="mt-2 max-h-44 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Date (UTC)</th><th>Count</th></tr></thead><tbody>{days.map(d => <tr key={d.date} className="border-t"><td className="py-1.5">{d.date}</td><td>{d[metric]}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className={panel}><h2 className="font-semibold">Customer lifecycle</h2><p className="mt-1 text-xs text-muted-foreground">Current subscription status by organization</p><div className="relative mx-auto my-5 size-44"><svg viewBox="0 0 160 160" role="img" aria-label="Subscription status distribution"><circle cx="80" cy="80" r="64" fill="none" stroke="currentColor" className="text-muted" strokeWidth="14"/>{stages.map(([stage, count]) => { const size = totalOrgs ? count / totalOrgs * 100 : 0; const start = offset; offset += size; return <circle key={stage} cx="80" cy="80" r="64" fill="none" stroke={colors[stage]} strokeWidth="14" pathLength="100" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"/>; })}</svg><div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-semibold">{number(totalOrgs)}</strong><span className="text-xs text-muted-foreground">organizations</span></div></div><ul className="space-y-3">{stages.map(([stage, count]) => <li key={stage} className="flex items-center gap-2 text-xs"><span className="size-2 shrink-0 rounded-full" style={{ background: colors[stage] }}/><span className="flex-1 text-muted-foreground">{stageLabels[stage]}</span><strong className="tabular-nums">{number(count)}</strong></li>)}</ul></section>
    </div>
    <div className="grid gap-5 lg:grid-cols-3">
      <section className={`${panel} bg-gradient-to-br from-primary/10 to-card`}><span className="inline-flex items-center gap-2 text-sm font-semibold"><TrendingUp className="size-4 text-primary"/>Revenue overview</span><p className="mt-5 text-4xl font-semibold tracking-tight">{money(data.estimatedMrr)}<span className="text-sm font-normal text-muted-foreground"> / month</span></p><p className="mt-2 text-xs text-muted-foreground">Estimated recurring revenue</p><div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><span className="text-muted-foreground">Estimated ARR</span><strong>{money(data.estimatedArr)}</strong></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{data.counts.subscribed} active provider-linked subscriptions × ${APP.priceMonthlyUsd}/month. Excludes manual access; discounts, refunds, and fees are not reflected.</p><div className="mt-4 rounded-xl border bg-background/60 p-3 text-xs leading-relaxed"><strong>Collected revenue: not available</strong><p className="mt-1 text-muted-foreground">Payment amounts and historical MRR are not recorded in this database yet.</p></div></section>
      <section className={panel}><h2 className="flex items-center gap-2 font-semibold"><CircleAlert className="size-4 text-amber-500"/>Needs attention</h2><div className="mt-5 space-y-5">{[[data.counts.expired, 'Trials ended without a subscription'], [data.endingSoon, 'Trials ending in the next 7 days'], [data.counts.pastDue, 'Accounts with past-due billing']].map(([n, label]) => <div key={label} className="flex items-center justify-between gap-4 border-b pb-4"><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl tabular-nums">{n}</strong></div>)}</div><Link href="/admin/customers" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary">Review customers <ArrowRight className="size-4"/></Link></section>
      <section className={panel}><h2 className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-4 text-teal-500"/>Product engagement</h2><p className="mt-5 text-4xl font-semibold tabular-nums">{number(signatures)}</p><p className="mt-2 text-xs text-muted-foreground">Signed waivers · all time</p><div className="mt-5 rounded-xl bg-teal-500/10 p-4"><p className="text-2xl font-semibold tabular-nums">{number(monthlySignatures)}</p><p className="mt-1 text-xs text-muted-foreground">Signatures this calendar month</p></div><p className="mt-5 text-xs leading-relaxed text-muted-foreground">Metrics reflect retained customer records. Deleted accounts and their records are excluded.</p></section>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={panel}><h2 className="font-semibold">From signup to first signature</h2><p className="mt-1 text-xs text-muted-foreground">All-time activation · server-confirmed milestones</p>{activation.ready ? <div className="mt-6 space-y-5">{[[activation.totalOrgs, 'Created an organization'], [activation.publishedOrgs, 'Published a waiver'], [activation.signedOrgs, 'Collected a signature']].map(([value, label]) => { const rate = activation.totalOrgs ? Math.round(Number(value) / activation.totalOrgs * 100) : 0; return <div key={label}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{label}</span><span className="tabular-nums"><strong>{number(Number(value))}</strong><span className="ml-2 text-xs text-muted-foreground">{rate}%</span></span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary/75" style={{ width: `${Math.min(rate, 100)}%` }}/></div></div>; })}<p className="text-xs text-muted-foreground">Median signup to signature: {activation.medianHoursToSignature === null ? 'Not available' : `${activation.medianHoursToSignature.toFixed(1)} hours`}</p></div> : <p className="mt-6 text-sm text-muted-foreground">Activation reporting is not configured yet.</p>}</section>
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Most active customers</h2><Link href="/admin/customers" aria-label="View all customers" className="rounded-lg p-2 text-primary hover:bg-accent"><ArrowUpRight className="size-4"/></Link></div><p className="mt-1 text-xs text-muted-foreground">Ranked by total signed waivers</p>{top.length ? <ol className="mt-5 divide-y">{top.map((row, i) => <li key={row.orgId} className="flex items-center gap-3 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span><span className="text-right"><strong className="text-sm tabular-nums">{number(row.signatureCount)}</strong><span className="block text-[11px] text-muted-foreground">{number(row.signaturesThisMonth)} this month</span></span></li>)}</ol> : <p className="py-10 text-center text-sm text-muted-foreground">Your first customer signatures will appear here.</p>}</section>
    </div>
  </div>;
}
