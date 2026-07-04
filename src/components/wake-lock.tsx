"use client";

import { useEffect } from "react";

/** Keeps the screen awake in kiosk mode where the Wake Lock API is available. */
export function WakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        if ("wakeLock" in navigator) {
          lock = await (
            navigator as Navigator & {
              wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
            }
          ).wakeLock.request("screen");
        }
      } catch {
        // Not supported or not permitted — kiosk still works.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, []);

  return null;
}
