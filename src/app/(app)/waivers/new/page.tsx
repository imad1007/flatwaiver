"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileUp, PenLine, Sparkles, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { createTemplateFromText } from "../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/product-analytics";

const SCRATCH_BACKUP_KEY = "flatwaiver:new-waiver:scratch";

export default function NewWaiverPage() {
  const [path, setPath] = useState<"upload" | "scratch" | null>(null);

  useEffect(() => {
    let timeout: number | undefined;
    try {
      if (window.sessionStorage.getItem(SCRATCH_BACKUP_KEY)) {
        timeout = window.setTimeout(() => setPath("scratch"), 0);
      }
    } catch {
      // The creation choices remain usable when tab storage is unavailable.
    }
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className={cn("mx-auto w-full pb-8", path === null ? "max-w-4xl" : "max-w-2xl")}>
      <div className="mb-8 sm:mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Waiver workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New waiver</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Bring your existing waiver online, or build a form of your own.
          Start with a draft and publish when you are ready.
        </p>
      </div>

      {path === null && (
        <div className="grid gap-5 md:grid-cols-2">
          <ChoiceCard
            icon={FileUp}
            title="Upload existing waiver"
            badge="AI-assisted"
            action="Upload a waiver"
            details={["PDF, Word, photo or scan", "Editable draft to review"]}
            body="Turn the waiver you already use into a digital form. Review the conversion and make it yours."
            onClick={() => {
              trackProductEvent("waiver_creation_method_selected", { method: "upload" });
              setPath("upload");
            }}
          />
          <ChoiceCard
            icon={PenLine}
            title="Start from scratch"
            action="Create a draft"
            details={["Paste your existing text", "Add questions in the editor"]}
            body="Start with your own wording and shape the form around your business, one field at a time."
            onClick={() => {
              trackProductEvent("waiver_creation_method_selected", { method: "scratch" });
              setPath("scratch");
            }}
          />
        </div>
      )}

      {path === null && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card/60 p-4 sm:p-5">
          <ClipboardCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">You are in control before it goes live</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Review your wording, customize signer fields, then publish and share your link or QR code.</p>
          </div>
        </div>
      )}

      {path === "upload" && <UploadPdfForm onBack={() => setPath(null)} />}
      {path === "scratch" && <FromTextForm onBack={() => setPath(null)} />}
    </div>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  badge,
  body,
  action,
  details,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  body: string;
  action: string;
  details: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-sm transition-colors sm:p-8",
        badge ? "border-primary/25 hover:border-primary/60" : "border-border hover:border-primary/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      )}
    >
      <div className="mb-7 flex w-full items-center justify-between gap-3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", badge ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
          <Icon className="size-6" />
        </span>
        {badge && <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"><Sparkles aria-hidden="true" className="size-3.5" />{badge}</span>}
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
      <ul className="my-6 space-y-2.5">
        {details.map(detail => <li key={detail} className="flex items-center gap-2 text-sm"><Check aria-hidden="true" className="size-4 shrink-0 text-primary" />{detail}</li>)}
      </ul>
      <span className={cn("mt-auto flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors", badge ? "bg-primary text-primary-foreground group-hover:bg-primary/90" : "bg-accent text-accent-foreground group-hover:bg-accent/70")}>
        {action}<ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </span>
    </button>
  );
}

function UploadPdfForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "working") return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be 10 MB or smaller.");
      return;
    }
    setStatus("working");
    setError(null);
    trackProductEvent("waiver_import_started", {
      file_type: file.type || "unknown",
      size_mb_bucket: Math.max(1, Math.ceil(file.size / (1024 * 1024))),
    });

    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", name || file.name.replace(/\.[^.]+$/, ""));

    try {
      const res = await fetch("/api/ai-import", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        trackProductEvent("waiver_import_failed", { reason: `http_${res.status}` });
      setError(
        body?.error ??
          "Conversion failed. You can paste your waiver text instead — use “Start from scratch.”"
      );
      setStatus("error");
      return;
    }
      const { templateId, recovered, warning } = await res.json();
      if (typeof templateId !== "string" || !templateId) {
        trackProductEvent("waiver_import_failed", { reason: "invalid_response" });
        setError("The conversion finished without creating a draft. Please try again.");
        setStatus("error");
        return;
      }
      if (recovered === true) {
        trackProductEvent("waiver_import_failed", { reason: "recovery_draft" });
        toast.warning(
          typeof warning === "string"
            ? warning
            : "Automatic conversion did not finish, but your original file and a recovery draft were saved.",
        );
      } else {
        trackProductEvent("waiver_import_completed");
      }
      router.push(`/waivers/${templateId}`);
    } catch {
      trackProductEvent("waiver_import_failed", { reason: "network" });
      setError(
        "We couldn't reach the conversion service. Check your connection and try again; your file is still selected."
      );
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
      <BackLink onBack={onBack} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="e.g. Adult Liability Waiver"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          PDF, image, or Word file (max 10 MB)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.png,.jpg,.jpeg,.webp,.gif,.docx"
          required
          className="w-full rounded-md border border-dashed border-input bg-card px-3 py-6 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:border-ring/50"
        />
        <span className="mt-1 block text-xs text-muted-foreground/70">
          Accepts PDF, images (PNG, JPG, WebP, GIF), and Word .docx. A clear photo
          of a paper waiver works too.
        </span>
      </label>

      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
        >
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={status === "working"}>
        <Sparkles className="size-4" />
        {status === "working" ? "Converting… (up to a minute)" : "Convert to digital waiver"}
      </Button>
      <p className="text-xs text-muted-foreground/70">
        AI conversion is a draft. You&apos;ll review every clause before anything is
        published.
      </p>
    </form>
  );
}

function FromTextForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    let timeout: number | undefined;
    try {
      const raw = window.sessionStorage.getItem(SCRATCH_BACKUP_KEY);
      if (!raw) return;
      const backup = JSON.parse(raw) as { name?: unknown; text?: unknown };
      timeout = window.setTimeout(() => {
        if (typeof backup.name === "string") setName(backup.name);
        if (typeof backup.text === "string") setText(backup.text);
      }, 0);
    } catch {
      // Ignore malformed or unavailable tab storage.
    }
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!name && !text) return;
    const timeout = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(
          SCRATCH_BACKUP_KEY,
          JSON.stringify({ name, text }),
        );
      } catch {
        // The in-page form still retains input when storage is unavailable.
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [name, text]);

  return (
    <form
      action={async (formData) => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
          const result = await createTemplateFromText(formData);
          try {
            window.sessionStorage.removeItem(SCRATCH_BACKUP_KEY);
          } catch {
            // Draft creation already succeeded; storage cleanup is best-effort.
          }
          trackProductEvent("waiver_draft_created", { method: "scratch" });
          router.push(`/waivers/${result.templateId}`);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "We couldn't create the draft. Please try again; your text is still here."
          );
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8"
    >
      <BackLink onBack={onBack} />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver name</span>
        <input
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          required
          placeholder="e.g. Adult Liability Waiver"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver text</span>
        <textarea
          name="text"
          required
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={14}
          placeholder="Paste your full waiver text. Blank lines separate paragraphs."
          className={cn(inputClass, "font-mono text-sm")}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Creating…" : "Create draft"}
      </Button>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow";

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Choose a different method
    </button>
  );
}
