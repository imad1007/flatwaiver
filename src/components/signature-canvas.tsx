"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import SignaturePad from "signature_pad";
import { typedSignatureIsValid } from "@/lib/signature-input";

export interface SignatureCanvasHandle {
  /** PNG data URL, or null if the signature is trivial/empty. */
  getDataUrl: () => string | null;
  clear: () => void;
}

/** Minimum recorded points across all strokes to accept a signature. */
const MIN_POINTS = 8;

export const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  { label: string }
>(function SignatureCanvas({ label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedSignature, setTypedSignature] = useState("");

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
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      el.width = el.offsetWidth * ratio;
      el.height = el.offsetHeight * ratio;
      el.getContext("2d")?.scale(ratio, ratio);
      pad.fromData(data);
    }
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
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
    },
  }));

  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground/90">{label}</legend>
      <div className="mt-2 inline-flex rounded-lg border border-input bg-muted/40 p-1">
        {(["draw", "type"] as const).map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/50 ${
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
            {option === "draw" ? "Draw" : "Type"}
          </label>
        ))}
      </div>

      {mode === "draw" ? (
        <div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="text-xs text-muted-foreground underline"
            >
              Clear drawing
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className="mt-1 h-40 w-full touch-none rounded-md border border-input bg-card"
            aria-label={`${label} drawing area`}
          />
          <p className="mt-1 text-xs text-muted-foreground/70">
            Draw with a pointer, or choose Type for keyboard entry.
          </p>
        </div>
      ) : (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-muted-foreground">
            Type your full signature
          </span>
          <input
            type="text"
            required
            minLength={1}
            maxLength={200}
            autoComplete="name"
            value={typedSignature}
            onChange={(event) => setTypedSignature(event.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-3 text-lg italic focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <span className="mt-1 block text-xs text-muted-foreground/70">
            Your typed signature will appear in the signed PDF.
          </span>
        </label>
      )}
    </fieldset>
  );
});
