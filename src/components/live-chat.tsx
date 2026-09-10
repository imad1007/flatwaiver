"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";
import { isSignerPage } from "@/lib/signer-pages";
import { CHAT_REQUEST, publishChatStatus } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";

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
    Tawk_API?: {
      onLoad?: () => void;
      onBeforeLoad?: () => void;
      onChatMinimized?: () => void;
      onChatMaximized?: () => void;
      onStatusChange?: (status: "online" | "away" | "offline") => void;
      getStatus?: () => "online" | "away" | "offline";
      maximize?: () => void;
      showWidget?: () => void;
      hideWidget?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

export function LiveChat() {
  const pathname = usePathname();
  const consent = useConsent();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let pendingOpen = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const excluded = isSignerPage(pathname);
    const appPage = /^\/(dashboard|waivers|signatures|settings|support|help|admin|checkin|onboarding)(\/|$)/.test(pathname);
    const manualOnly = signedIn !== false || appPage;
    const supportPage = /^\/(support|help)\/?$/.test(pathname);
    let explicitlyOpened = false;
    const api = window.Tawk_API = window.Tawk_API || {};
    function ready() {
      clearTimeout(timer);
      publishChatStatus(api.getStatus?.() ?? "offline");
      if (excluded) { api.hideWidget?.(); return; }
      if (manualOnly && !pendingOpen && !explicitlyOpened) { api.hideWidget?.(); return; }
      api.showWidget?.();
      if (pendingOpen) { explicitlyOpened = true; api.maximize?.(); pendingOpen = false; }
    }
    api.onLoad = ready;
    api.onBeforeLoad = () => { if (excluded || manualOnly) api.hideWidget?.(); };
    api.onChatMinimized = () => {
      explicitlyOpened = false;
      if (excluded || manualOnly) api.hideWidget?.();
    };
    api.onChatMaximized = () => {
      if (excluded || (manualOnly && !explicitlyOpened)) api.hideWidget?.();
    };
    api.onStatusChange = (status) => publishChatStatus(status);
    function load(open: boolean) {
      if (excluded) return;
      if (manualOnly && (!open || !supportPage)) return;
      pendingOpen = open;
      if (api.getStatus && api.maximize) { ready(); return; }
      const src = OVERRIDE_SRC || (PROD_HOSTS.has(window.location.hostname) ? DEFAULT_SRC : null);
      if (!src) { publishChatStatus("unavailable"); return; }
      publishChatStatus("loading");
      clearTimeout(timer);
      timer = setTimeout(() => { pendingOpen = false; publishChatStatus("unavailable"); }, 12_000);
      if (document.getElementById("tawk-to")) return;
      window.Tawk_LoadStart = new Date();
      const s = document.createElement("script");
      s.id = "tawk-to";
      s.async = true;
      s.src = src;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      s.onerror = () => { clearTimeout(timer); pendingOpen = false; s.remove(); publishChatStatus("unavailable"); };
      document.body.appendChild(s);
    }
    // An explicit chat request enables only chat, without changing analytics consent.
    const openChat = () => load(true);
    window.addEventListener(CHAT_REQUEST, openChat);
    if (excluded || manualOnly) api.hideWidget?.();
    else if (api.getStatus) ready();
    else if (consent === "granted") load(false);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(CHAT_REQUEST, openChat);
      api.onLoad = undefined;
      api.onBeforeLoad = undefined;
      api.onChatMinimized = undefined;
      api.onChatMaximized = undefined;
      api.onStatusChange = undefined;
    };
  }, [pathname, consent, signedIn]);

  return null;
}
