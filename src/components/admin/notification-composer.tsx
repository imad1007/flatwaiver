"use client";

import { useState } from "react";
import { sendAdminNotification } from "@/app/admin/notifications/actions";

export function NotificationComposer({ users }: { users: { id: string; email: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const count = all ? users.length : selected.length;
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setResult("");
    try {
      const response = await sendAdminNotification({ title, message, all, recipients: selected });
      if (response.error) setResult(response.error);
      else { setResult(`Notification sent to ${response.count} user${response.count === 1 ? "" : "s"}.`); setTitle(""); setMessage(""); }
    } catch { setResult("Could not send the notification. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={send} className="grid gap-6 md:grid-cols-2">
    <fieldset disabled={busy} className="min-w-0 rounded-2xl border bg-card p-5">
      <legend className="px-2 font-semibold">Recipients</legend>
      <label className="mb-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); setSelected([]); }} />Select all users ({users.length})</label>
      <input aria-label="Search users by email" placeholder="Search by email" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      <p className="mb-3 text-xs text-muted-foreground">{count} selected{all ? " across all users, regardless of search" : ""}</p>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {users.filter((user) => user.email.toLowerCase().includes(search.toLowerCase())).map((user) => <label key={user.id} className="flex items-center gap-3 rounded-lg p-2 text-sm hover:bg-muted"><input type="checkbox" disabled={all} checked={all || selected.includes(user.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /><span className="break-all">{user.email}</span></label>)}
        {!users.some((user) => user.email.toLowerCase().includes(search.toLowerCase())) && <p className="p-2 text-sm text-muted-foreground">No users found.</p>}
      </div>
    </fieldset>
    <fieldset disabled={busy} className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
      <legend className="px-2 font-semibold">Your message</legend>
      <label className="block text-sm font-medium">Title<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <label className="block text-sm font-medium">Message<textarea required maxLength={2000} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-2 w-full rounded-lg border bg-background px-3 py-2" /></label>
      <p className="text-xs text-muted-foreground">Appears in the user&apos;s notification menu. No email is sent.</p>
      <button disabled={busy || count === 0 || !title.trim() || !message.trim()} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Sending..." : `Send to ${count} user${count === 1 ? "" : "s"}`}</button>
      <p role="status" className="text-sm">{result}</p>
    </fieldset>
  </form>;
}
