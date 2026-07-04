import type { Metadata } from "next";
import { getPublishedWaiverBySlug } from "@/lib/public-waiver";
import { SigningForm } from "@/components/signing-form";
import { WakeLock } from "@/components/wake-lock";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const waiver = await getPublishedWaiverBySlug(slug);
  return {
    title: waiver ? `${waiver.name} — Kiosk` : "Waiver not found",
    robots: { index: false },
  };
}

export default async function KioskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const waiver = await getPublishedWaiverBySlug(slug);

  if (!waiver || !waiver.acceptingSignatures) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Waiver unavailable</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          {!waiver
            ? "This waiver link doesn't exist or is no longer active."
            : "This business's waiver collection is paused."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <WakeLock />
      <header className="mb-6 text-center">
        <p className="text-base font-medium text-muted-foreground">{waiver.orgName}</p>
        <h1 className="text-3xl font-bold">{waiver.name}</h1>
      </header>

      <SigningForm
        slug={waiver.slug}
        waiverName={waiver.name}
        orgName={waiver.orgName}
        blocks={waiver.version.body}
        fields={waiver.version.fields}
        consentText={waiver.version.consent_text}
        minorMode={waiver.version.minor_mode}
        channel="kiosk"
        kiosk
      />
    </main>
  );
}
