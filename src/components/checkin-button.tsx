"use client";

import { useTransition } from "react";
import { CircleCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { checkIn, undoCheckIn } from "@/app/(app)/checkin/actions";
import { Button } from "@/components/ui/button";

/** One-tap check-in / undo for a signature row on the Front desk page. */
export function CheckinButton({
  signedWaiverId,
  checkinId,
  checkedInAt,
}: {
  signedWaiverId: string;
  /** When set, this signer is already checked in (button becomes undo). */
  checkinId?: string;
  checkedInAt?: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (checkinId) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
          <CircleCheck className="size-4" />
          {checkedInAt
            ? new Date(checkedInAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })
            : "Checked in"}
        </span>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                await undoCheckIn(checkinId);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Undo failed.");
              }
            })
          }
          aria-label="Undo check-in"
          title="Undo check-in"
          className="text-muted-foreground/60 transition-colors hover:text-foreground disabled:opacity-50"
        >
          <Undo2 className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await checkIn(signedWaiverId);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Check-in failed.");
          }
        })
      }
    >
      {isPending ? "Checking in…" : "Check in"}
    </Button>
  );
}
