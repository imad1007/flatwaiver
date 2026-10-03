"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import {
  TIKTOK_PIXEL_ID, deliverTikTokEvent, tiktokBrowserPermitted,
  tiktokConversionPage, tiktokPageAllowed, tiktokUrlAllowed, type TikTokEvent,
} from "@/lib/tiktok-pixel";

// TikTok's standard deferred queue. A single root Script owns initialization.
// No identify(), automatic event configuration, or user properties are added.
const setup = `!function(w,d,t){
if(!/(?:^|;\\s*)fw-consent=granted(?:;|$)/.test(d.cookie)||w[t])return;
if(!(${tiktokPageAllowed.toString()})(w.location.pathname)||!(${tiktokUrlAllowed.toString()})(w.location.href))return;
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
n=d.createElement("script");n.type="text/javascript";n.async=true;n.src=r+"?sdkid="+e+"&lib="+t;
e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load("${TIKTOK_PIXEL_ID}");ttq.grantConsent();
}(window,document,"ttq");`;

export function TikTokPixel({ enabled }: { enabled: boolean }) {
  const consent = useConsent();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const lastPage = useRef<string | null>(null);

  useEffect(() => {
    const queue = window.ttq;
    if (!queue) return;
    if (!enabled || !tiktokBrowserPermitted()) {
      queue.revokeConsent();
      queue.disableCookie();
      return;
    }
    queue.grantConsent();
    if (ready && lastPage.current !== pathname) {
      queue.page();
      lastPage.current = pathname;
    }
  }, [enabled, consent, pathname, ready]);

  useEffect(() => {
    if (!enabled || !ready || consent !== "granted" || !tiktokConversionPage(pathname)) return;
    let active = true;
    let running = false;
    const permitted = () => active && tiktokBrowserPermitted();
    async function poll() {
      if (running || !permitted() || !window.ttq) return;
      running = true;
      try {
        const response = await fetch("/api/ads/tiktok", { method: "POST", cache: "no-store" });
        if (response.status !== 200 || !permitted()) return;
        const { events } = await response.json() as { events: TikTokEvent[] };
        for (const event of events) {
          await deliverTikTokEvent(event, permitted, window.ttq, async eventId => {
            const ack = await fetch("/api/ads/tiktok", {
              method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId }),
            });
            if (!ack.ok) throw new Error("Measurement acknowledgement unavailable");
          });
        }
      } catch { /* Offline, blocked SDK and telemetry failures do not affect UX. */ }
      finally { running = false; }
    }
    void poll();
    // A checkout redirect can arrive before the provider webhook.
    const timer = window.setInterval(() => { void poll(); }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled, ready, consent, pathname]);

  if (!enabled || consent !== "granted" || !tiktokPageAllowed(pathname) || !tiktokBrowserPermitted()) return null;
  return <Script id="flatwaiver-tiktok-pixel" strategy="afterInteractive"
    onReady={() => window.ttq?.ready(() => setReady(true))}>{setup}</Script>;
}
