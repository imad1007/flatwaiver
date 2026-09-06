"use client";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type ProductEvent =
  | "waiver_creation_method_selected"
  | "waiver_import_started"
  | "waiver_import_completed"
  | "waiver_import_failed"
  | "waiver_draft_created"
  | "onboarding_completed"
  | "waiver_draft_saved"
  | "waiver_published";

type EventValue = string | number | boolean;

/**
 * Sends coarse product milestones only when consented analytics has loaded.
 * Callers must never pass names, emails, document text, filenames, record IDs,
 * or other customer/signer data.
 */
export function trackProductEvent(
  event: ProductEvent,
  parameters: Record<string, EventValue> = {}
) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", event, parameters);
}
