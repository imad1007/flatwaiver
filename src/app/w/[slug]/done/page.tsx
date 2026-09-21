import { APP } from "@/lib/config";
import { signerLanguage, signerDirection, signerText } from "@/lib/signer-language";

export default async function SigningDonePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const language = signerLanguage((await searchParams).lang);
  return (
    <main lang={language} dir={signerDirection(language)} className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">✓</div>
      <h1 className="mt-4 text-3xl font-bold">{signerText("You're all set!", language)}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {signerText("Your waiver has been signed and recorded.", language)}
      </p>
      <p className="mt-10 text-xs text-muted-foreground/70">Powered by {APP.name}</p>
    </main>
  );
}
