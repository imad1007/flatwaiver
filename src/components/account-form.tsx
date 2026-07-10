"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updateBusinessName } from "@/app/(app)/settings/account/actions";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none";

export function AccountForm({
  email,
  orgName,
}: {
  email: string;
  orgName: string;
}) {
  const [name, setName] = useState(orgName);
  const [isPending, startTransition] = useTransition();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateBusinessName(name);
        toast.success("Business name saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save the name.");
      }
    });
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError("The passwords don't match.");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    toast.success("Password updated");
  }

  return (
    <div className="space-y-8">
      {/* Login email */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="font-bold">Login email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You sign in with this address, and signature notifications go here.
        </p>
        <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 font-mono text-sm">{email}</p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Need to change it? Contact support — email changes require identity
          confirmation.
        </p>
      </section>

      {/* Business name */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="font-bold">Business name</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown to signers on your public waiver pages and printed in the header
          of every signed PDF.
        </p>
        <form onSubmit={handleNameSubmit} className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Business name"
            className={`${inputClass} min-w-56 flex-1`}
          />
          <Button type="submit" disabled={isPending || name.trim() === orgName}>
            {isPending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="font-bold">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          At least 8 characters. You stay signed in on this device.
        </p>
        <form onSubmit={handlePasswordSubmit} className="mt-3 max-w-sm space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              New password
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Confirm new password
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={inputClass}
            />
          </label>
          {passwordError && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {passwordError}
            </p>
          )}
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Update password"}
          </Button>
        </form>
      </section>

      {/* Session */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="font-bold">Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signs you out on all devices, including any front-desk tablets logged
          into this account. Public signing links and kiosks keep working — they
          don&apos;t use your login.
        </p>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </section>
    </div>
  );
}
