import Link from "next/link";
import { requireOrgRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  filtersSchema,
  filterQuery,
  sourceLabel,
} from "@/lib/data-transfer-core.mjs";

export default async function ImportedRecords({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireOrgRole("owner");
  const params = await searchParams;
  const db = await createClient();
  const parsed = filtersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : filtersSchema.parse({});
  const page = Math.max(0, Math.floor(Number(params.page) || 0));
  const { data, error, count } = await filterQuery(
    db
      .from("imported_waivers")
      .select(
        "id,source_provider,participant_name,participant_email,waiver_title,original_signed_at,imported_at,pdf_path",
        { count: "exact" },
      ),
    filters,
    false,
  )
    .order("imported_at", { ascending: false })
    .order("id")
    .range(page * 50, page * 50 + 49);
  if (error) throw new Error("Couldn't load imported records.");
  const href = (n: number) =>
    `/data/records?${new URLSearchParams({ ...params, page: String(n) })}`;
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/data" className="text-sm text-primary hover:underline">
        ← Import &amp; Export
      </Link>
      <h1 className="mt-3 text-3xl font-bold">Imported records</h1>
      <p className="mt-2 text-muted-foreground">
        Original documents and source metadata from your previous platform.
        These were not signed through FlatWaiver.
      </p>
      <form className="my-6 flex flex-wrap gap-3">
        {[
          ["q", "Participant name"],
          ["email", "Participant email"],
          ["from", "From date"],
          ["to", "To date"],
        ].map(([k, label]) => (
          <label key={k} className="text-xs">
            {label}
            <input
              name={k}
              defaultValue={params[k]}
              type={["from", "to"].includes(k) ? "date" : "text"}
              className="mt-1 block rounded-lg border bg-background p-2 text-sm"
            />
          </label>
        ))}
        <button className="self-end rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          Search
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        {count ?? 0} imported records
      </p>
      <div className="mt-3 divide-y rounded-xl border">
        {data?.length ? (
          data.map(
            (r: {
              id: string;
              participant_name: string;
              participant_email: string;
              source_provider: string;
              original_signed_at: string;
              imported_at: string;
              pdf_path: string;
            }) => (
              <Link
                key={r.id}
                href={`/data/records/${r.id}`}
                className="block space-y-1 p-4 hover:bg-muted"
              >
                <p className="font-semibold">
                  {r.participant_name || "Unnamed participant"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.participant_email || "No email"} · Imported from{" "}
                  {sourceLabel(r.source_provider)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Imported date: {new Date(r.imported_at).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Source signing date:{" "}
                  {r.original_signed_at
                    ? new Date(r.original_signed_at).toLocaleString()
                    : "Not provided"}{" "}
                  · {r.pdf_path ? "Original PDF available" : "Metadata only"}
                </p>
              </Link>
            ),
          )
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No imported records match these filters.
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        {page > 0 && <Link href={href(page - 1)}>Previous</Link>}
        {(page + 1) * 50 < (count ?? 0) && (
          <Link href={href(page + 1)}>Next</Link>
        )}
      </div>
    </div>
  );
}
