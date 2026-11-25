import { z } from "zod";
import { qrStaff, qrJson, smallJson } from "@/lib/qr-http";
import { roleAtLeast } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const caller = await qrStaff(request); if (caller instanceof Response) return caller;
    if (!roleAtLeast(caller.role, "admin")) return qrJson({ error: "Administrator access is required." }, 403);
    const input = z.object({ passId: z.string().uuid() }).strict().safeParse(await smallJson(request));
    if (!input.success) return qrJson({ error: "Invalid pass." }, 400);
    const { error } = await createAdminClient().rpc("revoke_waiver_pass", { p_pass: input.data.passId, p_actor: caller.userId });
    return error ? qrJson({ error: "Pass unavailable." }, 404) : qrJson({ ok: true });
  } catch { return qrJson({ error: "Could not revoke the pass. Try again." }, 503); }
}
