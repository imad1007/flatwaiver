"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SIGNER_LANGUAGES, signerDirection, signerLanguage, signerFieldLabel, signerText, type SignerLanguage } from "@/lib/signer-language";
import { useRouter } from "next/navigation";
import {
  SignatureCanvas,
  type SignatureCanvasHandle,
} from "@/components/signature-canvas";
import { MemoizedGroupParticipants as GroupParticipants, type GroupParticipantsHandle } from "@/components/group-participants";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { KioskDialog } from "@/components/kiosk-dialog";
import { kioskIdleState } from "@/lib/kiosk-privacy";
import { kioskFieldCanBeHidden } from "@/lib/kiosk-settings";
import { BlockView, FieldInput, signerInputClass } from "@/components/waiver-render";
import {
  medicalAnswerIsYes,
  MEDICAL_CONDITION_DETAIL_KEY,
  MEDICAL_CONDITION_KEY,
  type DocumentDisplay,
  type PhotoMode,
  type SigningChannel,
  type WaiverBlock,
  type WaiverField,
} from "@/lib/types";

/** Read an image File and return a downscaled JPEG data URL (keeps payload small). */
async function fileToResizedDataUrl(file: File, maxDim = 1200, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export interface SigningFormProps {
  documentDisplay?: DocumentDisplay;
  groupSigningEnabled?: boolean;
  defaultLanguage?: SignerLanguage;
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
  kioskWelcome?: { en: string; fr: string };
  kioskInstructions?: { en: string; fr: string };
  kioskHiddenFields?: string[];
  /** Auto-tag carried from ?tag= on the signing link. */
  tag?: string;
  /** Photo/ID capture policy for this waiver. */
  photoMode?: PhotoMode;
}

export function SigningForm(props: SigningFormProps) {
  const router = useRouter();
  const documentId = useId();
  const [documentExpanded, setDocumentExpanded] = useState(false);
  const [language, setLanguage] = useState<SignerLanguage>(props.defaultLanguage ?? "en");
  const t = (text: string) => signerText(text, language);
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
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [kioskStep, setKioskStep] = useState(0);
  const [clearRequested, setClearRequested] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState<number | null>(null);
  const [participantSummary, setParticipantSummary] = useState<{ name: string; dob: string; minor: boolean; guardian?: string; relationship?: string }[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const lastActivity = useRef(Date.now());
  const submittingRef = useRef(false);
  const idlePause = useRef(false);
  const dirty = useRef(false);

  const photoMode = props.photoMode ?? "off";

  const groupRef = useRef<GroupParticipantsHandle>(null);
  const signatureRef = useRef<SignatureCanvasHandle>(null);
  const guardianSignatureRef = useRef<SignatureCanvasHandle>(null);
  const medicalDetailRef = useRef<HTMLTextAreaElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submissionIdRef = useRef<string | null>(null);
  const kioskResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error && (!props.kiosk || kioskStep === 2)) errorRef.current?.focus();
  }, [error, props.kiosk, kioskStep]);

  useEffect(
    () => () => {
      if (kioskResetTimerRef.current) clearTimeout(kioskResetTimerRef.current);
    },
    []
  );
  useEffect(() => {
    if (!props.kiosk) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [props.kiosk]);
  useEffect(() => {
    if (!props.kiosk || kioskDone) return;
    const timer = setInterval(() => {
      if (submittingRef.current || idlePause.current) return;
      const state = kioskIdleState(lastActivity.current, Date.now());
      if (state.expired) resetForm();
      else setIdleSeconds(state.warning ? state.seconds : null);
    }, 1000);
    return () => clearInterval(timer);
    // Reset remounts the form and starts a fresh privacy deadline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kiosk, kioskDone, formKey]);

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
    setDocumentExpanded(false);
    if (kioskResetTimerRef.current) {
      clearTimeout(kioskResetTimerRef.current);
      kioskResetTimerRef.current = null;
    }
    setLanguage(props.defaultLanguage ?? "en");
    setFieldValues({});
    setIsMinor(false);
    setGuardianName("");
    setGuardianRelationship("");
    setConsentGiven(false);
    setSignerName("");
    setError(null);
    setMedicalDetailError(false);
    setKioskDone(false);
    setPhotoDataUrl(null);
    setKioskStep(0); setClearRequested(false); setIdleSeconds(null); setParticipantSummary([]);
    setTurnstileToken(""); lastActivity.current = Date.now();
    dirty.current = false;
    submissionIdRef.current = null;
    setTurnstileReset((n) => n + 1);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }

  function armKioskPrivacyReset(delayMs = 3 * 60 * 1000) {
    if (!props.kiosk) return;
    if (delayMs !== 5000) { lastActivity.current = Date.now(); setIdleSeconds(null); return; }
    if (kioskResetTimerRef.current) clearTimeout(kioskResetTimerRef.current);
    kioskResetTimerRef.current = setTimeout(resetForm, delayMs);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    idlePause.current = true;
    try {
      setPhotoDataUrl(await fileToResizedDataUrl(file));
    } catch {
      setError(t("Couldn't read that photo. Try again or use a different image."));
    } finally {
      setPhotoBusy(false);
      idlePause.current = false; armKioskPrivacyReset();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (props.kiosk && kioskStep !== 2) { advanceKiosk(); return; }
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

    const group = props.groupSigningEnabled ? groupRef.current?.collect() : undefined;
    if (group?.error) { if (props.kiosk) setKioskStep(1); else setError(group.error); return; }
    const participants = group?.participants;
    const signatureDataUrl = participants?.[0]?.signatureDataUrl ?? signatureRef.current?.getDataUrl() ?? null;
    if (!signatureDataUrl) {
      setError(t("Please draw or type your signature."));
      return;
    }
    let guardianSignatureDataUrl: string | null = null;
    if (isMinor) {
      guardianSignatureDataUrl = guardianSignatureRef.current?.getDataUrl() ?? null;
      if (!guardianSignatureDataUrl) {
        setError(t("Guardian signature is required for minors."));
        return;
      }
    }
    if (!consentGiven) {
      setError(t("You must agree to sign electronically."));
      return;
    }
    if (photoMode === "required" && !photoDataUrl) {
      setError(t("A photo is required to sign this waiver."));
      return;
    }
    if (!turnstileToken) {
      setError(t("Please complete the verification challenge."));
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    submissionIdRef.current ??= crypto.randomUUID();
    try {
      const res = await fetch(`/api/sign/${props.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submissionIdRef.current,
          turnstileToken,
          signerName: participants?.[0]?.fullName ?? signerName.trim(),
          participantCount: participants?.length,
          participants,
          isMinor,
          guardianName: isMinor ? guardianName.trim() : undefined,
          guardianRelationship: isMinor ? guardianRelationship.trim() : undefined,
          fieldValues: submittedValues,
          signatureDataUrl,
          guardianSignatureDataUrl: guardianSignatureDataUrl ?? undefined,
          consentGiven,
          channel: props.channel,
          tag: props.tag,
          photoDataUrl: photoDataUrl ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(language !== "en" ? t("Something went wrong. Please try again.") : body?.error ?? t("Something went wrong. Please try again."));
        setTurnstileToken("");
        setTurnstileReset((n) => n + 1);
        return;
      }

      if (props.kiosk) {
        dirty.current = false;
        setKioskDone(true);
        armKioskPrivacyReset(5000);
      } else {
        router.push(`/w/${props.slug}/done?lang=${language}`);
      }
    } catch {
      setError(
        t("We couldn't reach the signing service. Check your connection and try again; your entries are still here.")
      );
      setTurnstileToken("");
      setTurnstileReset((n) => n + 1);
    } finally {
      setSubmitting(false);
      submittingRef.current = false; lastActivity.current = Date.now();
    }
  }

  function advanceKiosk() {
    setError(null);
    const section = formRef.current?.querySelector<HTMLElement>(`[data-kiosk-step="${kioskStep}"]`);
    const invalid = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:invalid, select:invalid, textarea:invalid") ?? []).find(input => !input.disabled && !input.closest("[hidden]"));
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    if (kioskStep === 0 && !consentGiven) { setError(t("You must agree to sign electronically.")); return; }
    if (kioskStep === 1) {
      if (medicalYes && !String(fieldValues[MEDICAL_CONDITION_DETAIL_KEY] ?? "").trim()) { setMedicalDetailError(true); medicalDetailRef.current?.focus(); return; }
      if (props.groupSigningEnabled) {
        const result = groupRef.current?.collect();
        if (!result || result.error) return;
        setParticipantSummary(result.participants!.map(participant => ({ name: participant.fullName, dob: participant.dateOfBirth, minor: participant.isMinor, guardian: participant.guardianName, relationship: participant.guardianRelationship })));
      } else {
        if (!signatureRef.current?.getDataUrl()) { setError(t("Please draw or type your signature.")); signatureRef.current?.focus(); return; }
        if (isMinor && !guardianSignatureRef.current?.getDataUrl()) { setError(t("Guardian signature is required for minors.")); guardianSignatureRef.current?.focus(); return; }
      }
      if (photoMode === "required" && !photoDataUrl) { setError(t("A photo is required to sign this waiver.")); return; }
    }
    setKioskStep(previous => Math.min(2, previous + 1));
    armKioskPrivacyReset(); window.scrollTo({ top: 0 });
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[data-kiosk-step="${kioskStep + 1}"]`)?.focus());
  }

  if (kioskDone) {
    return (
      <div lang={language} dir={signerDirection(language)} aria-live="polite" className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-6xl text-success">✓</div>
        <h2 className="mt-4 text-3xl font-bold">{t("You're all set!")}</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          {t("Your waiver has been signed and recorded.")}
        </p>
        <p className="mt-6 text-sm text-muted-foreground/70">
          {t("Ready for the next person in a few seconds…")}
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate={props.kiosk}
      lang={language}
      dir={signerDirection(language)}
      key={formKey}
      onSubmit={handleSubmit}
      onInput={() => { if (props.kiosk) dirty.current = true; armKioskPrivacyReset(); }}
      onPointerDown={() => { if (props.kiosk) dirty.current = true; armKioskPrivacyReset(); }}
      onKeyDown={() => armKioskPrivacyReset()}
      onWheel={() => armKioskPrivacyReset()}
      autoComplete={props.kiosk ? "off" : undefined}
      className={props.kiosk ? "space-y-5 [&_input:not([type=checkbox]):not([type=radio])]:min-h-12 [&_select]:min-h-12 [&_button]:touch-manipulation" : "space-y-8"}
    >
      <fieldset disabled={props.kiosk && (submitting || photoBusy)} className={props.kiosk ? "min-w-0 space-y-5" : "min-w-0 space-y-8"}>
      <label className="flex flex-wrap items-center justify-end gap-3 text-sm">
        {t("Language")}
        <select aria-label={t("Language")} value={language} onChange={e => setLanguage(signerLanguage(e.target.value))} className="max-w-full rounded-md border border-input bg-card px-3 py-2">
          {SIGNER_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
        <span className="w-full text-end text-xs text-muted-foreground">{t("Waiver text and custom fields remain in their original language.")}</span>
      </label>
      {!props.kiosk && <p className="text-sm text-muted-foreground">{t("Please read the waiver below, fill in your details, and sign.")}</p>}
      {props.kiosk && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            {t("Shared device: entries clear after 3 minutes without activity.")}
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setClearRequested(true)}
            className="min-h-12 font-semibold text-foreground underline underline-offset-4"
          >
            {t("Clear form")}
          </button>
        </div>
      )}
      {props.kiosk && <nav aria-label={t("Signing progress")} className="grid grid-cols-3 gap-2">{["Read & agree", "People & details", "Review & sign"].map((label, index) => <div key={label} aria-current={index === kioskStep ? "step" : undefined} className={`rounded-xl border px-3 py-3 text-sm ${index === kioskStep ? "border-primary bg-primary/10 font-semibold" : "border-border text-muted-foreground"}`}><span className="block text-xs">{index + 1} / 3</span>{t(label)}</div>)}</nav>}
      {props.kiosk && clearRequested && <KioskDialog title={t("Clear this form?")} onCancel={() => setClearRequested(false)}><p>{t("All entered details and signatures will be removed.")}</p><div className="flex gap-3"><button autoFocus type="button" className="min-h-12 rounded-lg border px-5" onClick={() => setClearRequested(false)}>{t("Keep signing")}</button><button type="button" className="min-h-12 rounded-lg bg-destructive px-5 text-destructive-foreground" onClick={resetForm}>{t("Clear form")}</button></div></KioskDialog>}
      {props.kiosk && idleSeconds !== null && <KioskDialog title={t("Still signing?")} onCancel={() => armKioskPrivacyReset()}><p>{t("For your privacy, this form will clear shortly.")} <strong>{idleSeconds} {t("seconds")}</strong></p><button autoFocus type="button" className="min-h-12 w-full rounded-lg bg-primary px-5 font-semibold text-primary-foreground" onClick={() => armKioskPrivacyReset()}>{t("Continue signing")}</button></KioskDialog>}
      <section data-kiosk-step="0" tabIndex={-1} hidden={props.kiosk && kioskStep !== 0} className="space-y-5 outline-none">
      {props.kiosk && <div className="rounded-2xl bg-primary/5 p-6"><h2 className="text-2xl font-bold [overflow-wrap:anywhere]">{(language === "fr" ? props.kioskWelcome?.fr : props.kioskWelcome?.en) || t("Welcome! Let's get you ready.")}</h2><p className="mt-2 text-muted-foreground whitespace-pre-line [overflow-wrap:anywhere]">{(language === "fr" ? props.kioskInstructions?.fr : props.kioskInstructions?.en) || t("Read the waiver, add everyone taking part, and sign. Required details are marked with an asterisk.")}</p></div>}
      {/* Waiver text */}

      {props.documentDisplay === "collapsed" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold">{t("Waiver document")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Review the complete legal document before signing.")}</p>
          <button type="button" aria-expanded={documentExpanded} aria-controls={documentId}
            onClick={() => setDocumentExpanded(expanded => !expanded)}
            className="mt-3 min-h-12 w-full rounded-lg border border-primary px-5 py-3 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto">
            {t(documentExpanded ? "Hide Document" : "View Document")}
          </button>
        </div>
      )}
      <div id={documentId} hidden={props.documentDisplay === "collapsed" && !documentExpanded} className="min-w-0 space-y-4 overflow-x-hidden rounded-xl border border-border bg-card p-5 leading-relaxed">
        {props.blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
      </div>
      {props.kiosk && <label className="flex min-h-16 items-start gap-3 rounded-xl border bg-card p-5"><input type="checkbox" required checked={consentGiven} onChange={event => setConsentGiven(event.target.checked)} className="mt-1 size-6 accent-primary" /><span dir="auto">{props.consentText}</span></label>}
      </section>
      <section data-kiosk-step="1" tabIndex={-1} hidden={props.kiosk && kioskStep !== 1} className="space-y-5 outline-none">
      {props.groupSigningEnabled && <p className="text-sm font-medium">{t("Custom fields and photo apply to the primary participant/contact (Participant 1).")}</p>}
      {/* Dynamic fields */}
      {props.fields.length > 0 && (
        <div className="space-y-4">
          {props.fields.map((field) => {
            if (props.kiosk && props.kioskHiddenFields?.includes(field.key) && kioskFieldCanBeHidden(field)) return null;
            // Participant 1 supplies existing primary DOB fields in group mode.
            if (props.groupSigningEnabled && field.type === "date_of_birth") return null;
            // Medical-condition conditional: the detail box only exists when
            // the answer is yes, and is then mandatory (see lib/types.ts).
            if (medicalConditional && field.key === MEDICAL_CONDITION_DETAIL_KEY) {
              if (!medicalYes) return null;
              const detailValue = fieldValues[field.key];
              return (
                <div key={field.key}>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground/90">
                      {signerFieldLabel(field.label, language)}
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
                language={language}
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
      {!props.groupSigningEnabled && props.minorMode === "allowed" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isMinor}
              onChange={(e) => setIsMinor(e.target.checked)}
              className="size-5 accent-primary"
            />
            <span className="font-medium">{t("The participant is under 18")}</span>
          </label>

          {isMinor && (
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground/90">
                  {t("Parent / guardian full legal name")}
                </span>
                <input
                  type="text"
                  required
                  autoComplete={props.kiosk ? "off" : "name"}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className={signerInputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground/90">
                  {t("Relationship to participant")}
                </span>
                <input
                  type="text"
                  required
                  placeholder={t("e.g. Parent")}
                  value={guardianRelationship}
                  onChange={(e) => setGuardianRelationship(e.target.value)}
                  className={signerInputClass}
                />
              </label>
              <SignatureCanvas
                kiosk={props.kiosk}
                suggestedName={guardianName}
                ref={guardianSignatureRef}
                language={language}
                label={t("Parent / guardian signature")}
              />
            </div>
          )}
        </div>
      )}

      {/* Photo / ID capture */}
      {photoMode !== "off" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="font-medium">
            Photo{photoMode === "required" && <span className="text-destructive"> *</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {photoMode === "required"
              ? t("A photo is required to sign this waiver.")
              : t("Optionally add a photo (e.g. a photo ID or a selfie).")}
          </p>
          {photoDataUrl ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoDataUrl}
                alt={t("Captured")}
                className="h-24 w-24 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotoDataUrl(null)}
                className="text-sm text-muted-foreground underline"
              >
                {t("Retake")}
              </button>
            </div>
          ) : (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:border-ring focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                className="sr-only"
              />
              {photoBusy ? t("Processing…") : t("Take / upload photo")}
            </label>
          )}
        </div>
      )}

      {/* Consent */}
      {!props.kiosk && <div className="rounded-xl border border-border bg-card p-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            required
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-1 size-5 accent-primary"
          />
          <span dir="auto" className="text-sm leading-relaxed">{props.consentText}</span>
        </label>
      </div>}

      {/* Name + signature */}
      {props.groupSigningEnabled ? <GroupParticipants key={formKey} ref={groupRef} language={language} minorMode={props.minorMode} kiosk={props.kiosk} /> : <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground/90">
            {t("Full legal name")}
          </span>
          <input
            type="text"
            required
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            autoComplete={props.kiosk ? "off" : "name"}
            className={signerInputClass}
          />
        </label>
        <SignatureCanvas kiosk={props.kiosk} suggestedName={signerName} ref={signatureRef} language={language} label={t("Your signature")} />
      </div>}
      </section>
      {props.kiosk && <section data-kiosk-step="2" tabIndex={-1} hidden={kioskStep !== 2} className="space-y-5 outline-none"><h2 className="text-2xl font-bold">{t("Review & sign")}</h2><p className="text-muted-foreground">{t("Check everyone's details before submitting. One signed waiver will include all participants.")}</p><ul className="divide-y rounded-xl border bg-card px-5">{(props.groupSigningEnabled ? participantSummary : [{ name: signerName, dob: String(fieldValues[props.fields.find(field => field.type === "date_of_birth")?.key ?? ""] ?? ""), minor: isMinor, guardian: guardianName, relationship: guardianRelationship }]).map((participant, index) => <li key={index} className="py-4"><p className="font-semibold break-words">{participant.name}</p><p className="text-sm text-muted-foreground">{participant.dob} {participant.minor ? t("Child") : t("Adult")}</p>{participant.minor && <p className="text-sm">{t("Parent / guardian full legal name")}: {participant.guardian} / {participant.relationship}</p>}</li>)}</ul><p className="text-sm">{t("Your electronic consent and all required signatures are included.")}</p></section>}

      <div hidden={props.kiosk && kioskStep !== 2}><TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} /></div>

      {error && (
        <div
          id="signing-error"
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
        >
          <p className="font-medium">{t("We couldn't submit this waiver")}</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {props.kiosk && kioskStep > 0 && <button type="button" disabled={submitting} className="min-h-12 rounded-xl border px-6 font-semibold" onClick={() => { setKioskStep(previous => previous - 1); setError(null); window.scrollTo({ top: 0 }); }}>{t("Back")}</button>}
      <button
        type="submit"
        disabled={submitting || photoBusy}
        aria-describedby={error ? "signing-error" : undefined}
        className="w-full rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? t("Submitting…") : props.kiosk && kioskStep !== 2 ? t("Continue") : t("Sign waiver")}
      </button>
      </fieldset>
    </form>
  );
}
