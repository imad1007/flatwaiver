"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import { isSignerPage } from "@/lib/signer-pages";

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
  if (consent !== "granted" || isSignerPage(pathname)) return null;

  const gtagLoadId = gaId || adsId;
  const gtagConfig = [
    gaId && `gtag('config', '${gaId}');`,
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
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              ${gtagConfig}
            `}
          </Script>
        </>
      )}
      {clarityId && (
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
