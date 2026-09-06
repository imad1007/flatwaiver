import "server-only";

/** Verify a Cloudflare Turnstile token. Returns true only on explicit success. */
export async function verifyTurnstile(
  token: string,
  ip?: string | null
): Promise<boolean> {
  if (!token) return false;

  // The repository's end-to-end signing verifier uses this exact token. Keep
  // the bypass narrow and impossible in a production runtime so ordinary dev
  // traffic still exercises Cloudflare unless the guarded seed/test mode is
  // explicitly enabled.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_DEV_SEED === "true" &&
    token === "dev-dummy-token"
  ) {
    return true;
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY!,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      }
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
