"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendResignReminder } from "@/app/(app)/waivers/actions";

interface RenewalRow {
  signedWaiverId: string;
  signerName: string;
  signerEmail: string | null;
  templateName: string;
  expiresAtIso: string;
  state: "expiring" | "expired";
  remindedAt: string | null;
}

export function RenewalsTable({
  items,
  canManage,
}: {
  items: RenewalRow[];
  canManage: boolean;
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border overscroll-x-contain">
      <table className="min-w-[720px] w-full text-left text-sm">
        <caption className="sr-only">Signers whose waivers are expiring or expired</caption>
        <thead className="border-b border-border bg-muted/50 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Signer</th>
            <th scope="col" className="px-4 py-3 font-medium">Waiver</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Expires</th>
            {canManage && <th scope="col" className="px-4 py-3 font-medium">Reminder</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <Row key={row.signedWaiverId} row={row} canManage={canManage} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, canManage }: { row: RenewalRow; canManage: boolean }) {
  const [remindedAt, setRemindedAt] = useState(row.remindedAt);
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      try {
        const result = await sendResignReminder(row.signedWaiverId);
        setRemindedAt(new Date().toISOString());
        if (result.duplicate) {
          toast.info(`A reminder was already sent to ${row.signerEmail}`);
        } else {
          toast.success(`Reminder sent to ${row.signerEmail}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't send the reminder.");
      }
    });
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{row.signerName}</div>
        <div className="text-xs text-muted-foreground">{row.signerEmail ?? "no email"}</div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{row.templateName}</td>
      <td className="px-4 py-3">
        <span
          className={
            row.state === "expired"
              ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive"
              : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
          }
        >
          {row.state === "expired" ? "Expired" : "Expiring"}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(row.expiresAtIso).toLocaleDateString()}
      </td>
      {canManage && (
        <td className="px-4 py-3">
          {remindedAt ? (
            <span className="text-xs text-muted-foreground">
              Sent {new Date(remindedAt).toLocaleDateString()}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={send}
              disabled={pending || !row.signerEmail}
              title={row.signerEmail ? undefined : "No email on file for this signer"}
            >
              {pending ? "Sending…" : "Send reminder"}
            </Button>
          )}
        </td>
      )}
    </tr>
  );
}
