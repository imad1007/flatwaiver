"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavigationHint } from "@/components/navigation-hint";

const TABS = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/developers", label: "Developers" },
  { href: "/settings/billing", label: "Billing" },
];

export function SettingsTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex max-w-full snap-x snap-mandatory gap-1 overflow-x-auto border-b border-border overscroll-x-contain",
        className
      )}
      aria-label="Settings sections"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex shrink-0 snap-start items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            <NavigationHint />
          </Link>
        );
      })}
    </nav>
  );
}
