import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { WaiverTemplate } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground/90",
  published: "bg-success/15 text-success",
  archived: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export default async function WaiversPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("waiver_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  const list = (templates ?? []) as WaiverTemplate[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Waivers</h1>
        <Link
          href="/waivers/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          New waiver
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="mt-16 rounded-xl border border-dashed border-input p-12 text-center">
          <p className="text-lg font-semibold">No waivers yet</p>
          <p className="mt-2 text-muted-foreground">
            Upload the PDF waiver you already use — it&apos;ll be live in about 5
            minutes.
          </p>
          <Link
            href="/waivers/new"
            className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Create your first waiver
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/waivers/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? ""}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "published" && (
                      <Link
                        href={`/waivers/${t.id}/share`}
                        className="text-sm font-medium underline"
                      >
                        Share
                      </Link>
                    )}
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
