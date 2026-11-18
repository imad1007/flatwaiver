"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { signerText, type SignerLanguage } from "@/lib/signer-language";
import SignaturePad from "signature_pad";
import { typedSignatureIsValid } from "@/lib/signature-input";

export interface SignatureCanvasHandle {
  /** PNG data URL, or null if the signature is trivial/empty. */
  getDataUrl: () => string | null;
  clear: () => void;
  focus: () => void;
}

/** Minimum recorded points across all strokes to accept a signature. */
const MIN_POINTS = 8;

export const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  { label: string; language?: SignerLanguage; kiosk?: boolean; suggestedName?: string }
>(function SignatureCanvas({ label, language = "en", kiosk = false, suggestedName }, ref) {
  const t = (text: string) => signerText(text, language);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [quickSigned, setQuickSigned] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  function typedDataUrl(): string | null {
    if (!typedSignatureIsValid(typedSignature)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111111";
    context.textBaseline = "middle";
    context.font = "italic 72px Georgia, serif";
    const text = typedSignature.trim();
    const width = context.measureText(text).width;
    if (width > canvas.width - 80) {
      context.font = `italic ${Math.max(28, Math.floor((72 * (canvas.width - 80)) / width))}px Georgia, serif`;
    }
    context.fillText(text, 40, canvas.height / 2, canvas.width - 80);
    return canvas.toDataURL("image/png");
  }

  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (canvas === null) return;
    const el: HTMLCanvasElement = canvas;

    const pad = new SignaturePad(el, {
      penColor: "#111111",
      backgroundColor: "rgba(255,255,255,0)",
    });
    padRef.current = pad;

    function resize() {
      if (!el.offsetWidth || !el.offsetHeight) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      el.width = el.offsetWidth * ratio;
      el.height = el.offsetHeight * ratio;
      el.getContext("2d")?.scale(ratio, ratio);
      pad.fromData(data);
    }
    resize();
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
      pad.off();
      padRef.current = null;
    };
  }, [mode]);

  useImperativeHandle(ref, () => ({
    getDataUrl() {
      if (mode === "type") return typedDataUrl();
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return null;
      const strokes = pad.toData();
      const totalPoints = strokes.reduce((n, s) => n + s.points.length, 0);
      if (strokes.length < 1 || totalPoints < MIN_POINTS) return null;
      return pad.toDataURL("image/png");
    },
    clear() {
      padRef.current?.clear();
      setTypedSignature("");
      setQuickSigned(false);
    },
    focus() {
      const input = fieldsetRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
      if (input) input.focus(); else fieldsetRef.current?.focus();
    },
  }));

  return (
    <fieldset ref={fieldsetRef} tabIndex={-1} className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <legend className="text-sm font-medium text-foreground/90">{label}{kiosk && <span aria-hidden="true"> *</span>}</legend>
      {kiosk && suggestedName && typedSignatureIsValid(suggestedName) && !(mode === "type" && typedSignature.trim() === suggestedName.trim()) && <div className="mt-2 rounded-lg bg-primary/5 p-3">
        <button type="button" className="min-h-12 rounded-lg border border-primary px-4 py-3 font-semibold text-primary" onClick={() => { setMode("type"); setTypedSignature(suggestedName.trim()); setQuickSigned(true); }}>{t("Sign with this name")}: {suggestedName.trim()}</button>
        <p className="mt-1 text-xs text-muted-foreground">{t("Choosing this button creates your typed signature. You can edit it below.")}</p>
      </div>}
      {kiosk && quickSigned && <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2"><span className="min-w-0 flex-1 text-lg italic [overflow-wrap:anywhere]">{typedSignature}</span><button type="button" className="min-h-11 font-semibold text-primary underline" onClick={() => setQuickSigned(false)}>{t("Edit signature")}</button></div>}
      <div hidden={kiosk && quickSigned}>
      <div className="mt-2 inline-flex rounded-lg border border-input bg-muted/40 p-1">
        {(["draw", "type"] as const).map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-md px-3 ${kiosk ? "min-h-11 py-3" : "py-1.5"} text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/50 ${
              mode === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <input
              type="radio"
              name={`${label.replace(/\s+/g, "-").toLowerCase()}-method`}
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              className="sr-only"
            />
            {option === "draw" ? t("Draw") : t("Type")}
          </label>
        ))}
      </div>

      {mode === "draw" ? (
        <div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className={kiosk ? "min-h-11 text-sm text-muted-foreground underline" : "text-xs text-muted-foreground underline"}
            >
              {t("Clear drawing")}
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="mt-1 h-40 w-full touch-none rounded-md border border-input bg-card"
            aria-label={`${label} ${t("drawing area")}`}
          />
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("Draw with a pointer, or choose Type for keyboard entry.")}
          </p>
        </div>
      ) : (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted-foreground">
            {t("Type your full signature")}
          </span>
          <input
            type="text"
            required
            minLength={1}
            maxLength={200}
            autoComplete={kiosk ? "off" : "name"}
            value={typedSignature}
            onChange={(event) => setTypedSignature(event.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-lg italic focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="mt-1 block text-xs text-muted-foreground/70">
            {t("Your typed signature will appear in the signed PDF.")}
          </span>
        </label>
      )}
      </div>
    </fieldset>
  );
});
