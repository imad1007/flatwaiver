"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Signing link + QR + kiosk link. `compact` renders the tight variant used
 * inside the publish-success dialog; the default renders full cards for the
 * share page.
 */
export function ShareLinks({
  signingUrl,
  kioskUrl,
  compact = false,
}: {
  signingUrl: string;
  kioskUrl: string;
  compact?: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(signingUrl, { width: 512, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [signingUrl]);

  if (compact) {
    return (
      <div className="space-y-3">
        <CopyRow label="Signing link" value={signingUrl} />
        <CopyRow label="Kiosk link" value={kioskUrl} />
        {qrDataUrl && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR code for ${signingUrl}`}
              className="size-24 rounded-md"
            />
            <div className="text-sm">
              <p className="font-medium">QR code</p>
              <p className="text-muted-foreground">
                Print it at the front desk — customers scan and sign on their phone.
              </p>
              <a
                href={qrDataUrl}
                download="waiver-qr.png"
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                <Download className="size-3.5" />
                Download PNG
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">Signing link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send by text, email, or put it on your website. Works on any phone.
        </p>
        <CopyRow className="mt-3" label="Signing link" value={signingUrl} bare />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">QR code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Print it and put it at your front desk. Customers scan and sign on their
          own phone.
        </p>
        {qrDataUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt={`QR code for ${signingUrl}`}
              className="size-40 rounded-lg border border-border"
            />
            <Button variant="outline" render={<a href={qrDataUrl} download="waiver-qr.png" />}>
              <Download className="size-4" />
              Download PNG
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">Kiosk mode</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open this on a front-desk tablet. Fullscreen, no site chrome, resets
          automatically after each signature.
        </p>
        <CopyRow className="mt-3" label="Kiosk link" value={kioskUrl} bare />
      </section>
    </div>
  );
}

function CopyRow({
  label,
  value,
  bare = false,
  className,
}: {
  label: string;
  value: string;
  bare?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!bare && (
        <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
        {value}
      </code>
      <Button variant="outline" size="icon-sm" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

/** Full share page panel (share route). */
export function SharePanel({
  signingUrl,
  kioskUrl,
}: {
  signingUrl: string;
  kioskUrl: string;
}) {
  return <ShareLinks signingUrl={signingUrl} kioskUrl={kioskUrl} />;
}
