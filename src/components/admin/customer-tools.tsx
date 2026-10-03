"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CustomerTools({ orgId, email }: { orgId: string; email: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied`); }
    catch { toast.error("Clipboard unavailable. Please copy the text manually."); }
  }
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={() => copy(orgId, "Workspace ID")}><Copy />Copy workspace ID</Button>
    {email && <Button variant="outline" onClick={() => copy(email, "Owner email")}><Copy />Copy email</Button>}
    <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw className={pending ? "animate-spin" : ""} />Refresh</Button>
  </div>;
}
