import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  from?: string;
  to?: string;
  template?: string;
  flagged?: string;
  page?: string;
}

export default async function SignaturesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const templateFilter = params.template ?? "";
  const flaggedOnly = params.flagged === "1";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("waiver_templates")
    .select("id, name")
    .order("name");

  let query = supabase
    .from("signed_waivers")
    .select(
      "id, signer_name, signer_email, is_minor, flagged, signed_at, signing_channel, template_id",
      { count: "exact" }
    )
    .order("signed_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.ilike("signer_name", `%${q}%`);
  if (from) query = query.gte("signed_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("signed_at", `${to}T23:59:59Z`);
  if (templateFilter) query = query.eq("template_id", templateFilter);
  if (flaggedOnly) query = query.eq("flagged", true);

  const { data: rows, count } = await query;
  const templateNames = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", q);
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  if (templateFilter) exportQuery.set("template", templateFilter);
  if (flaggedOnly) exportQuery.set("flagged", "1");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Signatures</h1>
        <a
          href={`/api/signatures/export?${exportQuery.toString()}`}
          className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:border-ring"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Signer name
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search names…"
            className="rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Waiver</span>
          <select
            name="template"
            defaultValue={templateFilter}
            className="rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="">All waivers</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-center pb-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="flagged"
            value="1"
            defaultChecked={flaggedOnly}
            className="size-4 accent-warning"
          />
          Flagged only
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        {(q || from || to || templateFilter || flaggedOnly) && (
          <Link href="/signatures" className="text-sm text-muted-foreground underline">
            Clear
          </Link>
        )}
      </form>

      {/* Results */}
      <p className="mt-4 text-sm text-muted-foreground">
        {count ?? 0} signature{(count ?? 0) === 1 ? "" : "s"}
      </p>

      <div className="mt-2 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Signer</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Waiver</th>
              <th className="px-4 py-3 font-medium">Minor</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Signed</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground/70">
                  No signatures match these filters.
                </td>
              </tr>
            ) : (
              (rows ?? []).map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-border/60 last:border-0 ${s.flagged ? "bg-amber-500/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/signatures/${s.id}`}
                      className="inline-flex items-center gap-2 font-medium hover:underline"
                    >
                      {s.signer_name}
                      {s.flagged && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          Flagged
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.signer_email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {templateNames.get(s.template_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.is_minor ? "Yes" : ""}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.signing_channel}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.signed_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={buildPageHref(params, page - 1)}
              className="rounded-md border border-input px-3 py-1.5 hover:border-ring"
            >
              ← Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageHref(params, page + 1)}
              className="rounded-md border border-input px-3 py-1.5 hover:border-ring"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function buildPageHref(params: SearchParams, page: number): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.template) qs.set("template", params.template);
  if (params.flagged === "1") qs.set("flagged", "1");
  qs.set("page", String(page));
  return `/signatures?${qs.toString()}`;
}
