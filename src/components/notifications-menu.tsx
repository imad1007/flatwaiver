"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  href?: string;
  createdAt?: string;
}

export function NotificationsMenu({ items }: { items: NotificationItem[] }) {
  const [messages, setMessages] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  // Include the alert text so a changed live alert becomes unread again.
  const keyFor = (item: NotificationItem) => item.href ? ("alert:" + item.id + ":" + item.title).slice(0, 200) : item.id;
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      const before = revision.current;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Notifications could not be loaded.");
        const body = await response.json();
        if (controller.signal.aborted) return;
        setMessages(body.notifications);
        if (before === revision.current) setReadIds(body.readIds ?? []);
        setAvailable(body.readStateAvailable === true);
        setReady(true);
        setError(null);
      } catch {
        if (!controller.signal.aborted) setError("Notifications could not be refreshed. Please try again shortly.");
      }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, []);

  const allItems = [...items, ...messages];
  const unread = allItems.filter(item => !readIds.includes(keyFor(item)));
  async function markRead(ids: string[]) {
    if (saving || !ids.length) return;
    setSaving(true);
    setError(null);
    revision.current++;
    try {
      const response = await fetch("/api/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("Could not save read status. Please try again.");
      revision.current++;
      setReadIds(current => [...new Set([...current, ...ids])]);
    } catch {
      setError("Could not save read status. Please try again.");
    } finally { setSaving(false); }
  }

  return (
    <Popover>
      <PopoverTrigger aria-label={ready ? `Notifications (${unread.length} unread)` : "Notifications"}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Bell aria-hidden="true" className="size-4.5" />
        {ready && unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">{unread.length > 99 ? "99+" : unread.length}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="w-96 max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div><PopoverTitle className="font-semibold">Notifications</PopoverTitle><p className="mt-1 text-xs text-muted-foreground">{ready ? `${unread.length} unread` : "Loading notifications..."}</p></div>
          <button type="button" disabled={!available || saving || !unread.length} onClick={() => void markRead(unread.map(keyFor))}
            className="flex items-center gap-1.5 rounded-md p-1 text-xs font-medium text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
            <CheckCheck aria-hidden="true" className="size-4" />Mark all read
          </button>
        </div>
        {error && <p role="alert" className="px-5 py-3 text-xs text-destructive">{error}</p>}
        {ready && !available && <p role="status" className="px-5 py-3 text-xs text-muted-foreground">Read status is temporarily unavailable.</p>}
        <div className="max-h-[min(28rem,60dvh)] overflow-y-auto overscroll-contain">
          {ready && !allItems.length && <div className="px-6 py-10 text-center"><Bell aria-hidden="true" className="mx-auto mb-3 size-7 text-muted-foreground/50" /><p className="font-medium">All caught up</p><p className="mt-1 text-xs text-muted-foreground">New updates will appear here.</p></div>}
          {allItems.map(item => {
            const read = readIds.includes(keyFor(item));
            const date = item.createdAt ? new Date(item.createdAt) : null;
            return <article key={item.id} className={`border-b border-border px-5 py-4 last:border-0 ${read ? "" : "bg-primary/[0.04]"}`}>
              <div className="flex items-start gap-2.5">
                <span aria-label={read ? "Read" : "Unread"} className={`mt-1.5 size-1.5 shrink-0 rounded-full ${read ? "bg-muted-foreground/25" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  {item.href ? <Link href={item.href} className="break-words text-sm font-semibold hover:underline">{item.title}</Link> : <h3 className="break-words text-sm font-semibold">{item.title}</h3>}
                  {item.description && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{item.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    {date && !Number.isNaN(date.getTime()) ? <time dateTime={item.createdAt} title={date.toLocaleString()}>{date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time> : <span>Current workspace alert</span>}
                    {read ? <span className="flex items-center gap-1"><Check aria-hidden="true" className="size-3" />Read</span> : <button type="button" disabled={!available || saving} onClick={() => void markRead([keyFor(item)])} className="rounded px-1 py-0.5 font-medium text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">Mark as read</button>}
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div>
        {messages.length === 50 && <p className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">Showing the latest 50 announcements.</p>}
      </PopoverContent>
    </Popover>
  );
}
