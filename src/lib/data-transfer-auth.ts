import "server-only";
import { getOrgCaller } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export class TransferError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function transferOwner(request?: Request) {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new TransferError("Invalid request origin.", 403);
  }
  const caller = await getOrgCaller();
  if (!caller) throw new TransferError("Sign in to manage your data.", 401);
  if (caller.role !== "owner")
    throw new TransferError(
      "Only the account owner can manage imports and backups.",
      403,
    );
  return { caller, admin: createAdminClient(), db: await createClient() };
}
export function transferFailure(error: unknown) {
  if (error instanceof TransferError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Data transfer request failed",
    error instanceof Error ? error.message : "Database failure",
  );
  return Response.json(
    { error: "We couldn't complete this request. Please try again." },
    { status: 500 },
  );
}
export async function transferBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new TransferError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256 * 1024) {
      await reader.cancel();
      throw new TransferError("Request too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TransferError("Invalid JSON.");
  }
}
