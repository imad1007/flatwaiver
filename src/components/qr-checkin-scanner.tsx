"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ScanLine, X } from "lucide-react";

type Verification = { status: "verified" | "checked_in" | "expired" | "revoked" | "invalid" | "attention"; participantName?: string; participantNumber?: number; isMinor?: boolean; guardianName?: string; waiverName?: string; signedAt?: string; checkedInAt?: string; visit?: string; signatureId?: string; passId?: string; flagged?: boolean; canRevoke?: boolean };
const labels = { verified: "Verified", checked_in: "Already checked in", expired: "Expired", revoked: "Revoked", invalid: "Invalid QR", attention: "Needs attention" };

export function QrCheckinScanner() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [visit, setVisit] = useState("");
  const [result, setResult] = useState<Verification | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const animation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const activeCode = useRef("");
  const activeVisit = useRef("");
  const pending = useRef(false);

  function stop() {
    generation.current++; cancelAnimationFrame(animation.current);
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false);
  }
  useEffect(() => () => { generation.current++; cancelAnimationFrame(animation.current); stream.current?.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => {
    if (open) heading.current?.focus();
    const onHide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [open]);

  async function verify(value: string, checkIn = false) {
    if (pending.current) return;
    stop(); pending.current = true; setBusy(true); setError(""); setConfirmRevoke(false);
    try {
      const chosenVisit = checkIn ? activeVisit.current : visit.trim() ? `session:${visit.trim()}` : undefined;
      const r = await fetch("/api/checkin/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value.trim(), checkIn, ...(chosenVisit ? { visit: chosenVisit } : {}) }), cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Verification unavailable.");
      activeCode.current = value.trim(); activeVisit.current = body.visit ?? chosenVisit ?? "";
      setResult(body); setCode("");
      if (checkIn && body.status === "checked_in") router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Network error. Check your connection and try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function startCamera() {
    stop();
    // A cached camera permission can resolve before React mounts the preview.
    flushSync(() => { setOpen(true); setResult(null); setError(""); });
    activeCode.current = ""; activeVisit.current = "";
    if (!navigator.mediaDevices?.getUserMedia) { setError("Camera scanning needs HTTPS and a supported browser. Paste a code below or use participant search."); return; }
    const version = generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } });
      if (version !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (!video.current) { stop(); return; }
      video.current.srcObject = media; await video.current.play(); setCamera(true);
      const { default: jsQR } = await import("jsqr");
      const canvas = document.createElement("canvas"); const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Camera decoding is unavailable.");
      let last = 0;
      const scan = (time: number) => {
        if (version !== generation.current || !video.current) return;
        if (time-last > 200 && video.current.readyState >= 2) {
          last = time; const v = video.current; const scale = Math.min(1, 900 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth*scale); canvas.height = Math.round(v.videoHeight*scale);
          if (canvas.width && canvas.height) {
            context.drawImage(v, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0,0,canvas.width,canvas.height);
            const qr = jsQR(pixels.data,pixels.width,pixels.height,{ inversionAttempts: "dontInvert" });
            if (qr) { void verify(qr.data); return; }
          }
        }
        animation.current = requestAnimationFrame(scan);
      };
      animation.current = requestAnimationFrame(scan);
    } catch (e) {
      if (version !== generation.current) return;
      stop(); setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser, paste the saved code, or use participant search." : "Could not start the camera. Check the device, then retry or use participant search.");
    }
  }

  return <section data-private data-clarity-mask="true" className="mt-5">
    <button type="button" onClick={() => { setOpen(true); void startCamera(); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"><ScanLine className="size-5" aria-hidden />Scan QR Code</button>
    {open && <div className="mt-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">Verify a visitor</h2><button type="button" aria-label="Close QR scanner" className="min-h-11 min-w-11 rounded-lg border" onClick={() => { stop(); setOpen(false); setCode(""); setResult(null); activeCode.current=""; }}><X className="mx-auto size-5" /></button></div>
      <p className="mt-2 text-sm text-muted-foreground">Pass details are visible only to authorized venue staff. Check the name before admitting the visitor.</p>
      {!result && <>
        <label className="mt-4 block text-sm font-medium">Visit or session reference (optional)<input value={visit} maxLength={80} pattern="[A-Za-z0-9 _.-]+" onChange={e => setVisit(e.target.value)} placeholder="Leave blank for today (UTC)" autoComplete="off" className="mt-1 block min-h-11 w-full rounded-lg border bg-background px-3" /></label>
        <p className="mt-1 text-xs text-muted-foreground">A repeat scan is deduplicated for this visit. Use a shared session reference for another visit on the same day.</p>
      </>}
      <video ref={video} muted playsInline aria-label="QR camera preview" className={`${camera ? "block" : "hidden"} mx-auto mt-4 max-h-80 w-full rounded-xl bg-black`} />
      {camera && <button type="button" onClick={stop} className="mt-2 min-h-11 rounded-lg border px-4">Stop camera</button>}
      {!result && <form className="mt-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void verify(code); }}>
        <label className="w-full text-sm font-medium">Paste the saved pass code<input value={code} onChange={e => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={128} required className="mt-1 block min-h-11 w-full rounded-lg border bg-background px-3 font-mono" /></label>
        <button disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Verifying…" : "Verify code"}</button>
        {!camera && <button type="button" disabled={busy} onClick={() => void startCamera()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4"><Camera className="size-4" />Retry camera</button>}
        <button type="button" onClick={() => { stop(); setOpen(false); document.querySelector<HTMLInputElement>('input[name="q"]')?.focus(); }} className="min-h-11 px-3 text-primary underline">Search participants instead</button>
      </form>}
      {error && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 p-4 text-sm text-destructive">{error}{result && <button type="button" disabled={busy} onClick={() => void verify(activeCode.current)} className="ml-3 underline">Retry verification</button>}</div>}
      {result && <div className="mt-5" aria-live="polite">
        <p className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${["verified","checked_in"].includes(result.status) ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"}`}>{labels[result.status]}</p>
        {result.participantName && <h3 className="mt-3 break-words text-3xl font-bold">{result.participantName}</h3>}
        {result.waiverName && <p className="mt-1 font-medium">{result.waiverName}</p>}
        {result.signedAt && <p className="mt-2 text-sm text-muted-foreground">Signature recorded {new Date(result.signedAt).toLocaleString()}</p>}
        {result.isMinor && <p className="mt-2 text-sm">Minor · Guardian: {result.guardianName ?? "Needs review"}</p>}
        {result.visit && <p className="mt-2 text-sm">Visit: {result.visit}</p>}
        {result.flagged && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm">Flagged answers: review the signed record before admission.</p>}
        {result.status === "expired" && <p className="mt-3 text-sm">The venue&apos;s renewal window has elapsed. Ask the visitor to sign again.</p>}
        {result.status === "attention" && <p className="mt-3 text-sm">Signature, consent or guardian evidence is incomplete. Review the record; do not admit based on this pass.</p>}
        {result.status === "invalid" && <p className="mt-3 text-sm">This code is not recognized for your organization. Use participant search or ask the visitor to sign.</p>}
        {result.signatureId && <Link href={`/signatures/${result.signatureId}`} className="mt-3 inline-block min-h-11 py-2 text-primary underline">Review signed record</Link>}
        <div className="mt-4 flex flex-wrap gap-3">
          {result.status === "verified" && <button type="button" disabled={busy} onClick={() => void verify(activeCode.current,true)} className="min-h-12 rounded-lg bg-primary px-6 font-bold text-primary-foreground disabled:opacity-50">{busy ? "Checking in…" : "Check In"}</button>}
          <button type="button" disabled={busy} onClick={() => void startCamera()} className="min-h-12 rounded-lg border px-5 font-semibold">Scan next visitor</button>
          {result.canRevoke && result.passId && result.status !== "revoked" && <button type="button" disabled={busy} className="min-h-12 px-3 text-sm text-destructive underline" onClick={() => setConfirmRevoke(true)}>Revoke this pass</button>}
        </div>
        {confirmRevoke && <div className="mt-4 rounded-lg border border-destructive/30 p-4"><p className="text-sm">Revoke this participant&apos;s pass? The signed evidence and previous attendance stay unchanged.</p><button type="button" disabled={busy} className="mt-2 min-h-11 rounded-lg bg-destructive px-4 text-white" onClick={async () => { setBusy(true); try { const r=await fetch("/api/checkin/revoke",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({passId:result.passId})});if(!r.ok)throw new Error();setResult({...result,status:"revoked"});setConfirmRevoke(false); } catch {setError("Could not revoke the pass. Try again.");}finally{setBusy(false);} }}>Confirm revocation</button><button type="button" onClick={() => setConfirmRevoke(false)} className="ml-3 min-h-11 px-3 underline">Cancel</button></div>}
      </div>}
    </div>}
  </section>;
}
