"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removeLogo, updateBranding } from "@/app/(app)/settings/branding/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#4F46E5", // indigo (default)
  "#0891B2", // cyan
  "#059669", // emerald
  "#D97706", // amber
  "#DC2626", // red
  "#DB2777", // pink
  "#7C3AED", // violet
  "#1F2937", // slate
];

export function BrandingForm({
  initialColor,
  logoUrl,
  className,
}: {
  initialColor: string;
  logoUrl: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [color, setColor] = useState(initialColor);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4F46E5";
  const shownLogo = logoPreview ?? logoUrl;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateBranding(formData);
        setLogoPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        toast.success("Branding saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save branding.");
      }
    });
  }

  function handleRemoveLogo() {
    startTransition(async () => {
      try {
        await removeLogo();
        setLogoPreview(null);
        toast.success("Logo removed");
        router.refresh();
      } catch {
        toast.error("Couldn't remove the logo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-8", className)}>
      {/* Logo */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">Logo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PNG, JPEG, or WebP up to 2 MB. Shown at the top of your signing page and
          on the PDF.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40">
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shownLogo}
                alt="Business logo"
                className="max-h-full max-w-full object-contain p-1.5"
              />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground/50" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setLogoPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:border-ring"
            />
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Remove logo
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Brand color */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-bold">Brand color</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Used for buttons and accents on your signing page.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              aria-label={`Use ${preset}`}
              className={cn(
                "size-8 rounded-full border-2 transition-transform hover:scale-110",
                color.toUpperCase() === preset ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: preset }}
            />
          ))}
          <input
            type="text"
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#4F46E5"
            className="w-28 rounded-md border border-input bg-background px-3 py-1.5 font-mono text-sm focus:border-ring focus:outline-none"
          />
        </div>

        {/* Mini preview */}
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Signing page preview
          </p>
          <div className="mt-2 max-w-xs space-y-2 rounded-lg border border-border bg-background p-3">
            {shownLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shownLogo} alt="" className="h-8 object-contain" />
            ) : (
              <div className="h-1.5 w-24 rounded" style={{ backgroundColor: effectiveColor }} />
            )}
            <div className="h-1.5 w-full rounded bg-muted-foreground/20" />
            <div className="h-1.5 w-4/5 rounded bg-muted-foreground/20" />
            <div
              className="rounded-md py-2 text-center text-xs font-semibold text-white"
              style={{ backgroundColor: effectiveColor }}
            >
              Sign waiver
            </div>
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}
