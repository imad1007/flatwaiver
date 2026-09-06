import Link from "next/link";
import { ArrowLeft, Check, FileCheck2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { APP } from "@/lib/config";

export const authInputClass = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10 disabled:opacity-60";
export const authButtonClass = "flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60";

export function AuthShell({ children, signup = false }: { children: React.ReactNode; signup?: boolean }) {
  return (
    <main className="grid flex-1 lg:min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-[#17122f] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-32 size-[32rem] rounded-full bg-violet-600/20 blur-[100px]" />
        <Link href="/" className="relative w-fit text-sm font-medium text-white/75 hover:text-white"><span className="flex items-center gap-2"><ArrowLeft className="size-4" /> Back to {APP.name}</span></Link>
        <div className="relative my-auto py-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-violet-200"><ShieldCheck className="size-3.5" /> Less paperwork. More peace of mind.</span>
          <h2 className="mt-7 max-w-lg text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">{signup ? "Your next chapter. Without the paperwork." : "Ready for another great day?"}</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/60">{signup ? "Bring your waivers online and give every customer a simpler start." : "Your waivers, signatures, and front desk. Together in one simple workspace."}</p>
          <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-400/15 p-3 text-violet-200"><FileCheck2 className="size-6" /></span><div><p className="font-medium">From first visit to signed waiver</p><p className="mt-1 text-xs text-white/50">A smoother welcome starts here.</p></div></div>
            <div className="mt-6 space-y-4">
              {["Create and share your waiver", "Let customers sign on any device", "Keep every signed record organized"].map((text) => <div key={text} className="flex items-center gap-3 text-sm text-white/80"><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-violet-200"><Check className="size-3" /></span>{text}</div>)}
            </div>
          </div>
        </div>
        <p className="relative text-xs text-white/50">Unlimited waivers. ${APP.priceMonthlyUsd}/month. One simple plan.</p>
      </aside>
      <section className="flex flex-col bg-background px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto flex w-full max-w-md items-center justify-between">
          <Link href="/" aria-label={`${APP.name} home`}><Logo /></Link>
          <Link href="/support" className="text-xs font-medium text-muted-foreground hover:text-foreground">Need help?</Link>
        </div>
        <div className="mx-auto my-auto w-full max-w-md py-10 lg:py-12">{children}</div>
        <p className="mx-auto w-full max-w-md text-center text-xs text-muted-foreground">{APP.name} · <Link href="/privacy" className="hover:underline">Privacy</Link> · <Link href="/terms" className="hover:underline">Terms</Link></p>
      </section>
    </main>
  );
}
