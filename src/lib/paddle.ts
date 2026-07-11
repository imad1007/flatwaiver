import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubscriptionStatus } from "@/lib/types";

/** Max accepted age of a webhook (replay protection). */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function paddleApiBase(): string {
  return process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

/**
 * Verify a Paddle webhook signature.
 * Header format: `ts=<unix>;h1=<hmac>[;h1=<hmac>…]` — the signed payload is
 * `${ts}:${rawBody}`, HMAC-SHA256 with the notification-destination secret.
 * Multiple h1 values can appear during secret rotation; any match passes.
 */
export function verifyPaddleWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = new Map<string, string[]>();
  for (const pair of signatureHeader.split(";")) {
    const [key, value] = pair.split("=", 2);
    if (!key || !value) continue;
    const list = parts.get(key.trim()) ?? [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }

  const ts = parts.get("ts")?.[0];
  const candidates = parts.get("h1") ?? [];
  if (!ts || candidates.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > WEBHOOK_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "utf8");
    return (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    );
  });
}

/** Map a Paddle subscription status onto our four-state enum. */
export function mapPaddleStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "paused":
      return "past_due";
    default:
      // canceled and anything unknown → not usable
      return "canceled";
  }
}

/**
 * Create a customer-portal session and return its overview URL
 * (subscription management: payment method, cancel, invoices).
 */
export async function createPaddlePortalUrl(customerId: string): Promise<string | null> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    `${paddleApiBase()}/customers/${customerId}/portal-sessions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) {
    console.error("Paddle portal session failed", res.status, await res.text());
    return null;
  }
  const body = (await res.json()) as {
    data?: { urls?: { general?: { overview?: string } } };
  };
  return body.data?.urls?.general?.overview ?? null;
}
