"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { SignatureCanvas, type SignatureCanvasHandle } from "./signature-canvas";
import { signerInputClass } from "./waiver-render";
import { signerText, type SignerLanguage } from "@/lib/signer-language";
import type { ParticipantSubmission } from "@/lib/group-signing";

export interface GroupParticipantsHandle {
  collect: () => { participants: ParticipantSubmission[]; error?: never } | { error: string; participants?: never };
}

export const GroupParticipants = forwardRef<GroupParticipantsHandle, {
  language: SignerLanguage; minorMode: string; kiosk?: boolean;
}>(function GroupParticipants({ language, minorMode, kiosk }, ref) {
  const t = (s: string) => signerText(s, language);
  const [count, setCount] = useState(1);
  const [mountedCount, setMountedCount] = useState(1);
  const [entries, setEntries] = useState(() => Array.from({ length: 10 }, () => ({ fullName: "", isMinor: false, guardianName: "", guardianRelationship: "" })));
  const signatures = useRef<(SignatureCanvasHandle | null)[]>([]);
  const guardians = useRef<(SignatureCanvasHandle | null)[]>([]);
  function update(i: number, patch: Partial<typeof entries[number]>) {
    setEntries(prev => prev.map((entry, j) => i === j ? { ...entry, ...patch } : entry));
  }
  useImperativeHandle(ref, () => ({ collect() {
    const participants: ParticipantSubmission[] = [];
    for (let i = 0; i < count; i++) {
      const entry = entries[i];
      const prefix = `${t("Participant")} ${i + 1}: `;
      if (!entry.fullName.trim()) return { error: prefix + t("Full name is required.") };
      const signatureDataUrl = signatures.current[i]?.getDataUrl();
      if (!signatureDataUrl) return { error: prefix + t("Please draw or type your signature.") };
      const guardianSignatureDataUrl = entry.isMinor ? guardians.current[i]?.getDataUrl() : undefined;
      if (entry.isMinor && (!entry.guardianName.trim() || !entry.guardianRelationship.trim() || !guardianSignatureDataUrl)) {
        return { error: prefix + t("Guardian name, relationship, and signature are required.") };
      }
      participants.push({ fullName: entry.fullName.trim(), signatureDataUrl, isMinor: entry.isMinor,
        ...(entry.isMinor ? { guardianName: entry.guardianName.trim(), guardianRelationship: entry.guardianRelationship.trim(), guardianSignatureDataUrl: guardianSignatureDataUrl! } : {}) });
    }
    return { participants };
  } }));
  return <section className="space-y-5">
    <h2 className="text-lg font-semibold">{t("Group participants")}</h2>
    <label className="block"><span className="mb-2 block font-medium">{t("Number of participants")}</span>
      <select value={count} onChange={e => { const n = Number(e.target.value); setCount(n); setMountedCount(prev => Math.max(prev, n)); }} className={signerInputClass}>
        {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
    </label>
    <p className="text-sm text-muted-foreground">{t("Hidden participants are kept until you clear or submit the form. Only the selected number will be submitted.")}</p>
    {entries.slice(0, mountedCount).map((entry, i) => <fieldset key={i} hidden={i >= count} disabled={i >= count} className="min-w-0 space-y-4 rounded-xl border border-border p-5">
      <legend className="px-2 font-semibold">{t("Participant")} {i + 1}</legend>
      <label className="block"><span className="mb-1 block text-sm font-medium">{t("Participant name")}</span>
        <input value={entry.fullName} maxLength={200} aria-required="true" autoComplete={kiosk ? "off" : "name"} onChange={e => update(i, { fullName: e.target.value })} className={signerInputClass} />
      </label>
      <SignatureCanvas ref={handle => { signatures.current[i] = handle; }} language={language} label={`${t("Participant")} ${i + 1}: ${t("Signature")}`} />
      {minorMode === "allowed" && <label className="flex items-center gap-3"><input type="checkbox" checked={entry.isMinor} onChange={e => update(i, { isMinor: e.target.checked })} className="size-5" />{t("The participant is under 18")}</label>}
      {entry.isMinor && <div className="space-y-4">
        <label className="block">{t("Parent / guardian full legal name")}<input value={entry.guardianName} maxLength={200} onChange={e => update(i, { guardianName: e.target.value })} className={signerInputClass} /></label>
        <label className="block">{t("Relationship to participant")}<input value={entry.guardianRelationship} maxLength={100} onChange={e => update(i, { guardianRelationship: e.target.value })} className={signerInputClass} /></label>
        <SignatureCanvas ref={handle => { guardians.current[i] = handle; }} language={language} label={`${t("Participant")} ${i + 1}: ${t("Parent / guardian signature")}`} />
      </div>}
    </fieldset>)}
  </section>;
});
