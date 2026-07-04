import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count: signedThisMonth }, { count: totalSigned }, { data: recent }, { data: templates }] =
    await Promise.all([
      supabase
        .from("signed_waivers")
        .select("id", { count: "exact", head: true })
        .gte("signed_at", monthStart.toISOString()),
      supabase.from("signed_waivers").select("id", { count: "exact", head: true }),
      supabase
        .from("signed_waivers")
        .select("id, signer_name, signed_at, signing_channel, template_id")
        .order("signed_at", { ascending: false })
        .limit(8),
      supabase.from("waiver_templates").select("id, name, status"),
    ]);

  const templateNames = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const publishedCount = (templates ?? []).filter((t) => t.status === "published").length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Signed this month" value={signedThisMonth ?? 0} />
        <StatCard label="Signed all-time" value={totalSigned ?? 0} />
        <StatCard label="Live waivers" value={publishedCount} />
      </div>

      {/* Quick links */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/waivers/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          New waiver
        </Link>
        <Link
          href="/waivers"
          className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:border-ring"
        >
          Manage waivers
        </Link>
        <Link
          href="/signatures"
          className="rounded-md border border-input px-4 py-2 text-sm font-semibold hover:border-ring"
        >
          Search signatures
        </Link>
      </div>

      {/* Recent signatures */}
      <h2 className="mt-10 text-lg font-bold">Recent signatures</h2>
      {!recent || recent.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-input p-10 text-center text-muted-foreground">
          <p>No signatures yet.</p>
          <p className="mt-1 text-sm">
            {publishedCount === 0
              ? "Publish a waiver and share its link to start collecting."
              : "Share your signing link or QR code to start collecting."}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Signer</th>
                <th className="px-4 py-3 font-medium">Waiver</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Signed</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/signatures/${s.id}`} className="font-medium hover:underline">
                      {s.signer_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {templateNames.get(s.template_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.signing_channel}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.signed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-5">
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
