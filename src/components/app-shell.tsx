"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  Headset,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { APP } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavigationHint } from "@/components/navigation-hint";
import { PageTransition } from "@/components/page-transition";
import {
  NotificationsMenu,
  type NotificationItem,
} from "@/components/notifications-menu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checkin", label: "Front desk", icon: ClipboardCheck },
  { href: "/waivers", label: "Waivers", icon: ClipboardList },
  { href: "/signatures", label: "Signatures", icon: FileSignature },
  { href: "/settings/branding", label: "Settings", icon: Settings },
  { href: "/help", label: "Support", icon: LifeBuoy },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  checkin: "Front desk",
  waivers: "Waivers",
  new: "New waiver",
  share: "Share",
  signatures: "Signatures",
  renewals: "Renewals",
  settings: "Settings",
  account: "Account",
  help: "Support",
  team: "Team",
  branding: "Branding",
  developers: "Developers",
  billing: "Billing",
};

/** Two-letter avatar initials from an email address. */
function initialsFromEmail(email: string): string {
  const letters = email.replace(/[^a-zA-Z]/g, "");
  return (letters.slice(0, 2) || email.slice(0, 1) || "?").toUpperCase();
}

export function AppShell({
  email,
  orgName,
  isAdmin = false,
  notifications = [],
  banner,
  children,
}: {
  email: string;
  orgName: string;
  isAdmin?: boolean;
  notifications?: NotificationItem[];
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Derived open state: navigating (pathname change) auto-closes the sheet.
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const mobileNavOpen = navOpenAt === pathname;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => SEGMENT_LABELS[segment] ?? "Detail");

  const accountMenu = (
    <DropdownMenuContent align="end" className="w-60">
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-semibold">{orgName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/account" />}>
          <Settings className="size-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/team" />}>
          <Users className="size-4" />
          Team
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/billing" />}>
          <CreditCard className="size-4" />
          Billing
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/admin" />}>
              <Shield className="size-4" />
              Admin panel
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Org / brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <LogoMark className="size-8 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
          <p className="text-xs text-muted-foreground">{APP.name}</p>
        </div>
      </div>

      {/* New waiver — AI-accented, always reachable */}
      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full justify-start gap-2 bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm transition-all hover:from-brand-500 hover:to-brand-500 hover:shadow-md hover:shadow-brand-600/20"
          render={<Link href="/waivers/new" />}
        >
          <Sparkles className="size-4" />
          New waiver
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active =
            item.href === "/settings/branding"
              ? pathname.startsWith("/settings")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onNavigate={() => setNavOpenAt(null)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              {active && (
                <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground/80 group-hover:text-sidebar-accent-foreground"
                )}
              />
              {item.label}
              <NavigationHint />
            </Link>
          );
        })}
      </nav>

      {/* User chip */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            {initialsFromEmail(email)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {email}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {/* Mobile nav */}
            <Sheet
              open={mobileNavOpen}
              onOpenChange={(open) => setNavOpenAt(open ? pathname : null)}
            >
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>

            {/* Breadcrumbs (left) */}
            <nav aria-label="Breadcrumb" className="min-w-0 shrink">
              <ol className="flex items-center gap-1.5 truncate text-sm">
                {crumbs.map((crumb, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-foreground/50">/</span>}
                    <span
                      className={
                        i === crumbs.length - 1
                          ? "font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {crumb}
                    </span>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Trial / billing pill — centered in the nav on desktop */}
            <div className="hidden min-w-0 flex-1 justify-center xl:flex">{banner}</div>

            {/* Right cluster */}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {/* Search */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="mr-1 hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground lg:flex"
              >
                <Search className="size-3.5" />
                Search…
                <kbd className="ml-4 rounded border border-border bg-muted px-1.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
              </button>

              {/* Support */}
              <Link
                href="/help"
                aria-label="Support"
                title="Support"
                className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                <Headset className="size-4.5" />
              </Link>

              {/* Quick actions */}
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Quick actions"
                title="Quick actions (⌘K)"
                className="hidden size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                <Zap className="size-4.5" />
              </button>

              {/* Notifications */}
              <NotificationsMenu items={notifications} />

              {/* Theme */}
              <ThemeToggle />

              {/* Account */}
              <DropdownMenu onOpenChange={(open) => {
                if (open) {
                  ["/settings/account", "/settings/team", "/settings/billing"].forEach((href) => router.prefetch(href));
                }
              }}>
                <DropdownMenuTrigger aria-label="Account menu" className="ml-1 flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    {initialsFromEmail(email)}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                {accountMenu}
              </DropdownMenu>
            </div>
          </div>
          {/* Trial / billing pill — below the bar on mobile */}
          <div className="px-4 pb-2 empty:hidden xl:hidden">{banner}</div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
