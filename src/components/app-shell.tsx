"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { APP } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/waivers", label: "Waivers", icon: ClipboardList },
  { href: "/signatures", label: "Signatures", icon: FileSignature },
  { href: "/settings/branding", label: "Settings", icon: Settings },
];

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  waivers: "Waivers",
  new: "New waiver",
  share: "Share",
  signatures: "Signatures",
  settings: "Settings",
  branding: "Branding",
  billing: "Billing",
};

export function AppShell({
  email,
  orgName,
  banner,
  children,
}: {
  email: string;
  orgName: string;
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

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Org / brand */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
          <p className="text-xs text-muted-foreground">{APP.name}</p>
        </div>
      </div>

      {/* New waiver — always reachable */}
      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full justify-start gap-2"
          render={<Link href="/waivers/new" />}
        >
          <Plus className="size-4" />
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
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
              {email.slice(0, 1)}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {email}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/billing" />}>
              <CreditCard className="size-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
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

            {/* Breadcrumbs */}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
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

            {/* Palette trigger + theme */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring/50 sm:flex"
            >
              <Search className="size-3.5" />
              Search…
              <kbd className="ml-4 rounded border border-border bg-muted px-1.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
            >
              <Search className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
          {banner}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
