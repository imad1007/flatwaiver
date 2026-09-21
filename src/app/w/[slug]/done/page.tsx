import { APP } from "@/lib/config";

export default async function SigningDonePage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const french = (await searchParams).lang === "fr";
  return (
    <main lang={french ? "fr" : "en"} className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">✓</div>
      <h1 className="mt-4 text-3xl font-bold">{french ? "C’est fait !" : "You're all set!"}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {french ? "Votre document a été signé et enregistré. Si vous avez fourni une adresse e-mail, une copie vous sera envoyée." : "Your waiver has been signed and recorded. If you provided an email address, a copy is on its way to your inbox."}
      </p>
      <p className="mt-10 text-xs text-muted-foreground/70">Powered by {APP.name}</p>
    </main>
  );
}
