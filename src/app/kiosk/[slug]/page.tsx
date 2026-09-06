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
  const waiver = await getPublishedWaiverBySlug(slug).catch(() => null);
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
  let waiver;
  try {
    waiver = await getPublishedWaiverBySlug(slug);
  } catch {
    return (
      <KioskUnavailable message="The waiver service is temporarily unavailable. Check your connection and try again." retry />
    );
  }

  if (!waiver || !waiver.acceptingSignatures) {
    return <KioskUnavailable message={!waiver
      ? "This waiver link doesn't exist or is no longer active."
      : "This business's waiver collection is paused."} />;
  }

  const brandStyle = waiver.branding.color
    ? ({ "--primary": waiver.branding.color, "--ring": waiver.branding.color } as React.CSSProperties)
    : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8" style={brandStyle}>
      <WakeLock />
      <header className="mb-6 text-center">
        {waiver.branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={waiver.branding.logoUrl}
            alt={`${waiver.orgName} logo`}
            className="mx-auto mb-3 h-14 object-contain"
          />
        )}
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
        photoMode={waiver.photoMode}
        kiosk
      />
    </main>
  );
}

function KioskUnavailable({ message, retry = false }: { message: string; retry?: boolean }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Waiver unavailable</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{message}</p>
      {retry && (
        <a href="" className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Try again
        </a>
      )}
    </main>
  );
}
