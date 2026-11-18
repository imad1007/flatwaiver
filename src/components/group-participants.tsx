"use client";

import { forwardRef, memo, useImperativeHandle, useRef, useState } from "react";
import { SignatureCanvas, type SignatureCanvasHandle } from "./signature-canvas";
import { KioskDialog } from "./kiosk-dialog";
import { signerInputClass } from "./waiver-render";
import { signerText, type SignerLanguage } from "@/lib/signer-language";
import { participantDobSchema, type ParticipantSubmission } from "@/lib/group-signing";

export interface GroupParticipantsHandle {
  collect: () => { participants: ParticipantSubmission[]; error?: never } | { error: string; participants?: never };
}

export const GroupParticipants = forwardRef<GroupParticipantsHandle, {
  language: SignerLanguage; minorMode: string; kiosk?: boolean;
}>(function GroupParticipants({ language, minorMode, kiosk }, ref) {
  const t = (s: string) => signerText(s, language);
  const [count, setCount] = useState(1);
  const [mountedCount, setMountedCount] = useState(1);
  const [entries, setEntries] = useState(() => Array.from({ length: 10 }, () => ({ fullName: "", dateOfBirth: "", isMinor: false, guardianName: "", guardianRelationship: "" })));
  // Stable slots preserve the name/DOB/signature pairing when a middle member is removed.
  const [slots, setSlots] = useState([0]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [sharedGuardian, setSharedGuardian] = useState({ name: "", relationship: "" });
  const [reuseGuardian, setReuseGuardian] = useState<number[]>([]);
  const [issue, setIssue] = useState<{ slot: number; message: string; field: string } | null>(null);
  const [removeSlot, setRemoveSlot] = useState<number | null>(null);
  const [guardianDetailsOpen, setGuardianDetailsOpen] = useState(true);
  const sharedGuardianPanel = useRef<HTMLDetailsElement>(null);
  const fieldsets = useRef<(HTMLFieldSetElement | null)[]>([]);
  const signatures = useRef<(SignatureCanvasHandle | null)[]>([]);
  const guardians = useRef<(SignatureCanvasHandle | null)[]>([]);
  function update(i: number, patch: Partial<typeof entries[number]>) {
    if (kiosk && ((patch.fullName !== undefined && patch.fullName !== entries[i].fullName) || (patch.dateOfBirth !== undefined && patch.dateOfBirth !== entries[i].dateOfBirth))) {
      signatures.current[i]?.clear(); guardians.current[i]?.clear();
    }
    if (kiosk && (patch.guardianName !== undefined || patch.guardianRelationship !== undefined || patch.isMinor !== undefined)) guardians.current[i]?.clear();
    setEntries(prev => prev.map((entry, j) => i === j ? { ...entry, ...patch } : entry));
    if (issue?.slot === i) setIssue(null);
  }
  function updateSharedGuardian(patch: Partial<typeof sharedGuardian>) {
    for (const slot of reuseGuardian) guardians.current[slot]?.clear();
    setSharedGuardian(previous => ({ ...previous, ...patch }));
  }
  function fail(slot: number, field: string, message: string) {
    if (kiosk) {
      setActiveSlot(slot); setIssue({ slot, field, message });
      if (field === "guardian" && reuseGuardian.includes(slot) && (!sharedGuardian.name.trim() || sharedGuardian.relationship.trim().length < 2)) setGuardianDetailsOpen(true);
      requestAnimationFrame(() => {
        const missingSharedGuardian = field === "guardian" && reuseGuardian.includes(slot) && (!sharedGuardian.name.trim() || sharedGuardian.relationship.trim().length < 2);
        const target = missingSharedGuardian ? sharedGuardianPanel.current?.querySelector<HTMLElement>(sharedGuardian.name.trim() ? '[data-shared-guardian="relationship"]' : '[data-shared-guardian="name"]') : fieldsets.current[slot]?.querySelector<HTMLElement>(`[data-participant-field="${field}"] input, [data-participant-field="${field}"]`);
        target?.focus();
        target?.scrollIntoView({ block: "center" });
      });
    }
    return { error: `${t("Participant")} ${(kiosk ? slots.indexOf(slot) : slot) + 1}: ${message}` };
  }
  function collectEntry(i: number) {
      const entry = entries[i];
      if (!entry.fullName.trim()) return fail(i, "name", t("Full name is required."));
      if (!participantDobSchema.safeParse(entry.dateOfBirth).success) return fail(i, "dob", t("Enter a valid date of birth that is not in the future."));
      const signatureDataUrl = signatures.current[i]?.getDataUrl();
      if (!signatureDataUrl) return fail(i, "signature", t("Please draw or type your signature."));
      const guardianSignatureDataUrl = entry.isMinor ? guardians.current[i]?.getDataUrl() : undefined;
      const guardianName = kiosk && reuseGuardian.includes(i) ? sharedGuardian.name : entry.guardianName;
      const guardianRelationship = kiosk && reuseGuardian.includes(i) ? sharedGuardian.relationship : entry.guardianRelationship;
      if (entry.isMinor && (!guardianName.trim() || guardianRelationship.trim().length < 2 || !guardianSignatureDataUrl)) {
        return fail(i, "guardian", t("Guardian name, relationship, and signature are required."));
      }
      return { participant: { fullName: entry.fullName.trim(), dateOfBirth: entry.dateOfBirth, signatureDataUrl, isMinor: entry.isMinor,
        ...(entry.isMinor ? { guardianName: guardianName.trim(), guardianRelationship: guardianRelationship.trim(), guardianSignatureDataUrl: guardianSignatureDataUrl! } : {}) } };
  }
  useImperativeHandle(ref, () => ({ collect() {
    const participants: ParticipantSubmission[] = [];
    for (const i of kiosk ? slots : Array.from({ length: count }, (_, index) => index)) {
      const result = collectEntry(i);
      if ("error" in result) return result;
      participants.push(result.participant);
    }
    return { participants };
  } }));
  return <section className="space-y-5">
    <h2 className="text-lg font-semibold">{t("Group participants")}</h2>
    {!kiosk && <><label className="block"><span className="mb-2 block font-medium">{t("Number of participants")}</span>
      <select value={count} onChange={e => { const n = Number(e.target.value); setCount(n); setMountedCount(prev => Math.max(prev, n)); }} className={signerInputClass}>
        {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
    </label>
    <p className="text-sm text-muted-foreground">{t("Hidden participants are kept until you clear or submit the form. Only the selected number will be submitted.")}</p></>}
    {kiosk && <>
      <div className="flex flex-wrap gap-2" aria-label={t("Group participants")}>{slots.map((slot, ordinal) => <button key={slot} type="button" aria-current={activeSlot === slot ? "step" : undefined} onClick={() => setActiveSlot(slot)} className={`min-h-12 max-w-full rounded-xl border px-4 py-3 text-left text-sm ${slot === activeSlot ? "border-primary bg-primary/10" : "border-border"}`}>
        <span className="block font-semibold break-words">{entries[slot].fullName || `${t("Participant")} ${ordinal + 1}`}</span>
        <span className="text-xs text-muted-foreground">{entries[slot].isMinor ? t("Child") : t("Adult")}{(!entries[slot].fullName.trim() || !participantDobSchema.safeParse(entries[slot].dateOfBirth).success) ? ` · ${t("Details needed")}` : ` · ${t("Details entered")}`}</span>
      </button>)}</div>
      <div className="flex flex-wrap gap-3">{([false, true] as const).filter(minor => !minor || minorMode === "allowed").map(minor => <button key={String(minor)} type="button" disabled={slots.length >= 10} className="min-h-12 rounded-xl border border-primary px-5 py-3 font-semibold text-primary disabled:opacity-50" onClick={() => {
        const slot = entries.findIndex((entry, index) => !slots.includes(index) && !entry.fullName && !entry.dateOfBirth);
        if (slot < 0) return;
        update(slot, { isMinor: minor }); setSlots(previous => [...previous, slot]); setActiveSlot(slot); setMountedCount(previous => Math.max(previous, slot + 1));
      }}>{minor ? t("Add child") : t("Add adult")}</button>)}</div>
      {slots.some(slot => entries[slot].isMinor) && <details ref={sharedGuardianPanel} open={guardianDetailsOpen} onToggle={event => setGuardianDetailsOpen(event.currentTarget.open)} className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
        <summary className="min-h-11 cursor-pointer font-semibold [overflow-wrap:anywhere]">{t("Family guardian details")}{sharedGuardian.name && <span className="ml-2 font-normal text-sm">{sharedGuardian.name} · {sharedGuardian.relationship}</span>}</summary><p className="text-sm text-muted-foreground">{t("Enter once, then choose which children use these details. Each child still needs a separate guardian signature.")}</p>
        {entries[slots[0]].fullName.trim() && !entries[slots[0]].isMinor && <button type="button" className="min-h-11 font-semibold text-primary underline" onClick={() => updateSharedGuardian({ name: entries[slots[0]].fullName })}>{t("Use primary participant name")}</button>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">{t("Parent / guardian full legal name")}<input data-shared-guardian="name" autoComplete="off" value={sharedGuardian.name} maxLength={200} onChange={event => updateSharedGuardian({ name: event.target.value })} className={signerInputClass} /></label>
          <label className="block text-sm">{t("Relationship to participant")}<input data-shared-guardian="relationship" autoComplete="off" maxLength={100} value={sharedGuardian.relationship} onChange={event => updateSharedGuardian({ relationship: event.target.value })} className={signerInputClass} /></label></div>
        <p className="text-xs text-muted-foreground">{t("Changing guardian details requires new guardian signatures for the children using them.")}</p>
      </details>}
    </>}
    {entries.slice(0, mountedCount).map((entry, i) => <fieldset ref={element => { fieldsets.current[i] = element; }} key={i} hidden={kiosk ? i !== activeSlot || !slots.includes(i) : i >= count} disabled={kiosk ? !slots.includes(i) : i >= count} className="min-w-0 space-y-4 rounded-xl border border-border p-5">
      <legend className="px-2 font-semibold">{t("Participant")} {(kiosk ? slots.indexOf(i) : i) + 1}</legend>
      {kiosk && issue?.slot === i && <p role="alert" className="text-sm font-medium text-destructive">{issue.message}</p>}
      <div className={kiosk ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
      <label className="block"><span className="mb-1 block text-sm font-medium">{t("Participant name")} <span aria-hidden="true">*</span></span>
        <input data-participant-field="name" value={entry.fullName} maxLength={200} aria-invalid={issue?.slot === i && issue.field === "name" || undefined} aria-required="true" autoComplete={kiosk ? "off" : "name"} onChange={e => update(i, { fullName: e.target.value })} className={signerInputClass} />
      </label>
      <label className="block"><span className="mb-1 block text-sm font-medium">{t("Date of birth")} <span aria-hidden="true">*</span></span>
        <input data-participant-field="dob" type="date" value={entry.dateOfBirth} min="0001-01-01" max={new Date().toISOString().slice(0, 10)} aria-invalid={issue?.slot === i && issue.field === "dob" || undefined} aria-required="true" autoComplete={kiosk ? "off" : `section-participant-${i + 1} bday`} onChange={e => update(i, { dateOfBirth: e.target.value })} className={`${signerInputClass} min-w-0 max-w-full`} />
      </label>
      </div>
      <div data-participant-field="signature" tabIndex={-1}><SignatureCanvas kiosk={kiosk} suggestedName={entry.fullName} ref={handle => { signatures.current[i] = handle; }} language={language} label={`${t("Participant")} ${(kiosk ? slots.indexOf(i) : i) + 1}: ${t("Signature")}`} /></div>
      {minorMode === "allowed" && <label className={kiosk ? "flex min-h-12 items-center gap-3" : "flex items-center gap-3"}><input type="checkbox" checked={entry.isMinor} onChange={e => update(i, { isMinor: e.target.checked })} className="size-5" />{t("The participant is under 18")}</label>}
      {entry.isMinor && <div data-participant-field="guardian" tabIndex={-1} className="space-y-4">
        {kiosk && <label className="flex min-h-12 items-center gap-3 rounded-lg bg-muted/50 p-3"><input type="checkbox" className="size-5" checked={reuseGuardian.includes(i)} onChange={event => {
          const checked = event.target.checked;
          guardians.current[i]?.clear();
          setReuseGuardian(previous => checked ? [...previous, i] : previous.filter(slot => slot !== i));
          if (checked && sharedGuardian.name.trim() && sharedGuardian.relationship.trim().length >= 2) setGuardianDetailsOpen(false);
        }} />{t("Use family guardian details for this child")}</label>}
        {kiosk && reuseGuardian.includes(i) ? <p className="rounded-lg border p-3 text-sm">{sharedGuardian.name || t("Guardian name is required.")} · {sharedGuardian.relationship || t("Relationship is required.")}</p> : <>
        <label className="block">{t("Parent / guardian full legal name")}<input value={entry.guardianName} maxLength={200} onChange={e => update(i, { guardianName: e.target.value })} className={signerInputClass} /></label>
        <label className="block">{t("Relationship to participant")}<input value={entry.guardianRelationship} maxLength={100} onChange={e => update(i, { guardianRelationship: e.target.value })} className={signerInputClass} /></label>
        </>}
        <SignatureCanvas kiosk={kiosk} suggestedName={reuseGuardian.includes(i) ? sharedGuardian.name : entry.guardianName} ref={handle => { guardians.current[i] = handle; }} language={language} label={`${t("Participant")} ${(kiosk ? slots.indexOf(i) : i) + 1}: ${t("Parent / guardian signature")}`} />
      </div>}
      {kiosk && slots.indexOf(i) < slots.length - 1 && <button type="button" className="min-h-12 rounded-lg bg-primary px-5 font-semibold text-primary-foreground" onClick={() => { if (!("error" in collectEntry(i))) setActiveSlot(slots[slots.indexOf(i) + 1]); }}>{t("Next participant")}</button>}
      {kiosk && slots.length > 1 && <button type="button" className="min-h-11 text-sm text-destructive underline" onClick={() => setRemoveSlot(i)}>{t("Remove participant")}</button>}
    </fieldset>)}
    {kiosk && removeSlot !== null && <KioskDialog title={t("Remove participant?")} onCancel={() => setRemoveSlot(null)}><p>{t("This participant's details and signatures will be cleared.")}</p><div className="flex gap-3"><button autoFocus type="button" className="min-h-12 rounded-lg border px-5" onClick={() => setRemoveSlot(null)}>{t("Keep participant")}</button><button type="button" className="min-h-12 rounded-lg bg-destructive px-5 text-destructive-foreground" onClick={() => {
      const slot = removeSlot; signatures.current[slot]?.clear(); guardians.current[slot]?.clear(); update(slot, { fullName: "", dateOfBirth: "", isMinor: false, guardianName: "", guardianRelationship: "" }); setReuseGuardian(previous => previous.filter(index => index !== slot)); setSlots(previous => previous.filter(index => index !== slot)); if (activeSlot === slot) setActiveSlot(slots.find(index => index !== slot)!); setRemoveSlot(null);
    }}>{t("Remove participant")}</button></div></KioskDialog>}
  </section>;
});

// Primary-contact answers, validation banners and privacy countdowns should
// not rerender every participant canvas when these props are unchanged.
export const MemoizedGroupParticipants = memo(GroupParticipants);
