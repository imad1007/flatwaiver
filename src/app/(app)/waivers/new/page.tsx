"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileUp, PenLine, Sparkles } from "lucide-react";
import { createTemplateFromText } from "../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewWaiverPage() {
  const [path, setPath] = useState<"upload" | "scratch" | null>(null);

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
            title="Upload existing PDF"
            badge="AI converts it"
            body="The waiver you already use, converted into a signable form with every clause preserved exactly."
            onClick={() => setPath("upload")}
          />
          <ChoiceCard
            icon={PenLine}
            title="Start from scratch"
            body="Paste your waiver text (or start empty) and build the form yourself in the editor."
            onClick={() => setPath("scratch")}
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("PDF must be 10 MB or smaller.");
      return;
    }
    setStatus("working");
    setError(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", name || file.name.replace(/\.pdf$/i, ""));

    const res = await fetch("/api/ai-import", { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error ??
          "Conversion failed. You can paste your waiver text instead — use “Start from scratch.”"
      );
      setStatus("error");
      return;
    }
    const { templateId } = await res.json();
    router.push(`/waivers/${templateId}`);
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
          placeholder="e.g. Adult Liability Waiver"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">PDF file (max 10 MB)</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-md border border-dashed border-input bg-card px-3 py-6 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:border-ring/50"
        />
      </label>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
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
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={async (formData) => {
        setSubmitting(true);
        try {
          await createTemplateFromText(formData);
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
          rows={14}
          placeholder="Paste your full waiver text. Blank lines separate paragraphs."
          className={cn(inputClass, "font-mono text-sm")}
        />
      </label>

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
