"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/components/signature-canvas";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { BlockView, FieldInput, signerInputClass } from "@/components/waiver-render";
import {
  medicalAnswerIsYes,
  MEDICAL_CONDITION_DETAIL_KEY,
  MEDICAL_CONDITION_KEY,
  type SigningChannel,
  type WaiverBlock,
  type WaiverField,
} from "@/lib/types";

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
  const [medicalDetailError, setMedicalDetailError] = useState(false);

  const signatureRef = useRef<SignatureCanvasHandle>(null);
  const guardianSignatureRef = useRef<SignatureCanvasHandle>(null);
  const medicalDetailRef = useRef<HTMLTextAreaElement>(null);

  // Medical-condition conditional: active only when this version defines both
  // the condition field and its detail field (see lib/types.ts).
  const medicalField = props.fields.find((f) => f.key === MEDICAL_CONDITION_KEY);
  const medicalDetailField = props.fields.find(
    (f) => f.key === MEDICAL_CONDITION_DETAIL_KEY
  );
  const medicalConditional = Boolean(medicalField && medicalDetailField);
  const medicalYes =
    medicalConditional && medicalAnswerIsYes(fieldValues[MEDICAL_CONDITION_KEY]);

  function resetForm() {
    setFieldValues({});
    setIsMinor(false);
    setGuardianName("");
    setGuardianRelationship("");
    setConsentGiven(false);
    setSignerName("");
    setError(null);
    setMedicalDetailError(false);
    setKioskDone(false);
    setTurnstileReset((n) => n + 1);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Medical-condition conditional: "yes" requires the detail box; when the
    // answer isn't yes the box is hidden, so never submit stale hidden text.
    const submittedValues = { ...fieldValues };
    if (medicalConditional) {
      if (medicalYes) {
        const detail = submittedValues[MEDICAL_CONDITION_DETAIL_KEY];
        if (typeof detail !== "string" || detail.trim() === "") {
          setMedicalDetailError(true);
          medicalDetailRef.current?.focus();
          return;
        }
      } else {
        delete submittedValues[MEDICAL_CONDITION_DETAIL_KEY];
      }
    }

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
        fieldValues: submittedValues,
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
        <div className="text-6xl text-success">✓</div>
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
          {props.fields.map((field) => {
            // Medical-condition conditional: the detail box only exists when
            // the answer is yes, and is then mandatory (see lib/types.ts).
            if (medicalConditional && field.key === MEDICAL_CONDITION_DETAIL_KEY) {
              if (!medicalYes) return null;
              const detailValue = fieldValues[field.key];
              return (
                <div key={field.key}>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground/90">
                      {field.label}
                      <span className="text-destructive"> *</span>
                    </span>
                    <textarea
                      ref={medicalDetailRef}
                      rows={3}
                      value={typeof detailValue === "string" ? detailValue : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFieldValues((prev) => ({ ...prev, [field.key]: v }));
                        if (v.trim() !== "") setMedicalDetailError(false);
                      }}
                      aria-required="true"
                      aria-invalid={medicalDetailError || undefined}
                      aria-describedby={
                        medicalDetailError ? "medical-detail-error" : undefined
                      }
                      className={signerInputClass}
                    />
                  </label>
                  {medicalDetailError && (
                    <p
                      id="medical-detail-error"
                      role="alert"
                      className="mt-1.5 text-sm text-destructive"
                    >
                      Please describe the medical condition — this is required
                      because you answered yes.
                    </p>
                  )}
                </div>
              );
            }
            return (
              <FieldInput
                key={field.key}
                field={field}
                value={fieldValues[field.key]}
                onChange={(v) =>
                  setFieldValues((prev) => ({ ...prev, [field.key]: v }))
                }
              />
            );
          })}
        </div>
      )}

      {/* Minor / guardian flow */}
      {props.minorMode === "allowed" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="size-5 accent-primary"
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
                  className={signerInputClass}
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
                  className={signerInputClass}
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
      <div className="rounded-xl border border-border bg-card p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            required
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-1 size-5 accent-primary"
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
            className={signerInputClass}
          />
        </label>
        <SignatureCanvas ref={signatureRef} label="Your signature" />
      </div>

      <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Sign waiver"}
      </button>
    </form>
  );
}
