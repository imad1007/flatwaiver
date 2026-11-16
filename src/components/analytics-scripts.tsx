"use client";

import { useEffect, useRef, useState } from "react";
import { acquisitionContext, audienceForPath, coarseAnalyticsPath } from "@/lib/acquisition";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
const MANUAL_PAGEVIEWS = process.env.NEXT_PUBLIC_GA_MANUAL_PAGEVIEWS === "true";

/**
 * Renders the GA4 / Google Ads / Clarity tags — but only after the visitor has
 * granted cookie consent. Ids are resolved server-side (see analytics.tsx) and
 * passed in; nothing loads until consent === "granted".
 */
export function AnalyticsScripts({
  gaId,
  adsId,
  clarityId,
}: {
  gaId: string | null;
  adsId: string | null;
  clarityId: string | null;
}) {
  const consent = useConsent();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const lastView = useRef("");
  const audience = audienceForPath(pathname);
  const allowed = ["marketing", "prospect", "account"].includes(audience);
  useEffect(() => {
    if (consent !== "granted" || !allowed) { lastView.current = ""; return; }
    const context = acquisitionContext();
    if (!ready || !gaId || typeof window.gtag !== "function") return;
    window.gtag("set", { audience_type: audience });
    if (!MANUAL_PAGEVIEWS) return;
    const path = coarseAnalyticsPath(pathname);
    if (lastView.current === pathname) return;
    lastView.current = pathname;
    window.gtag("event", "page_view", { send_to: gaId, page_location: window.location.origin + path, page_title: audience === "marketing" ? document.title : audience, page_referrer: "", audience_type: audience, ...context });
  }, [pathname, consent, allowed, audience, ready, gaId]);
  useEffect(() => {
    if (consent !== "granted" || audience !== "marketing" || !gaId) return;
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || typeof window.gtag !== "function") return;
      const target = new URL(anchor.href, window.location.origin);
      if (target.origin === window.location.origin && target.pathname === "/signup") {
        window.gtag("event", "trial_cta_click", { send_to: gaId, audience_type: "marketing", ...acquisitionContext() });
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [consent, audience, gaId]);
  if (consent !== "granted" || !allowed) return null;

  const gtagLoadId = gaId || adsId;
  const gtagConfig = [
    gaId && `gtag('config', '${gaId}', { send_page_view: ${!MANUAL_PAGEVIEWS}, page_location: window.location.origin + ${JSON.stringify(coarseAnalyticsPath(pathname))}, page_title: ${audience === "marketing" ? "document.title" : JSON.stringify(audience)}, page_referrer: '' });`,
    adsId && `gtag('config', '${adsId}');`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      {gtagLoadId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagLoadId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive" onReady={() => setReady(true)}>
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${gtagConfig}
            `}
          </Script>
        </>
      )}
      {clarityId && audience === "marketing" && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      )}
    </>
  );
}
