"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import { isSignerPage } from "@/lib/signer-pages";

/**
 * Tawk.to live chat. Injected client-side (like Tawk's own snippet) rather than
 * server-rendered, because the per-route exclusion and production-host gate must
 * be evaluated at runtime: a component in the root layout can't see the leaf
 * route's pathname when static pages are prerendered, so an SSR gate would leak
 * the widget onto the excluded pages.
 */

const OVERRIDE_SRC = process.env.NEXT_PUBLIC_TAWK_SRC;
const DEFAULT_SRC = "https://embed.tawk.to/6a7639acc22abe1d539b9b28/1jvet2icj";
const PROD_HOSTS = new Set(["flatwaiver.com", "www.flatwaiver.com"]);

declare global {
  interface Window {
    Tawk_API?: Record<string, unknown>;
    Tawk_LoadStart?: Date;
  }
}

export function LiveChat() {
  const pathname = usePathname();
  const consent = useConsent();

  useEffect(() => {
    if (consent !== "granted") return; // chat is a third-party cookie-setter
    if (isSignerPage(pathname)) return;
    if (document.getElementById("tawk-to")) return; // already loaded this session

    // The default widget loads only on the production host, so local and preview
    // sessions don't show up as visitors (or ping you with test chats) in the
    // dashboard. Setting NEXT_PUBLIC_TAWK_SRC forces it on in any environment.
    const src =
      OVERRIDE_SRC ||
      (PROD_HOSTS.has(window.location.hostname) ? DEFAULT_SRC : null);
    if (!src) return;

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();
    const s = document.createElement("script");
    s.id = "tawk-to";
    s.async = true;
    s.src = src;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.body.appendChild(s);
  }, [pathname, consent]);

  return null;
}
