import "server-only";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSafeWebhookUrl } from "@/lib/webhook-url";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SignatureCreatedPayload {
  event: "signature.created";
  id: string;
  waiver: { id: string; name: string };
  signer_name: string;
  signer_email: string | null;
  is_minor: boolean;
  flagged: boolean;
  tag: string | null;
  channel: string;
  signed_at: string;
}

const DELIVERY_TIMEOUT_MS = 5000;

/**
 * Fire all enabled webhook endpoints for an org with an HMAC-signed payload.
 * Best-effort and self-contained: it never throws, so a webhook problem can
 * never fail the signing request that triggered it. Each attempt is logged.
 */
export async function dispatchWebhooks(
  orgId: string,
  payload: SignatureCreatedPayload
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: endpoints } = await admin
      .from("webhook_endpoints")
      .select("id, url, secret")
      .eq("org_id", orgId)
      .eq("enabled", true);
    if (!endpoints || endpoints.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      endpoints.map((ep) => deliver(admin, orgId, ep, payload.event, body))
    );
  } catch (err) {
    console.error("dispatchWebhooks failed", err);
  }
}

async function deliver(
  admin: AdminClient,
  orgId: string,
  ep: { id: string; url: string; secret: string },
  event: string,
  body: string
): Promise<void> {
  const signature = createHmac("sha256", ep.secret).update(body).digest("hex");
  let statusCode: number | null = null;
  let ok = false;
  let error: string | null = null;

  try {
    const safeUrl = await assertSafeWebhookUrl(ep.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(safeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FlatWaiver-Event": event,
          "X-FlatWaiver-Signature": `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
        redirect: "manual",
      });
    } finally {
      clearTimeout(timer);
    }
    statusCode = res.status;
    ok = res.ok;
  } catch (e) {
    error = e instanceof Error ? e.message : "delivery failed";
  }

  await admin.from("webhook_deliveries").insert({
    org_id: orgId,
    endpoint_id: ep.id,
    event,
    status_code: statusCode,
    ok,
    error,
  });
}
