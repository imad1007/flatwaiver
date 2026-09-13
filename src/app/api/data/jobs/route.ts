import { z } from "zod";
import {
  transferOwner,
  transferFailure,
  transferBody,
  TransferError,
} from "@/lib/data-transfer-auth";
import { optionsSchema } from "@/lib/data-transfer-core.mjs";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { db } = await transferOwner();
    const page = Math.max(
      0,
      Math.min(
        10000,
        Number(new URL(request.url).searchParams.get("page")) || 0,
      ),
    );
    const { data, error } = await db
      .from("data_jobs")
      .select(
        "id,direction,format,status,summary,progress,total,error,created_at,expires_at,confirmed_at",
      )
      .order("created_at", { ascending: false })
      .range(page * 20, page * 20 + 19);
    if (error) throw error;
    return Response.json(
      { jobs: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return transferFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { caller, admin, db } = await transferOwner(request);
    const parsed = z
      .object({
        direction: z.enum(["import", "export"]),
        format: z.enum([
          "csv",
          "pdfs",
          "backup",
          "templates",
          "template",
          "historical",
          "restore",
        ]),
        options: optionsSchema,
      })
      .safeParse(await transferBody(request));
    if (!parsed.success)
      throw new TransferError("Invalid transfer options or date range.");
    const { direction, format, options } = parsed.data;
    if (
      !(
        direction === "export"
          ? ["csv", "pdfs", "backup", "templates"]
          : ["csv", "template", "historical", "restore"]
      ).includes(format)
    )
      throw new TransferError("Unsupported transfer type.");
    const templateId = options.templateId || options.filters.template;
    if (templateId) {
      const { data, error } = await db
        .from("waiver_templates")
        .select("id")
        .eq("id", templateId)
        .maybeSingle();
      if (error || !data) throw new TransferError("Waiver not found.", 404);
    }
    const { count, error: countError } = await db
      .from("data_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["uploading", "queued", "ready", "processing", "preview"])
      .gt("expires_at", new Date().toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= 5)
      throw new TransferError(
        "Finish or cancel an existing transfer before starting another.",
        429,
      );
    const { data, error } = await admin
      .from("data_jobs")
      .insert({
        org_id: caller.orgId,
        user_id: caller.userId,
        direction,
        format,
        options,
        status: direction === "export" ? "queued" : "uploading",
      })
      .select("id")
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return transferFailure(error);
  }
}
