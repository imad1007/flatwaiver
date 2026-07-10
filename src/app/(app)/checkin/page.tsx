import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CheckinButton } from "@/components/checkin-button";
import { EmptyState } from "@/components/empty-state";

interface CheckinRow {
  id: string;
  signed_waiver_id: string;
  checked_in_at: string;
}

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";

  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  let sigQuery = supabase
    .from("signed_waivers")
    .select("id, signer_name, signer_email, is_minor, flagged, signed_at, template_id")
    .order("signed_at", { ascending: false });
  sigQuery = q
    ? sigQuery.ilike("signer_name", `%${q}%`).limit(25)
    : sigQuery.gte("signed_at", todayStart.toISOString()).limit(200);

  const [{ data: signatures }, checkinsResult, { data: templates }] = await Promise.all([
    sigQuery,
    supabase
      .from("checkins")
      .select("id, signed_waiver_id, checked_in_at")
      .gte("checked_in_at", todayStart.toISOString())
      .order("checked_in_at", { ascending: false }),
    supabase.from("waiver_templates").select("id, name"),
  ]);

  // The checkins table ships in migration 0006 — guide setup instead of
  // crashing. Postgres reports a missing table as 42P01; PostgREST reports it
  // as PGRST205 (not in its schema cache).
  if (checkinsResult.error?.code === "42P01" || checkinsResult.error?.code === "PGRST205") {
    return (
      <div>
        <h1 className="text-2xl font-bold">Front desk</h1>
        <div className="mt-6 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">One-time setup needed</p>
          <p className="mt-1">
            Check-ins use a new database table. Run the migration file{" "}
            <code className="rounded bg-amber-500/15 px-1 font-mono">
              supabase/migrations/0006_checkins.sql
            </code>{" "}
            in your Supabase SQL editor, then reload this page.
          </p>
        </div>
      </div>
    );
  }

  const checkins = (checkinsResult.data ?? []) as CheckinRow[];
  const latestCheckin = new Map<string, CheckinRow>();
  for (const c of checkins) {
    if (!latestCheckin.has(c.signed_waiver_id)) latestCheckin.set(c.signed_waiver_id, c);
  }
  const templateNames = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const rows = signatures ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Front desk</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{latestCheckin.size}</span> checked
          in today
        </p>
      </div>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Today&apos;s signers appear automatically. Search to find anyone with a
        signature on file — flagged answers show before you admit them.
      </p>

      {/* Search */}
      <form method="get" className="mt-5 flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search signers by name…"
          className="min-w-64 rounded-md border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
        {q && (
          <Link
            href="/checkin"
            className="self-center pl-1 text-sm text-muted-foreground underline"
          >
            Back to today
          </Link>
        )}
      </form>

      <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {q ? `Results for “${q}”` : "Signed today"}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon={ClipboardCheck}
          title={q ? "No signer by that name" : "No signatures yet today"}
          description={
            q
              ? "No signature on file matches that name. They can sign on the spot via your kiosk or QR code."
              : "As customers sign today, they'll appear here for one-tap check-in."
          }
        />
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Signer</th>
                <th className="px-4 py-3 font-medium">Waiver</th>
                <th className="px-4 py-3 font-medium">Signed</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const checkin = latestCheckin.get(s.id);
                return (
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
                        {s.is_minor && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Minor
                          </span>
                        )}
                        {s.flagged && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            Flagged — review first
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {templateNames.get(s.template_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {q
                        ? new Date(s.signed_at).toLocaleDateString()
                        : new Date(s.signed_at).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </td>
                    <td className="px-4 py-3">
                      <CheckinButton
                        signedWaiverId={s.id}
                        checkinId={checkin?.id}
                        checkedInAt={checkin?.checked_in_at}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
