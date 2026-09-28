import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { getPublishedWaiverBySlug } from "@/lib/public-waiver";
import { SigningForm } from "@/components/signing-form";
import { APP } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const waiver = await getPublishedWaiverBySlug(slug).catch(() => null);
  return {
    title: waiver ? `${waiver.name} — ${waiver.orgName}` : "Waiver not found",
    robots: { index: false },
  };
}

export default async function PublicSigningPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { slug } = await params;
  const { tag } = await searchParams;
  let waiver;
  try {
    waiver = await getPublishedWaiverBySlug(slug);
  } catch {
    return <NotAvailable message="The waiver service is temporarily unavailable. Check your connection and try again." retry />;
  }

  if (!waiver) {
    return (
      <NotAvailable message="This waiver link doesn't exist or is no longer active." />
    );
  }
  if (!waiver.acceptingSignatures) {
    const canManageBilling = await viewerOwnsOrganization(waiver.orgId);
    return <BillingSuspension canManageBilling={canManageBilling} />;
  }

  const brandStyle = waiver.branding.color
    ? ({ "--primary": waiver.branding.color, "--ring": waiver.branding.color } as React.CSSProperties)
    : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8" style={brandStyle}>
      <header className="mb-6">
        {waiver.branding.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={waiver.branding.logoUrl}
            alt={`${waiver.orgName} logo`}
            className="mb-3 h-12 object-contain"
          />
        )}
        <p className="text-sm font-medium text-muted-foreground">{waiver.orgName}</p>
        <h1 className="text-2xl font-bold">{waiver.name}</h1>
      </header>

      <SigningForm
        defaultLanguage={waiver.version.signer_language}
        slug={waiver.slug}
        waiverName={waiver.name}
        orgName={waiver.orgName}
        blocks={waiver.version.body}
        fields={waiver.version.fields}
        consentText={waiver.version.consent_text}
        minorMode={waiver.version.minor_mode}
        channel="link"
        photoMode={waiver.photoMode}
        tag={typeof tag === "string" ? tag.slice(0, 200) : undefined}
      />

      <footer className="mt-10 text-center text-xs text-muted-foreground/70">
        Powered by {APP.name}
      </footer>
    </main>
  );
}

async function viewerOwnsOrganization(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .eq("org_id", orgId)
    .eq("role", "owner")
    .maybeSingle();
  return !error && Boolean(data);
}

function BillingSuspension({ canManageBilling }: { canManageBilling: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 text-center shadow-card sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <CreditCard className="size-6" aria-hidden />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Signing temporarily paused</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">This waiver is temporarily unavailable</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          This waiver is temporarily unavailable because this organization&apos;s FlatWaiver subscription requires attention.
        </p>
        {canManageBilling && (
          <Link href="/settings/billing" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Review billing and restore signing
          </Link>
        )}
        <div className="mt-7 flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Existing waiver records remain securely stored.
        </div>
      </section>
    </main>
  );
}

function NotAvailable({ message, retry = false }: { message: string; retry?: boolean }) {
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
