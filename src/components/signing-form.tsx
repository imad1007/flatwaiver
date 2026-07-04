"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/components/signature-canvas";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { SigningChannel, WaiverBlock, WaiverField } from "@/lib/types";

export interface SigningFormProps {
  slug: string;
  waiverName: string;
  orgName: string;
  blocks: WaiverBlock[];
  fields: WaiverField[];
  consentText: string;
  minorMode: "allowed" | "disallowed";
  channel: SigningChannel;
  /** Kiosk: on success show the done screen inline and auto-reset after 5 s. */
  kiosk?: boolean;
}

export function SigningForm(props: SigningFormProps) {
  const router = useRouter();
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kioskDone, setKioskDone] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const signatureRef = useRef<SignatureCanvasHandle>(null);
  const guardianSignatureRef = useRef<SignatureCanvasHandle>(null);

  function resetForm() {
    setFieldValues({});
    setIsMinor(false);
    setGuardianName("");
    setGuardianRelationship("");
    setConsentGiven(false);
    setSignerName("");
    setError(null);
    setKioskDone(false);
    setTurnstileReset((n) => n + 1);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const signatureDataUrl = signatureRef.current?.getDataUrl() ?? null;
    if (!signatureDataUrl) {
      setError("Please draw your signature (a quick scribble isn't enough).");
      return;
    }
    let guardianSignatureDataUrl: string | null = null;
    if (isMinor) {
      guardianSignatureDataUrl = guardianSignatureRef.current?.getDataUrl() ?? null;
      if (!guardianSignatureDataUrl) {
        setError("Guardian signature is required for minors.");
        return;
      }
    }
    if (!consentGiven) {
      setError("You must agree to sign electronically.");
      return;
    }
    if (!turnstileToken) {
      setError("Please complete the verification challenge.");
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/sign/${props.slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnstileToken,
        signerName: signerName.trim(),
        isMinor,
        guardianName: isMinor ? guardianName.trim() : undefined,
        guardianRelationship: isMinor ? guardianRelationship.trim() : undefined,
        fieldValues,
        signatureDataUrl,
        guardianSignatureDataUrl: guardianSignatureDataUrl ?? undefined,
        consentGiven,
        channel: props.channel,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong. Please try again.");
      setTurnstileReset((n) => n + 1);
      setSubmitting(false);
      return;
    }

    if (props.kiosk) {
      setSubmitting(false);
      setKioskDone(true);
      setTimeout(resetForm, 5000);
    } else {
      router.push(`/w/${props.slug}/done`);
    }
  }

  if (kioskDone) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-6xl">✓</div>
        <h2 className="mt-4 text-3xl font-bold">You&apos;re all set!</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Your waiver has been signed and recorded.
        </p>
        <p className="mt-6 text-sm text-muted-foreground/70">
          Ready for the next person in a few seconds…
        </p>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-8">
      {/* Waiver text */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 leading-relaxed">
        {props.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>

      {/* Dynamic fields */}
      {props.fields.length > 0 && (
        <div className="space-y-4">
          {props.fields.map((field) => (
            <FieldInput
              key={field.key}
              field={field}
              value={fieldValues[field.key]}
              onChange={(v) =>
                setFieldValues((prev) => ({ ...prev, [field.key]: v }))
              }
            />
          ))}
        </div>
      )}

      {/* Minor / guardian flow */}
      {props.minorMode === "allowed" && (
        <div className="rounded-xl border border-border p-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">The participant is under 18</span>
          </label>

          {isMinor && (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground/90">
                  Parent / guardian full legal name
                </span>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground/90">
                  Relationship to participant
                </span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parent"
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className={inputClass}
                />
              </label>
              <SignatureCanvas
                ref={guardianSignatureRef}
                label="Parent / guardian signature"
              />
            </div>
          )}
        </div>
      )}

      {/* Consent */}
      <div className="rounded-xl border border-border p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            required
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span className="text-sm leading-relaxed">{props.consentText}</span>
        </label>
      </div>

      {/* Name + signature */}
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            Full legal name
          </span>
          <input
            type="text"
            required
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            autoComplete="name"
            className={inputClass}
          />
        </label>
        <SignatureCanvas ref={signatureRef} label="Your signature" />
      </div>

      <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Sign waiver"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-input px-3 py-3 text-base focus:border-ring focus:outline-none";

function BlockView({ block }: { block: WaiverBlock }) {
  if (block.type === "heading") {
    return <h2 className="text-lg font-bold">{block.text}</h2>;
  }
  if (block.type === "paragraph") {
    return <p className="whitespace-pre-wrap text-sm text-foreground">{block.text}</p>;
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
      {block.items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: WaiverField;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          required={field.required}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <span className="text-sm">{field.label}</span>
      </label>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "date_of_birth"
          ? "date"
          : "text";

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground/90">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={inputType}
        required={field.required}
        maxLength={field.type === "initials" ? 5 : undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}
