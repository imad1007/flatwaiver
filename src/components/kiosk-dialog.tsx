"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native modal dialog supplies focus containment, Escape and focus restoration. */
export function KioskDialog({ title, children, onCancel }: { title: string; children: ReactNode; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onCancel(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-6 text-foreground shadow-xl backdrop:bg-black/60">
    <h2 className="text-xl font-bold">{title}</h2><div className="mt-4 space-y-4">{children}</div>
  </dialog>;
}
