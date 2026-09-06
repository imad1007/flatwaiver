import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { DataLoadError } from "@/components/data-load-error";
import { ROLE_LABEL, normalizeRole } from "@/lib/permissions";

export const runtime = "nodejs";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Team invitation",
};

/** Whether an ISO timestamp is in the past. Kept at module scope so the
 *  impure time read doesn't run inside the component's render. */
function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/**
 * Invitation landing page. The actual enrollment happens by email match in the
 * auth bootstrap (src/lib/bootstrap.ts) the moment the invited person signs in —
 * this page just resolves the token, tells them who invited them, and routes
 * them to sign up / sign in with the right address.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite, error: inviteError } = await admin
    .from("invitations")
    .select("email, role, expires_at, accepted_at, org_id")
    .eq("token", token)
    .maybeSingle();

  const orgResult = invite
    ? await admin
        .from("organizations")
        .select("name")
        .eq("id", invite.org_id)
        .single()
    : { data: null, error: null };
  const org = orgResult.data;
  const loadFailed = Boolean(inviteError || orgResult.error);

  const invalid =
    !invite || invite.accepted_at !== null || isPast(invite.expires_at);

  // If already signed in with the invited address, send them into the app —
  // bootstrap enrolls them in the org on the way to the dashboard.
  if (!loadFailed && invite && !invalid) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && user.email.trim().toLowerCase() === invite.email.toLowerCase()) {
      redirect("/dashboard");
    }
  }

  const next = `/invite/${token}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <Logo className="mb-8" />
      <div className="rounded-2xl border border-border p-6">
        {loadFailed ? (
          <DataLoadError
            title="We couldn't load this invitation"
            description="The invitation was not changed. Check your connection and try again."
            retryHref={next}
            className="border-0 bg-transparent p-0"
          />
        ) : invalid ? (
          <>
            <h1 className="text-xl font-bold">This invitation isn&apos;t valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have already been used or expired. Ask whoever invited you to
              send a fresh one.
            </p>
            <Button className="mt-6" render={<Link href="/login">Go to sign in</Link>} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold">
              You&apos;re invited to {org?.name ?? "a team"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Join as <strong>{ROLE_LABEL[normalizeRole(invite!.role)]}</strong> using{" "}
              <strong>{invite!.email}</strong>. Create your account with that exact
              address and you&apos;ll join the team automatically.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                render={
                  <Link href={`/signup?email=${encodeURIComponent(invite!.email)}&next=${encodeURIComponent(next)}`}>
                    Create my account
                  </Link>
                }
              />
              <Button
                variant="outline"
                render={
                  <Link href={`/login?next=${encodeURIComponent(next)}`}>
                    I already have an account
                  </Link>
                }
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
