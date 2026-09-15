"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Bell, LayoutDashboard, LogOut, Menu, Newspaper, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { APP } from "@/lib/config";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users, exact: false },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, exact: false },
  { href: "/admin/blog", label: "Blog", icon: Newspaper, exact: false },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const content = <>
    <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 px-5 py-7">
      <LogoMark className="size-9 shrink-0" />
      <span><span className="block text-base font-semibold tracking-tight">{APP.name}</span><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin workspace</span></span>
    </Link>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Workspace</p>
      <nav aria-label="Admin navigation" className="space-y-1.5">
        {NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            <item.icon className="size-[18px] shrink-0" /><span>{item.label}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
          </Link>;
        })}
      </nav>
    </div>
    <div className="space-y-4 border-t p-4">
      <Link href="/dashboard" onClick={() => setOpen(false)} className="flex min-h-10 items-center justify-between rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent">Open app <ArrowUpRight className="size-4 text-muted-foreground" /></Link>
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Appearance</span><ThemeToggle /></div>
      <div className="flex items-center gap-2 border-t pt-4"><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Administrator</p><p title={email} className="mt-1 truncate text-xs text-muted-foreground">{email}</p></div><Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out" title="Sign out"><LogOut className="size-4" /></Button></div>
    </div>
  </>;

  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card lg:flex">{content}</aside>
    <div className="p-4 pb-0 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" className="gap-2 bg-card" />}><Menu className="size-4" />Admin menu</SheetTrigger>
        <SheetContent side="left" className="max-w-72 gap-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate the admin workspace and manage your account.</SheetDescription>
          {content}
        </SheetContent>
      </Sheet>
    </div>
  </>;
}
