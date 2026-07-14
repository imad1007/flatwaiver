import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { createClient } from "@/lib/supabase/server";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Support — contact the ${APP.name} team`,
  description: `Need help with ${APP.name}? Email our team and we'll get back to you — usually within one business day.`,
};

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mailto = `mailto:${APP.supportEmail}?subject=${encodeURIComponent(
    `${APP.name} support request`
  )}`;

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-bold">Support</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Need help? Email us and we&apos;ll get back to you.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <a
            href={mailto}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Mail className="size-4" />
            Email {APP.supportEmail}
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            Or write to us directly at{" "}
            <a
              href={mailto}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {APP.supportEmail}
            </a>
            . We usually reply within one business day.
          </p>

          {user?.email && (
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground/70">
              Signed in as{" "}
              <span className="font-medium text-foreground/80">{user.email}</span> —
              mention this so we can find your account fast.
            </p>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
