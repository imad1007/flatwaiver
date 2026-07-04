"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function SharePanel({
  signingUrl,
  kioskUrl,
}: {
  signingUrl: string;
  kioskUrl: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(signingUrl, { width: 512, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [signingUrl]);

  async function copy(url: string, key: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="font-bold">Signing link</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Send by text, email, or put it on your website. Works on any phone.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-neutral-100 px-3 py-2 text-sm">
            {signingUrl}
          </code>
          <button
            onClick={() => copy(signingUrl, "link")}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-900"
          >
            {copied === "link" ? "Copied!" : "Copy"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="font-bold">QR code</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Print it and put it at your front desk. Customers scan and sign on their
          own phone.
        </p>
        {qrDataUrl && (
          <div className="mt-4 flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code for ${signingUrl}`} className="h-40 w-40" />
            <a
              href={qrDataUrl}
              download="waiver-qr.png"
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-neutral-900"
            >
              Download PNG
            </a>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 p-6">
        <h2 className="font-bold">Kiosk mode</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Open this on a front-desk tablet. Fullscreen, no site chrome, resets
          automatically after each signature.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-neutral-100 px-3 py-2 text-sm">
            {kioskUrl}
          </code>
          <button
            onClick={() => copy(kioskUrl, "kiosk")}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:border-neutral-900"
          >
            {copied === "kiosk" ? "Copied!" : "Copy"}
          </button>
        </div>
      </section>
    </div>
  );
}
