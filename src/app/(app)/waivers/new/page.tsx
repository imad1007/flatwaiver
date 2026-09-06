"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, PenLine, Sparkles } from "lucide-react";
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
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New waiver</h1>
      <p className="mt-2 text-muted-foreground">
        Two ways to start — both give you a draft to review before anything goes
        live.
      </p>

      {path === null && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <ChoiceCard
            icon={FileUp}
            title="Upload existing waiver"
            badge="AI converts it"
            body="PDF, a photo or scan, or a Word doc — the waiver you already use, converted into a signable form with every clause preserved exactly."
            onClick={() => {
              trackProductEvent("waiver_creation_method_selected", { method: "upload" });
              setPath("upload");
            }}
          />
          <ChoiceCard
            icon={PenLine}
            title="Start from scratch"
            body="Paste your waiver text (or start empty) and build the form yourself in the editor."
            onClick={() => {
              trackProductEvent("waiver_creation_method_selected", { method: "scratch" });
              setPath("scratch");
            }}
          />
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
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group rounded-2xl border border-border bg-card p-6 text-left shadow-card transition-all",
        "hover:-translate-y-0.5 hover:border-ring/50 hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-brand-600 transition-transform duration-200 group-hover:scale-110 dark:text-brand-300">
        <Icon className="size-5" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {badge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
            <Sparkles className="size-2.5" />
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
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
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
      className="mt-8 space-y-5"
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
