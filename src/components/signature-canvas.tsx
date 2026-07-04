"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import SignaturePad from "signature_pad";

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
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getDataUrl() {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return null;
      const strokes = pad.toData();
      const totalPoints = strokes.reduce((n, s) => n + s.points.length, 0);
      if (strokes.length < 1 || totalPoints < MIN_POINTS) return null;
      return pad.toDataURL("image/png");
    },
    clear() {
      padRef.current?.clear();
    },
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">{label}</span>
        <button
          type="button"
          onClick={() => padRef.current?.clear()}
          className="text-xs text-neutral-500 underline"
        >
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="mt-1 h-40 w-full touch-none rounded-md border border-neutral-300 bg-white"
        aria-label={label}
      />
      <p className="mt-1 text-xs text-neutral-400">Draw your signature above</p>
    </div>
  );
});
