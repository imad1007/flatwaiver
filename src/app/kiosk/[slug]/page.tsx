import type { Metadata } from "next";
import { cache } from "react";
import { kioskHiddenFields } from "@/lib/kiosk-settings";
import { getPublishedWaiverBySlug } from "@/lib/public-waiver";
import { SigningForm } from "@/components/signing-form";
import { qrPassesEnabled } from "@/lib/qr-pass";
import { WakeLock } from "@/components/wake-lock";

// Request-scoped only: metadata and page share one lookup; submission still
// resolves current publication/billing state independently on the server.
const loadKioskWaiver = cache(getPublishedWaiverBySlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const waiver = await loadKioskWaiver(slug).catch(() => null);
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
    waiver = await loadKioskWaiver(slug);
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8" style={brandStyle}>
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
        qrPassesEnabled={qrPassesEnabled()}
        defaultLanguage={waiver.version.signer_language}
        slug={waiver.slug}
        waiverName={waiver.name}
        orgName={waiver.orgName}
        blocks={waiver.version.body}
        fields={waiver.version.fields}
        consentText={waiver.version.consent_text}
        groupSigningEnabled={waiver.version.group_signing_enabled ?? false}
        minorMode={waiver.version.minor_mode}
        channel="kiosk"
        documentDisplay={waiver.documentDisplay}
        photoMode={waiver.photoMode}
        kiosk
        kioskWelcome={waiver.kioskSettings.welcome}
        kioskInstructions={waiver.kioskSettings.instructions}
        kioskHiddenFields={kioskHiddenFields(waiver.kioskSettings, waiver.templateId, waiver.version.fields)}
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
