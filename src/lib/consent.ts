import { useSyncExternalStore } from "react";

/**
 * Cookie-consent state, stored in a first-party `fw-consent` cookie so the
 * choice persists across sessions. Non-essential third parties (analytics,
 * ads, chat) load only when this is "granted". Read with useSyncExternalStore
 * so there's no hydration mismatch (server snapshot is always null) and no
 * setState-in-effect.
 *
 * Client-only module — import it from client components only.
 */

export type Consent = "granted" | "denied" | null;

const COOKIE = "fw-consent";
const CHANGE_EVENT = "fw-consent-change";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readConsent(): Consent {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)fw-consent=(granted|denied)/);
  return (match?.[1] as Consent) ?? null;
}

export function setConsent(value: "granted" | "denied") {
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useConsent(): Consent {
  return useSyncExternalStore(subscribe, readConsent, () => null);
}
