import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SharePanel } from "@/components/share-panel";
import { SendWaiverForm } from "@/components/send-waiver-form";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";
import { DataLoadError } from "@/components/data-load-error";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("waiver_templates")
    .select("id, name, slug, status")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <DataLoadError
        retryHref={`/waivers/${id}/share`}
        title="We couldn't load the sharing tools"
        description="No link or waiver was changed. Try loading this page again."
      />
    );
  }
  if (!template) notFound();

  const base = APP.url?.replace(/\/$/, "") ?? "";
  const signingUrl = `${base}/w/${template.slug}`;
  const kioskUrl = `${base}/kiosk/${template.slug}`;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/waivers/${template.id}`} className="text-sm text-muted-foreground hover:underline">
        ← {template.name}
      </Link>
      <h1 className="mt-1 text-2xl font-bold">Share &ldquo;{template.name}&rdquo;</h1>

      {template.status !== "published" ? (
        <div className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200">
          <p className="font-semibold">
            This waiver isn&apos;t available to sign
            {template.status === "archived" ? " because it is archived" : " yet"}.
          </p>
          <p className="mt-1 text-sm">
            {template.status === "archived"
              ? "Restore it before sharing its link or QR code."
              : "Publish the draft before sharing it with customers."}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            render={<Link href={`/waivers/${template.id}`} />}
          >
            {template.status === "archived" ? "Restore waiver" : "Review and publish"}
          </Button>
        </div>
      ) : null}

      {template.status === "published" && (
        <>
          <SharePanel signingUrl={signingUrl} kioskUrl={kioskUrl} />
          <SendWaiverForm templateId={template.id} />
        </>
      )}
    </div>
  );
}
