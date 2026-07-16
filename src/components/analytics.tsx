import Script from "next/script";

// GA4 Measurement ID. Prefer the env var (lets you override or repoint later);
// otherwise fall back to the production property so analytics works without any
// Vercel env config. Gated to production so preview/dev never send into the
// live property.
const GA_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  (process.env.VERCEL_ENV === "production" ? "G-G5NQ493KE5" : undefined);
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID; // e.g. AW-XXXXXXXXXX
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

// GA4 and Google Ads share a single gtag.js — load it once (with whichever id
// is configured) and `config` each product separately below.
const gtagLoadId = GA_ID || ADS_ID;

/**
 * Google Analytics 4 + Google Ads (one shared gtag.js) + Microsoft Clarity.
 * Each block renders only when its env var is set, so an unconfigured product
 * injects nothing. GA4 Enhanced Measurement (on by default) captures SPA route
 * changes via History events, so no manual page_view wiring is needed.
 */
export function Analytics() {
  const gtagConfig = [
    GA_ID && `gtag('config', '${GA_ID}');`,
    ADS_ID && `gtag('config', '${ADS_ID}');`,
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
      {CLARITY_ID && (
        <Script id="ms-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");
          `}
        </Script>
      )}
    </>
  );
}
