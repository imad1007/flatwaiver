"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deleteCustomer,
  restoreCustomer,
  suspendCustomer,
} from "@/app/admin/customers/actions";

export function CustomerRowActions({
  orgId,
  name,
  ownerUserId,
  suspended,
  deletable,
}: {
  orgId: string;
  name: string;
  ownerUserId: string | null;
  suspended: boolean;
  deletable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(ok);
        setConfirmOpen(false);
        setConfirmText("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Actions" />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {suspended ? (
            <DropdownMenuItem
              disabled={!ownerUserId || pending}
              onClick={() =>
                ownerUserId &&
                run(() => restoreCustomer(ownerUserId), "Account restored")
              }
            >
              <RotateCcw className="size-4" />
              Restore access
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={!ownerUserId || pending}
              onClick={() =>
                ownerUserId &&
                run(() => suspendCustomer(ownerUserId), "Account suspended")
              }
            >
              <Ban className="size-4" />
              Suspend login
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!deletable || pending}
            onClick={() => deletable && setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            {deletable ? "Delete account" : "Delete (has records)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{name}”?</DialogTitle>
            <DialogDescription>
              This permanently removes the organization, its owner login, and any
              draft waivers. It has no signed waivers, so nothing legal is lost.
              This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Type the business name to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={name}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={confirmText.trim() !== name.trim() || pending}
              onClick={() => run(() => deleteCustomer(orgId), "Account deleted")}
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
