import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SharePanel } from "@/components/share-panel";
import { APP } from "@/lib/config";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("waiver_templates")
    .select("id, name, slug, status")
    .eq("id", id)
    .maybeSingle();
  if (!template) notFound();

  const base = APP.url?.replace(/\/$/, "") ?? "";
  const signingUrl = `${base}/w/${template.slug}`;
  const kioskUrl = `${base}/kiosk/${template.slug}`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/waivers/${template.id}`} className="text-sm text-neutral-500 hover:underline">
        ← {template.name}
      </Link>
      <h1 className="mt-1 text-2xl font-bold">Share &ldquo;{template.name}&rdquo;</h1>

      {template.status !== "published" ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
          This waiver isn&apos;t published{template.status === "archived" ? " (archived)" : ""}.
          The links below won&apos;t work until you publish it.
        </div>
      ) : null}

      <SharePanel signingUrl={signingUrl} kioskUrl={kioskUrl} />
    </div>
  );
}
