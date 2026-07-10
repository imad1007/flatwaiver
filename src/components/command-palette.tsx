"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FilePlus2,
  FileSignature,
  LayoutDashboard,
  LogOut,
  Palette,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("");
    onOpenChange(next);
  }

  function go(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command palette"
      description="Jump anywhere or start an action"
    >
      <CommandInput
        placeholder="Type a command or search…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/waivers/new")}>
            <FilePlus2 className="size-4" />
            New waiver
          </CommandItem>
          {query.trim() && (
            <CommandItem
              onSelect={() => go(`/signatures?q=${encodeURIComponent(query.trim())}`)}
            >
              <Search className="size-4" />
              Search signatures for &ldquo;{query.trim()}&rdquo;
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="size-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/checkin")}>
            <ClipboardCheck className="size-4" />
            Front desk
          </CommandItem>
          <CommandItem onSelect={() => go("/waivers")}>
            <ClipboardList className="size-4" />
            Waivers
          </CommandItem>
          <CommandItem onSelect={() => go("/signatures")}>
            <FileSignature className="size-4" />
            Signatures
          </CommandItem>
          <CommandItem onSelect={() => go("/settings/branding")}>
            <Palette className="size-4" />
            Branding
          </CommandItem>
          <CommandItem onSelect={() => go("/settings/billing")}>
            <CreditCard className="size-4" />
            Billing
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Session">
          <CommandItem
            onSelect={async () => {
              handleOpenChange(false);
              await createClient().auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
