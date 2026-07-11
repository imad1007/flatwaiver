"use client";

import { useEffect, useRef, useState } from "react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

/**
 * Paddle overlay checkout. The webhook (subscription.* → /api/paddle/webhook)
 * mirrors the resulting subscription onto our `subscriptions` table; org_id
 * rides along as checkout custom_data so the webhook can find the row.
 */
export function PaddleCheckoutButton({
  orgId,
  email,
  label,
  primary = false,
}: {
  orgId: string;
  email: string | null;
  label: string;
  primary?: boolean;
}) {
  const paddleRef = useRef<Paddle | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
  const configured = Boolean(clientToken && priceId);

  useEffect(() => {
    if (!configured) return;
    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
          ? "production"
          : "sandbox",
      token: clientToken!,
    })
      .then((paddle) => {
        if (paddle) {
          paddleRef.current = paddle;
          setReady(true);
        }
      })
      .catch(() => setError("Payment system failed to load. Refresh and try again."));
  }, [configured, clientToken]);

  function openCheckout() {
    paddleRef.current?.Checkout.open({
      items: [{ priceId: priceId!, quantity: 1 }],
      customData: { org_id: orgId },
      ...(email ? { customer: { email } } : {}),
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/settings/billing?checkout=success`,
      },
    });
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Billing isn&apos;t configured yet (missing Paddle keys). Your trial keeps
        working in the meantime.
      </p>
    );
  }

  return (
    <span>
      <button
        onClick={openCheckout}
        disabled={!ready}
        className={
          primary
            ? "rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            : "rounded-md border border-input px-6 py-3 font-semibold hover:border-ring disabled:opacity-50"
        }
      >
        {ready ? label : "Loading payment…"}
      </button>
      {error && <span className="ml-3 text-sm text-destructive">{error}</span>}
    </span>
  );
}
