import { APP } from "@/lib/config";

export default function SigningDonePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">✓</div>
      <h1 className="mt-4 text-3xl font-bold">You&apos;re all set!</h1>
      <p className="mt-3 max-w-md text-neutral-600">
        Your waiver has been signed and recorded. If you provided an email
        address, a copy is on its way to your inbox.
      </p>
      <p className="mt-10 text-xs text-neutral-400">Powered by {APP.name}</p>
    </main>
  );
}
