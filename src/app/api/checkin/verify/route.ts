import { z } from "zod";
import { qrStaff, qrJson, smallJson } from "@/lib/qr-http";
import { hashSecret, passPattern } from "@/lib/qr-pass";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const caller = await qrStaff(request); if (caller instanceof Response) return caller;
    const input = z.object({ code: z.string().regex(passPattern), checkIn: z.boolean().default(false), visit: z.string().regex(/^(day:[0-9]{4}-[0-9]{2}-[0-9]{2}|session:[A-Za-z0-9 _.-]{1,80})$/).optional() }).strict().safeParse(await smallJson(request));
    if (!input.success) return qrJson({ status: "invalid" });
    const { data, error } = await createAdminClient().rpc("verify_waiver_pass", { p_hash: hashSecret(input.data.code), p_actor: caller.userId, p_visit: input.data.visit ?? null, p_checkin: input.data.checkIn });
    if (error) return qrJson({ error: "Could not verify the waiver. Try again." }, 503);
    return qrJson(data);
  } catch { return qrJson({ error: "Verification is temporarily unavailable. Try again." }, 503); }
}
