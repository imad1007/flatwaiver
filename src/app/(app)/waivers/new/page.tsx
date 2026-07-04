"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplateFromText } from "../actions";

export default function NewWaiverPage() {
  const [path, setPath] = useState<"upload" | "text" | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New waiver</h1>
      <p className="mt-2 text-neutral-500">
        Two ways to start — both give you a draft to review before anything goes
        live.
      </p>

      {path === null && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <button
            onClick={() => setPath("upload")}
            className="rounded-xl border border-neutral-200 p-8 text-left hover:border-neutral-900"
          >
            <div className="text-lg font-bold">Upload PDF</div>
            <p className="mt-2 text-sm text-neutral-500">
              Upload the waiver you already use. AI converts it into a signable
              form — wording preserved exactly.
            </p>
          </button>
          <button
            onClick={() => setPath("text")}
            className="rounded-xl border border-neutral-200 p-8 text-left hover:border-neutral-900"
          >
            <div className="text-lg font-bold">Start from text</div>
            <p className="mt-2 text-sm text-neutral-500">
              Paste your waiver text and build the form yourself.
            </p>
          </button>
        </div>
      )}

      {path === "upload" && <UploadPdfForm onBack={() => setPath(null)} />}
      {path === "text" && <FromTextForm onBack={() => setPath(null)} />}
    </div>
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
          "Conversion failed. You can paste your waiver text instead — use “Start from text.”"
      );
      setStatus("error");
      return;
    }
    const { templateId } = await res.json();
    router.push(`/waivers/${templateId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <BackLink onBack={onBack} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Adult Liability Waiver"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-neutral-900 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">PDF file (max 10 MB)</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "working"}
        className="rounded-md bg-neutral-900 px-6 py-3 font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {status === "working" ? "Converting… (up to a minute)" : "Convert to digital waiver"}
      </button>
      <p className="text-xs text-neutral-400">
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
      className="mt-8 space-y-4"
    >
      <BackLink onBack={onBack} />
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver name</span>
        <input
          name="name"
          type="text"
          required
          placeholder="e.g. Adult Liability Waiver"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:border-neutral-900 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Waiver text</span>
        <textarea
          name="text"
          required
          rows={14}
          placeholder="Paste your full waiver text. Blank lines separate paragraphs."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-neutral-900 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-neutral-900 px-6 py-3 font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-neutral-500 underline hover:text-neutral-900"
    >
      ← Choose a different method
    </button>
  );
}
