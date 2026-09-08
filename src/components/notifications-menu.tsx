"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  href?: string;
}

/**
 * Header notifications bell. Built on the proven DropdownMenu (not an untested
 * base-ui primitive). The badge count reflects real items passed from the
 * server — it's absent when there's nothing to show, never decorative.
 */
export function NotificationsMenu({ items }: { items: NotificationItem[] }) {
  const [messages, setMessages] = useState<NotificationItem[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const body = await response.json();
        if (!controller.signal.aborted) setMessages(body.notifications);
      } catch { /* Keep existing messages during temporary network failures. */ }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, []);
  const allItems = [...items, ...messages];
  const count = allItems.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Bell className="size-4.5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {count === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            allItems.map((n) => n.href ? (
              <DropdownMenuItem
                key={n.id}
                render={<Link href={n.href} />}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{n.title}</span>
                {n.description && (
                  <span className="text-xs text-muted-foreground">{n.description}</span>
                )}
              </DropdownMenuItem>
            ) : (
              <div key={n.id} className="border-b px-2 py-3 last:border-0">
                <p className="break-words text-sm font-medium">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{n.description}</p>
              </div>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
