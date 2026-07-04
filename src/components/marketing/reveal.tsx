"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-in reveal: fades/slides children up when they enter the viewport.
 * DOM-attribute driven (no state), one-shot, respects prefers-reduced-motion
 * via the global media query that zeroes transition durations.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.visible = "true";
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible="false"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "translate-y-6 opacity-0 transition-all duration-700 ease-out",
        "data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}
