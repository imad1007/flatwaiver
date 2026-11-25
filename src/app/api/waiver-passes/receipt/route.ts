import { z } from "zod";
import { qrJson, smallJson } from "@/lib/qr-http";
import { qrPassesEnabled, qrRateLimit, receiptPasses, receiptPattern } from "@/lib/qr-pass";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!qrPassesEnabled()) return qrJson({ error: "Passes are not enabled." }, 404);
  try {
    const input = z.object({ receipt: z.string().regex(receiptPattern) }).strict().safeParse(await smallJson(request));
    if (!input.success) return qrJson({ error: "Receipt unavailable." }, 400);
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!await qrRateLimit(`receipt:${ip}`, 30)) return qrJson({ error: "Please wait a minute before trying again." }, 429);
    const passes = await receiptPasses(input.data.receipt);
    return passes ? qrJson({ passes }) : qrJson({ error: "Receipt unavailable. Ask the venue for your pass." }, 404);
  } catch { return qrJson({ error: "Passes are temporarily unavailable. Your signed waiver is safe. Try again or ask the venue." }, 503); }
}
