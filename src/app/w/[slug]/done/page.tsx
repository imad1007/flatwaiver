import { APP } from "@/lib/config";
import { SignerPasses } from "@/components/waiver-passes";
import { qrPassesEnabled } from "@/lib/qr-pass";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
import { signerLanguage, signerDirection, signerText } from "@/lib/signer-language";

export default async function SigningDonePage({ searchParams, params }: { searchParams: Promise<{ lang?: string }>; params: Promise<{ slug: string }> }) {
  const language = signerLanguage((await searchParams).lang);
  const { slug } = await params;
  return (
    <main lang={language} dir={signerDirection(language)} className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-6xl">✓</div>
      <h1 className="mt-4 text-3xl font-bold">{signerText("You're all set!", language)}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {signerText("Your waiver has been signed and recorded.", language)}
      </p>
      {qrPassesEnabled() && <SignerPasses slug={slug} />}
      <p className="mt-10 text-xs text-muted-foreground/70">Powered by {APP.name}</p>
    </main>
  );
}
