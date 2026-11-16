"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Demo = dynamic(() => import("./demo-sandbox").then(module => module.DemoSandbox), { ssr: false });

/** Load signature-pad code only near this below-fold demo, never the live signer. */
export function LazySigningDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="mx-auto min-h-[680px] max-w-xl">
    {visible ? <Demo /> : <div className="flex min-h-[680px] flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center">
      <p className="text-lg font-semibold">Try a sample waiver in your browser</p>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">This interactive demo uses sample text. Nothing is sent or saved. It loads as you approach this section.</p>
      <button type="button" onClick={() => setVisible(true)} className="mt-5 min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Load signing demo</button>
      <noscript>Enable JavaScript to use the interactive demo. All pricing and workflow information is available above.</noscript>
    </div>}
  </div>;
}
