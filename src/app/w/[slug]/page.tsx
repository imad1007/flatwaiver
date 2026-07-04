import type { Metadata } from "next";
import { getPublishedWaiverBySlug } from "@/lib/public-waiver";
import { SigningForm } from "@/components/signing-form";
import { APP } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const waiver = await getPublishedWaiverBySlug(slug);
  return {
    title: waiver ? `${waiver.name} — ${waiver.orgName}` : "Waiver not found",
    robots: { index: false },
  };
}

export default async function PublicSigningPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const waiver = await getPublishedWaiverBySlug(slug);

  if (!waiver) {
    return (
      <NotAvailable message="This waiver link doesn't exist or is no longer active." />
    );
  }
  if (!waiver.acceptingSignatures) {
    return (
      <NotAvailable message="This business's waiver collection is paused. Please check with the staff." />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">{waiver.orgName}</p>
        <h1 className="text-2xl font-bold">{waiver.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Please read the waiver below, fill in your details, and sign.
        </p>
      </header>

      <SigningForm
        slug={waiver.slug}
        waiverName={waiver.name}
        orgName={waiver.orgName}
        blocks={waiver.version.body}
        fields={waiver.version.fields}
        consentText={waiver.version.consent_text}
        minorMode={waiver.version.minor_mode}
        channel="link"
      />

      <footer className="mt-10 text-center text-xs text-muted-foreground/70">
        Powered by {APP.name}
      </footer>
    </main>
  );
}

function NotAvailable({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Waiver unavailable</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{message}</p>
    </main>
  );
}
