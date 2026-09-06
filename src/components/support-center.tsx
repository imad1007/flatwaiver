"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CheckCircle2, LifeBuoy, Mail, MessageCircle, Search } from "lucide-react";
import { APP } from "@/lib/config";
import { SUPPORT_FAQS } from "@/lib/support-faqs";
import { getChatStatus, requestChat, subscribeChat } from "@/lib/chat";
import { SupportForm } from "@/components/support-form";

const shortcuts = [
  { title: "Create & share a waiver", description: "Publish, share a link, or set up your kiosk.", href: "/waivers" },
  { title: "Find & export signatures", description: "Search your records and download signed PDFs.", href: "/signatures" },
  { title: "Manage your subscription", description: "Review your plan and billing options.", href: "/settings/billing" },
];

export function SupportCenter({ email, formConfigured }: { email: string; formConfigured: boolean }) {
  const [query, setQuery] = useState("");
  const [contact, setContact] = useState<"chat" | "email">("chat");
  const [emailOpened, setEmailOpened] = useState(false);
  function selectContact(value: "chat" | "email") {
    if (value === "email") setEmailOpened(true);
    setContact(value);
  }
  const [requested, setRequested] = useState(false);
  const status = useSyncExternalStore(subscribeChat, getChatStatus, () => "loading");
  const results = SUPPORT_FAQS.filter((faq) => `${faq.q} ${faq.a}`.toLowerCase().includes(query.trim().toLowerCase()));
  const statusText = status === "online" ? "Team online" : status === "away" ? "Team away" : status === "offline" ? "Team offline" : status === "unavailable" ? "Chat unavailable" : "Chat with our team";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="rounded-2xl border border-primary/15 bg-primary/5 p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary"><LifeBuoy className="size-4" /> {APP.name} support</div>
        <h1 className="text-3xl font-bold tracking-tight">How can we help?</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">Find an answer or talk to us. Your workspace stays right here.</p>
        <label className="mt-6 flex max-w-2xl items-center gap-3 rounded-xl border bg-background px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <span className="sr-only">Search help</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signing, exports, billing…" className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none" />
        </label>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {shortcuts.map((item) => <Link key={item.href} href={item.href} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"><div className="flex items-center justify-between gap-2 font-semibold text-sm">{item.title}<ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></div><p className="mt-2 text-sm text-muted-foreground">{item.description}</p></Link>)}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="answers-title">
          <h2 id="answers-title" className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5" /> Quick answers</h2>
          <p role="status" className="mt-1 text-sm text-muted-foreground">{query ? `${results.length} matching answer${results.length === 1 ? "" : "s"}` : "Help with the things you do every day."}</p>
          <div className="mt-4 divide-y rounded-xl border bg-card px-5">
            {results.map((faq) => <details key={faq.q} className="group py-4"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-ring">{faq.q}</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.a}</p></details>)}
            {results.length === 0 && <div className="py-6 text-sm"><p className="font-medium">Let’s work through it together.</p><p className="mt-1 text-muted-foreground">Try a shorter search or send us your question.</p><button className="mt-3 font-medium text-primary underline" onClick={() => { setQuery(""); selectContact("email"); }}>Ask the support team</button></div>}
          </div>
        </section>

        <section aria-labelledby="contact-title" className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
          <h2 id="contact-title" className="text-lg font-semibold">Talk to our team</h2>
          <p className="mt-1 text-sm text-muted-foreground">A question, a problem, or an idea? We’re listening.</p>
          <div className="mt-5 flex gap-1 rounded-lg bg-muted p-1" aria-label="Contact method">
            {(["chat", "email"] as const).map((method) => <button key={method} type="button" aria-pressed={contact === method} onClick={() => selectContact(method)} className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${contact === method ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{method === "chat" ? <MessageCircle className="size-4" /> : <Mail className="size-4" />}{method === "chat" ? "Live chat" : "Send a request"}</button>)}
          </div>
          <div hidden={contact !== "chat"} className="pt-6">
            <p className="flex items-center gap-2 text-sm font-medium" role="status"><span className={`size-2 rounded-full ${status === "online" ? "bg-emerald-500" : "bg-muted-foreground"}`} />{statusText}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{status === "offline" || status === "away" ? "Leave a message in chat or send a request. Include your email so we can follow up." : "Open a conversation without leaving this page. If we’re away, leave your email and we’ll follow up."}</p>
            <button type="button" onClick={() => { setRequested(true); requestChat(); }} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><MessageCircle className="size-4" />{requested && status === "loading" ? "Connecting…" : "Open chat"}</button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Opening chat enables Tawk.to for this visit. It uses cookies to keep your conversation connected.</p>
            {status === "unavailable" && <p role="alert" className="mt-4 text-sm">Chat couldn’t connect. <button className="font-medium text-primary underline" onClick={() => selectContact("email")}>Send a request instead</button>.</p>}
          </div>
          <div hidden={contact !== "email"} className="pt-5">
            <p className="mb-4 text-sm text-muted-foreground">Tell us what happened and what you were trying to do. We’ll reply to your email.</p>
            {formConfigured ? emailOpened && <SupportForm defaultEmail={email} /> : <p className="rounded-lg bg-muted p-4 text-sm">The request form is temporarily unavailable. You can still reach us by chat or email below.</p>}
          </div>
          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground"><p className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Support stays available on every plan.</p><a href={`mailto:${APP.supportEmail}`} className="mt-2 inline-block break-all underline underline-offset-2">{APP.supportEmail}</a></div>
        </section>
      </div>
    </div>
  );
}
