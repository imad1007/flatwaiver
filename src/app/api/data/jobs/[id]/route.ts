import { z } from "zod";
import {
  transferOwner,
  transferFailure,
  transferBody,
  TransferError,
} from "@/lib/data-transfer-auth";
import { optionsSchema, LIMITS, csvLine } from "@/lib/data-transfer-core.mjs";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { db, admin, caller } = await transferOwner();
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success)
      throw new TransferError("Transfer not found.", 404);
    const { data: job, error } = await db
      .from("data_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!job) throw new TransferError("Transfer not found.", 404);
    const url = new URL(request.url);
    if (url.searchParams.has("download")) {
      if (
        job.status !== "completed" ||
        !job.output_path ||
        Date.parse(job.expires_at) <= Date.now() ||
        !job.output_path.startsWith(`${caller.orgId}/transfers/${id}/`)
      )
        throw new TransferError(
          "This download is not ready or has expired.",
          409,
        );
      const { data, error } = await admin.storage
        .from("uploads")
        .createSignedUrl(job.output_path, 600, { download: true });
      if (error) throw error;
      return Response.redirect(data.signedUrl, 303);
    }
    if (url.searchParams.has("errors")) {
      const encoder = new TextEncoder();
      let offset = 0;
      let first = true;
      const stream = new ReadableStream({
        async pull(controller) {
          try {
            if (first) {
              controller.enqueue(
                encoder.encode(
                  "\uFEFF" + csvLine(["row", "reason", "original_values"]),
                ),
              );
              first = false;
            }
            const { data, error } = await db
              .from("data_import_items")
              .select("row_number,error,data")
              .eq("job_id", id)
              .in("status", ["invalid", "skipped"])
              .order("row_number")
              .range(offset, offset + 199);
            if (error) throw error;
            for (const r of data ?? [])
              controller.enqueue(
                encoder.encode(
                  csvLine([
                    r.row_number,
                    r.error,
                    r.data.original_values ?? r.data,
                  ]),
                ),
              );
            offset += 200;
            if (!data || data.length < 200) controller.close();
          } catch {
            controller.error(new Error("Error report could not be completed."));
          }
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="flatwaiver-import-errors-${id}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const page = Math.max(
      0,
      Math.floor(Number(url.searchParams.get("page")) || 0),
    );
    const { data: items, error: itemsError } = await db
      .from("data_import_items")
      .select("id,row_number,kind,status,data,error,warnings")
      .eq("job_id", id)
      .order("row_number")
      .range(page * 10, page * 10 + 9);
    if (itemsError) throw itemsError;
    // Storage paths and leases are server details, not client capabilities.
    return Response.json(
      {
        job: {
          id: job.id,
          direction: job.direction,
          format: job.format,
          status: job.status,
          summary: job.summary,
          progress: job.progress,
          total: job.total,
          error: job.error,
          options: job.options,
          expires_at: job.expires_at,
        },
        items: items?.map((item) => ({
          ...item,
          data:
            Buffer.byteLength(JSON.stringify(item.data)) <= 200000
              ? item.data
              : {
                  name: item.data.name,
                  settings: item.data.settings,
                  preview_note:
                    "This template is too large to display here. Review the source JSON before confirming.",
                },
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return transferFailure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { db, admin, caller } = await transferOwner(request);
    const { id } = await context.params;
    const { data: job, error } = await db
      .from("data_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!job) throw new TransferError("Transfer not found.", 404);
    if (Date.parse(job.expires_at) <= Date.now())
      throw new TransferError("Transfer expired. Please start a new one.", 409);
    const body = await transferBody(request);
    if (body.action === "upload") {
      if (job.status !== "uploading")
        throw new TransferError("Uploads are closed for this transfer.", 409);
      const parsed = z
        .array(
          z.object({
            name: z
              .string()
              .min(1)
              .max(200)
              .regex(/^[^/\\\x00-\x1f]+\.(csv|json|pdf|zip|png|jpg|jpeg)$/i),
            size: z.number().int().positive().max(LIMITS.zip),
          }),
        )
        .min(1)
        .max(100)
        .safeParse(body.files);
      if (!parsed.success)
        throw new TransferError(
          "Upload PDF, CSV, JSON, ZIP, PNG or JPEG files within the size limits.",
        );
      const { count, error } = await db
        .from("data_job_files")
        .select("id", { count: "exact", head: true })
        .eq("job_id", id);
      if (error) throw error;
      if ((count ?? 0) + parsed.data.length > LIMITS.files)
        throw new TransferError("Too many files.");
      const uploads = [];
      for (const file of parsed.data) {
        const ext = file.name.split(".").pop()!.toLowerCase();
        if (
          file.size >
          (ext === "zip"
            ? LIMITS.zip
            : ["csv", "json"].includes(ext)
              ? LIMITS.csv
              : LIMITS.file)
        )
          throw new TransferError(`File too large: ${file.name}`);
        const fileId = crypto.randomUUID();
        const path = `${caller.orgId}/transfers/${id}/input/${fileId}.${ext}`;
        const { error: insertError } = await admin
          .from("data_job_files")
          .insert({
            id: fileId,
            job_id: id,
            filename: file.name,
            path,
            size: file.size,
          });
        if (insertError)
          throw new TransferError(
            "A file with this name is already uploaded. Use unique filenames.",
          );
        const { data, error: signedError } = await admin.storage
          .from("uploads")
          .createSignedUploadUrl(path);
        if (signedError) throw signedError;
        uploads.push({ name: file.name, path, token: data.token });
      }
      return Response.json({ uploads });
    }
    let update;
    if (body.action === "preview" && job.status === "uploading") {
      const parsed = optionsSchema.safeParse(body.options);
      if (!parsed.success) throw new TransferError("Invalid mapping options.");
      if (parsed.data.templateId) {
        const { data, error } = await db
          .from("waiver_templates")
          .select("id")
          .eq("id", parsed.data.templateId)
          .maybeSingle();
        if (error || !data) throw new TransferError("Waiver not found.", 404);
      }
      update = { options: parsed.data, status: "queued" };
    } else if (body.action === "confirm" && job.status === "preview") {
      if (!(job.summary.valid > 0))
        throw new TransferError("No valid records to import.");
      if (job.summary.templates > 0) {
        const { data: subscription, error } = await db
          .from("subscriptions")
          .select("status,trial_ends_at")
          .maybeSingle();
        if (
          error ||
          !subscription ||
          (subscription.status !== "active" &&
            !(
              subscription.status === "trialing" &&
              Date.parse(subscription.trial_ends_at) > Date.now()
            ))
        )
          throw new TransferError(
            "An active subscription or trial is required to create template drafts.",
            403,
          );
      }
      // No templates are silently published or existing records overwritten.
      update = {
        status: "ready",
        confirmed_at: new Date().toISOString(),
        attempts: 0,
      };
    } else if (body.action === "retry" && job.status === "failed") {
      update = {
        status: job.confirmed_at ? "ready" : "queued",
        attempts: 0,
        error: null,
      };
    } else if (
      body.action === "cancel" &&
      ["uploading", "preview", "failed"].includes(job.status)
    ) {
      update = { status: "expired", expires_at: new Date().toISOString() };
    } else
      throw new TransferError(
        "This transfer has moved to another step. Refresh and try again.",
        409,
      );
    const { data: changed, error: updateError } = await admin
      .from("data_jobs")
      .update(update)
      .eq("id", id)
      .eq("org_id", caller.orgId)
      .eq("status", job.status)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!changed)
      throw new TransferError("Transfer changed. Refresh and try again.", 409);
    return Response.json({ ok: true });
  } catch (error) {
    return transferFailure(error);
  }
}
