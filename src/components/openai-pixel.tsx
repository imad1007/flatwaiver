"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import { measureSdkRegistration, pixelPageMode, type OpenAIQueue } from "@/lib/openai-pixel";

// Ads Manager setup code, preserved verbatim (without the HTML script tags).
const setup = '!function(w,d,s,u){if(w.oaiq)return;var q=function(){q.q.push(arguments)};q.q=[];w.oaiq=q;var j=d.createElement(s);j.async=1;j.src=u;var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(j,f)}(window,document,"script","https://bzrcdn.openai.com/sdk/oaiq.min.js");oaiq("init",{pixelId:"Wdj4prj2rJhsBuYu2cLejz",debug:true});';

type PixelWindow = Window & { oaiq?: OpenAIQueue };

/** One root-layout SDK installation and server-authorized registration event. */
export function OpenAIPixel({ enabled }: { enabled: boolean }) {
  const consent = useConsent();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    (window as PixelWindow).oaiq?.("consent", consent === "granted");
  }, [enabled, consent]);

  useEffect(() => {
    const queue = (window as PixelWindow).oaiq;
    if (!enabled || !ready || consent !== "granted" || pixelPageMode(pathname) !== "conversion" || !queue) return;
    let active = true;
    void measureSdkRegistration(
      async () => {
        const response = await fetch("/api/ads/registration", { method: "POST", credentials: "same-origin", cache: "no-store" });
        return response.status === 200 ? response.json() : null;
      },
      () => active && /(?:^|;\s*)fw-consent=granted(?:;|$)/.test(document.cookie),
      queue,
    );
    return () => { active = false; };
  }, [enabled, ready, consent, pathname]);

  if (!enabled || consent !== "granted") return null;
  return (
    <Script id="flatwaiver-openai-ads-pixel" strategy="afterInteractive" onReady={() => setReady(true)}>
      {`if (/(?:^|;\\s*)fw-consent=granted(?:;|$)/.test(document.cookie)) {
        ${setup}
        oaiq("consent", true);
      }`}
    </Script>
  );
}
