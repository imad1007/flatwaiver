"use client";

import { useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { APP } from "@/lib/config";
import { SUPPORT_TOPICS } from "@/lib/support-request";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none";

export function SupportForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [token, setToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null | undefined>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          email: data.get("email"),
          name: data.get("name"),
          topic: data.get("topic"),
          message: data.get("message"),
          website: data.get("website"),
          turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "We couldn't send your request.");
      setReference(body?.reference ?? null);
      form.reset();
    } catch (reason) {
      setError(
        reason instanceof DOMException && reason.name === "AbortError"
          ? "The request timed out. Check your connection and try again."
          : reason instanceof Error
            ? reason.message
            : "We couldn't send your request."
      );
    } finally {
      window.clearTimeout(timeout);
      setToken("");
      setResetSignal((value) => value + 1);
      setBusy(false);
    }
  }

  if (reference !== undefined) {
    return (
      <div role="status" className="rounded-xl border border-success/30 bg-success/10 p-5 text-sm">
        <h2 className="font-semibold text-success">Your request was received</h2>
        <p className="mt-1 text-muted-foreground">We’ll reply to the email you provided. You can keep using the app.</p>
        {reference && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {reference}</p>}
        <button type="button" className="mt-4 font-medium text-primary underline" onClick={() => setReference(undefined)}>Send another request</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-sm font-medium">Email</span><input className={inputClass} name="email" type="email" required maxLength={254} defaultValue={defaultEmail} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Name <span className="text-muted-foreground">(optional)</span></span><input className={inputClass} name="name" maxLength={120} /></label>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-medium">What can we help with?</span><select className={inputClass} name="topic">{SUPPORT_TOPICS.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Message</span><textarea className={inputClass} name="message" required minLength={20} maxLength={4000} rows={6} placeholder="What were you trying to do? What happened instead? Include any error message you saw." /></label>
      <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <p className="text-xs text-muted-foreground">For your privacy, don&apos;t include signatures, identity documents, medical details, passwords, or API keys.</p>
      <TurnstileWidget onToken={setToken} resetSignal={resetSignal} />
      {error && <p role="alert" className="text-sm text-destructive">{error} <a className="underline" href={`mailto:${APP.supportEmail}`}>Email us directly</a>.</p>}
      <button type="submit" disabled={!token || busy} className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? "Sending…" : "Send support request"}
      </button>
    </form>
  );
}
