import { z } from "zod";
import { qrStaff, qrJson, smallJson } from "@/lib/qr-http";
import { ensurePasses } from "@/lib/qr-pass";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const caller = await qrStaff(request); if (caller instanceof Response) return caller;
    const input = z.object({ signatureId: z.string().uuid() }).strict().safeParse(await smallJson(request));
    if (!input.success) return qrJson({ error: "Invalid record." }, 400);
    const { data, error } = await (await createClient()).from("signed_waivers").select("id").eq("id", input.data.signatureId).eq("org_id", caller.orgId).maybeSingle();
    if (error) return qrJson({ error: "Could not load the record." }, 503);
    if (!data) return qrJson({ error: "Record unavailable." }, 404);
    return qrJson({ passes: await ensurePasses(data.id, { actor: caller.userId }) });
  } catch { return qrJson({ error: "Passes are temporarily unavailable." }, 503); }
}
