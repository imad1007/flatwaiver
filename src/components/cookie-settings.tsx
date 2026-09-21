"use client";

import { setConsent, useConsent } from "@/lib/consent";

export function CookieSettings() {
  const consent = useConsent();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <span>Optional cookies: {consent === "granted" ? "accepted" : "not accepted"}.</span>
      <button className="underline" onClick={() => setConsent("denied")}>Decline optional cookies</button>
      <button className="underline" onClick={() => setConsent("granted")}>Accept optional cookies</button>
    </div>
  );
}
