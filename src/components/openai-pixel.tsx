"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import { OPENAI_ATTRIBUTION_COOKIE, measureRegistration, pixelPageMode, readClickCookie, safeClickReference } from "@/lib/openai-pixel";

/** Image-only measurement: no third-party JavaScript can inspect app content. */
export function OpenAIPixel({ enabled }: { enabled: boolean }) {
  const consent = useConsent();
  const pathname = usePathname();
  const mode = pixelPageMode(pathname);
  const container = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!enabled || consent !== "granted" || !mode || !container.current) return;
    if (mode === "landing") {
      const click = safeClickReference(new URLSearchParams(location.search).get("oppref"));
      if (click) document.cookie = `${OPENAI_ATTRIBUTION_COOKIE}=${encodeURIComponent(click)}; path=/; max-age=2592000; samesite=lax; secure`;
      return;
    }
    let active = true;
    let image: HTMLImageElement | undefined;
    void measureRegistration(
      async () => {
        const response = await fetch("/api/ads/registration", { method: "POST", credentials: "same-origin", cache: "no-store" });
        return response.status === 200 ? response.json() : null;
      },
      () => active && document.cookie.split(/;\s*/).includes("fw-consent=granted"),
      () => readClickCookie(document.cookie),
      url => {
        image = document.createElement("img");
        image.width = 1;
        image.height = 1;
        image.alt = "";
        // OpenAI gets the website origin, never the current path/query.
        image.referrerPolicy = "origin";
        image.src = url;
        container.current?.appendChild(image);
      },
    );
    return () => {
      active = false;
      image?.remove();
    };
  }, [enabled, consent, mode]);

  return <span ref={container} hidden aria-hidden="true" />;
}
