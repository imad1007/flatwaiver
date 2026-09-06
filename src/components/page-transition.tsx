"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = container.current?.animate(
      [{ opacity: 0.65, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 160, easing: "ease-out" }
    );
    return () => animation?.cancel();
  }, [pathname]);
  return <div ref={container}>{children}</div>;
}
