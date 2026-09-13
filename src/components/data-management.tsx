"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Archive,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Template = { id: string; name: string };
type Job = {
  id: string;
  direction: string;
  format: string;
  status: string;
  summary: Record<string, number>;
  progress: number;
  total: number;
  error?: string;
  created_at?: string;
  expires_at?: string;
};
type Item = {
  id: string;
  row_number: number;
  kind: string;
  status: string;
  data: Record<string, unknown>;
  error: string | null;
  warnings: string[];
};
const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50";
const secondary =
  "inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50";
const targets = [
  "participant_name",
  "participant_email",
  "participant_phone",
  "date_of_birth",
  "waiver_title",
  "original_signed_at",
  "external_id",
  "original_ip",
  "original_user_agent",
  "pdf_filename",
  "signature_filename",
];
async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
function csvHeaders(text: string, delimiter: string) {
  const result: string[] = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
      result.push(value.replace(/^\uFEFF/, ""));
      value = "";
      if (c !== delimiter) return result;
    } else value += c;
  }
  if (quoted) throw new Error("CSV header is too long or has unclosed quotes");
  if (value) result.push(value);
  return result;
}
export function DataManagement({ templates }: { templates: Template[] }) {
  const [tab, setTab] = useState("export"),
    [format, setFormat] = useState("csv"),
    [importType, setImportType] = useState("csv");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    template: "",
    q: "",
    email: "",
    origin: "all",
    flagged: false,
    templateStatus: "all",
  });
  const [files, setFiles] = useState<File[]>([]),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState("other"),
    [delimiter, setDelimiter] = useState(","),
    [duplicates, setDuplicates] = useState("skip");
  const [name, setName] = useState(""),
    [templateId, setTemplateId] = useState(""),
    [signedAt, setSignedAt] = useState(""),
    [participant, setParticipant] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]),
    [job, setJob] = useState<Job | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [page, setPage] = useState(0),
    [historyPage, setHistoryPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const data = await api(`/api/data/jobs?page=${historyPage}`);
    setJobs(data.jobs);
  }, [historyPage]);
  const loadJob = useCallback(async (id: string, p = 0) => {
    const data = await api(`/api/data/jobs/${id}?page=${p}`);
    setJob(data.job);
    setItems(data.items);
    setPage(p);
  }, []);
  useEffect(() => {
    let active = true;
    const update = () => {
      if (active)
        void refresh().catch((e) => {
          if (active) setError(e.message);
        });
    };
    update();
    const timer = setInterval(update, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!job || !["queued", "ready", "processing"].includes(job.status)) return;
    const timer = setInterval(() => {
      void loadJob(job.id, page).catch((e) => setError(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [job, loadJob, page]);
  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await run();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  async function chooseFiles(list: FileList | null) {
    if (!list) return;
    const selected = Array.from(list);
    setFiles(selected);
    setHeaders([]);
    setMapping({});
    const csv = selected.find((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csv) {
      if (csv.size > 20 * 1024 ** 2) {
        setError("CSV files must be 20 MB or smaller.");
        return;
      }
      try {
        const found = csvHeaders(await csv.slice(0, 65536).text(), delimiter);
        setHeaders(found);
        setMapping(
          Object.fromEntries(
            found.map((h) => [
              h,
              targets.includes(h.trim().toLowerCase())
                ? h.trim().toLowerCase()
                : "",
            ]),
          ),
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Couldn't read the CSV header",
        );
      }
    }
  }
  async function startImport() {
    if (!files.length) throw new Error("Choose files to import.");
    if (files.length > 50000)
      throw new Error("Maximum 50,000 files per import.");
    const options = {
      provider,
      mapping,
      delimiter,
      duplicates,
      name,
      templateId,
      signedAt,
      participant,
    };
    const created = await api("/api/data/jobs", {
      direction: "import",
      format: importType,
      options,
    });
    const db = createClient();
    let uploaded = 0;
    // Upload one file at a time; large PDFs/ZIPs never become browser buffers.
    for (let offset = 0; offset < files.length; offset += 50) {
      const batch = files.slice(offset, offset + 50);
      const result = await api(`/api/data/jobs/${created.id}`, {
        action: "upload",
        files: batch.map((f) => ({ name: f.name, size: f.size })),
      });
      for (const u of result.uploads) {
        const file = batch.find((f) => f.name === u.name)!;
        const { error } = await db.storage
          .from("uploads")
          .uploadToSignedUrl(u.path, u.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (error)
          throw new Error(
            `Upload failed for ${file.name}. Cancel this transfer and try again.`,
          );
        setMessage(`Uploaded ${++uploaded} of ${files.length} files`);
      }
    }
    await api(`/api/data/jobs/${created.id}`, { action: "preview", options });
    setMessage("");
    await loadJob(created.id);
  }
  const selectedActive =
    job && ["queued", "ready", "processing"].includes(job.status);
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Your data, in your hands
          </p>
          <h1 className="mt-2 text-3xl font-bold">Import &amp; Export</h1>
          <p className="mt-2 text-muted-foreground">
            Download your records or bring existing waivers to FlatWaiver.
          </p>
        </div>
        <Link className={secondary} href="/data/records">
          <Archive className="size-4" />
          Imported records
        </Link>
      </div>
      <div
        className="flex flex-wrap gap-2 border-b pb-3"
        role="tablist"
        aria-label="Data management"
      >
        {["export", "import", "history"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold capitalize ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {tab === "export" && (
        <section className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Export your waiver records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Large downloads are prepared securely in the background. You can
            leave this page and return to History.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["csv", "Submission data", "Spreadsheet with custom answers"],
              ["pdfs", "Signed PDFs", "Original documents in a ZIP"],
              ["backup", "Full backup", "Records, PDFs and templates"],
              ["templates", "Waiver templates", "Portable template JSON files"],
            ].map(([id, title, desc]) => (
              <button
                key={id}
                onClick={() => setFormat(id)}
                aria-pressed={format === id}
                className={`rounded-xl border p-4 text-left ${format === id ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
              >
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["from", "to", "q", "email"].map((k) => (
              <label key={k} className="space-y-1 text-sm">
                <span>
                  {
                    (
                      {
                        from: "From (UTC)",
                        to: "To (UTC)",
                        q: "Participant name",
                        email: "Participant email",
                      } as Record<string, string>
                    )[k]
                  }
                </span>
                <input
                  className={input}
                  type={["from", "to"].includes(k) ? "date" : "text"}
                  value={filters[k as keyof typeof filters] as string}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value })
                  }
                />
              </label>
            ))}
            <label className="space-y-1 text-sm">
              Waiver
              <select
                className={input}
                value={filters.template}
                onChange={(e) =>
                  setFilters({ ...filters, template: e.target.value })
                }
              >
                <option value="">All waivers</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Record source
              <select
                className={input}
                value={filters.origin}
                onChange={(e) =>
                  setFilters({ ...filters, origin: e.target.value })
                }
              >
                <option value="all">All records</option>
                <option value="native">Signed through FlatWaiver</option>
                <option value="imported">Imported records</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Waiver status
              <select
                className={input}
                value={filters.templateStatus}
                onChange={(e) =>
                  setFilters({ ...filters, templateStatus: e.target.value })
                }
              >
                {["all", "draft", "published", "archived"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.flagged}
                onChange={(e) =>
                  setFilters({ ...filters, flagged: e.target.checked })
                }
              />
              Flagged native signatures only
            </label>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Leave filters empty for all records. Date filters use the original
            signing date; undated imports are excluded when a date is selected.
          </p>
          <button
            disabled={busy}
            className={`${primary} mt-6`}
            onClick={() =>
              act(async () => {
                const r = await api("/api/data/jobs", {
                  direction: "export",
                  format,
                  options: { filters },
                });
                await loadJob(r.id);
              })
            }
          >
            <ArrowDownToLine className="size-4" />
            Prepare export
          </button>
        </section>
      )}
      {tab === "import" && (
        <section className="rounded-2xl border bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Bring your existing records</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload → Map fields → Review → Confirm. Nothing is added to your
            records until you confirm.
          </p>
          <div className="mt-5 rounded-xl bg-primary/5 p-4 text-sm">
            <ShieldCheck className="mr-2 inline size-4 text-primary" />
            Imported documents retain their source. They are never presented as
            signatures collected by FlatWaiver.
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Import type
              <select
                className={input}
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value);
                  setFiles([]);
                  setHeaders([]);
                }}
              >
                <option value="csv">
                  Participant / submission CSV + optional PDFs
                </option>
                <option value="historical">Historical PDFs or ZIP</option>
                <option value="template">FlatWaiver template JSON</option>
                <option value="restore">Restore FlatWaiver backup ZIP</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Source provider
              <select
                className={input}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="other">Other / spreadsheet</option>
                <option value="smartwaiver">Smartwaiver</option>
                <option value="waiverforever">WaiverForever</option>
                <option value="waiverfile">WaiverFile</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              Duplicates
              <select
                className={input}
                value={duplicates}
                onChange={(e) => setDuplicates(e.target.value)}
              >
                <option value="skip">Skip existing (recommended)</option>
                <option value="copy">Import another copy</option>
              </select>
            </label>
            {importType === "template" ? (
              <label className="space-y-1 text-sm">
                Template name (optional)
                <input
                  className={input}
                  value={name}
                  maxLength={200}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Original name (Imported)"
                />
              </label>
            ) : (
              <label className="space-y-1 text-sm">
                Associate with waiver (optional)
                <select
                  className={input}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Keep original title only</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {importType === "historical" && (
              <>
                <label className="space-y-1 text-sm">
                  Original signing date (optional)
                  <input
                    className={input}
                    type="date"
                    value={signedAt}
                    onChange={(e) => setSignedAt(e.target.value)}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  Participant for unmatched PDFs (optional)
                  <input
                    className={input}
                    value={participant}
                    onChange={(e) => setParticipant(e.target.value)}
                  />
                </label>
              </>
            )}
            {importType === "csv" && (
              <label className="space-y-1 text-sm">
                CSV delimiter
                <select
                  className={input}
                  value={delimiter}
                  onChange={(e) => {
                    setDelimiter(e.target.value);
                    setFiles([]);
                    setHeaders([]);
                  }}
                >
                  <option value=",">Comma</option>
                  <option value=";">Semicolon</option>
                  <option value={"\t"}>Tab</option>
                </select>
              </label>
            )}
          </div>
          <label className="mt-6 block rounded-xl border-2 border-dashed p-5">
            <span className="block font-medium">Choose files</span>
            <span className="my-2 block text-xs text-muted-foreground">
              CSV up to 20 MB, each PDF/image up to 50 MB, each ZIP up to 5 GB
              (subject to account storage limits). ZIP contents are checked
              before import. For CSV mapping, select the CSV separately
              alongside your PDFs or PDF ZIP.
            </span>
            <input
              key={`${importType}-${delimiter}`}
              type="file"
              multiple
              accept={
                importType === "template"
                  ? ".json"
                  : importType === "restore"
                    ? ".zip"
                    : ".csv,.pdf,.zip,.png,.jpg,.jpeg"
              }
              disabled={busy}
              onChange={(e) => void chooseFiles(e.target.files)}
              className="block w-full text-sm"
            />
            {files.length > 0 && (
              <span className="mt-2 block text-sm">
                {files.length} file(s) selected
              </span>
            )}
          </label>
          {headers.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold">Map your columns</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use ISO dates (YYYY-MM-DD, or a timestamp with timezone). PDFs
                match only exact filenames or external ID + .pdf.
              </p>
              <div className="mt-4 space-y-3">
                {headers.map((h) => (
                  <div
                    key={h}
                    className="grid items-center gap-2 sm:grid-cols-2"
                  >
                    <span className="break-words text-sm">{h}</span>
                    <select
                      aria-label={`Map ${h}`}
                      className={input}
                      value={mapping[h] || ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [h]: e.target.value })
                      }
                    >
                      <option value="">Ignore column</option>
                      {targets.map((t) => (
                        <option key={t} value={t}>
                          {t.replaceAll("_", " ")}
                        </option>
                      ))}
                      <option value={`custom:${h}`}>Custom field: {h}</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            disabled={busy || !files.length}
            className={`${primary} mt-6`}
            onClick={() => act(startImport)}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="size-4" />
            )}
            Prepare import preview
          </button>
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {message}
          </p>
        </section>
      )}
      {job && (
        <section
          aria-live="polite"
          className="rounded-2xl border bg-card p-5 sm:p-7"
        >
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="text-xl font-semibold">
              {job.direction === "export" ? "Your export" : "Import review"}
            </h2>
            <span className="rounded-full bg-muted px-3 py-1 text-sm capitalize">
              {job.status}
            </span>
          </div>
          {selectedActive && (
            <p className="mt-4 flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Preparing your {job.direction}…{" "}
              {job.progress > 0
                ? `${job.progress} records processed`
                : "Waiting for preparation to start"}
              . You can return later.
            </p>
          )}
          {job.error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {job.error}
            </p>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(job.summary ?? {})
              .filter(([k]) =>
                [
                  "valid",
                  "invalid",
                  "skipped",
                  "imported",
                  "warnings",
                  "records",
                  "templates",
                  "pdfs",
                  "missingPdfs",
                  "unmatchedImages",
                ].includes(k),
              )
              .map(([k, v]) => (
                <div key={k} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs capitalize text-muted-foreground">
                    {k === "missingPdfs"
                      ? "Without PDF"
                      : k === "unmatchedImages"
                        ? "Unmatched images"
                        : k}
                  </dt>
                  <dd className="mt-1 text-xl font-bold">{v}</dd>
                </div>
              ))}
          </dl>
          {items.length > 0 && (
            <>
              <div className="mt-5 overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted">
                    <tr>
                      {["Row", "Record", "Result", "Details"].map((h) => (
                        <th key={h} className="p-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="p-3">{i.row_number}</td>
                        <td className="max-w-xs break-words p-3">
                          {String(
                            i.data.participant_name ||
                              i.data.name ||
                              i.data.pdf_filename ||
                              i.data.external_id ||
                              "Metadata record",
                          )}
                        </td>
                        <td className="p-3">{i.status}</td>
                        <td className="max-w-sm p-3 text-xs text-muted-foreground">
                          {i.error || i.warnings.join(" ")}
                          <details className="mt-2">
                            <summary className="cursor-pointer text-primary">
                              Review content and metadata
                            </summary>
                            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(i.data, null, 2)}
                            </pre>
                          </details>
                          {Boolean(i.data.pdf_filename) && (
                            <p>PDF: {String(i.data.pdf_filename)}</p>
                          )}
                          {Boolean(i.data.original_signed_at) && (
                            <p>
                              Source date: {String(i.data.original_signed_at)}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  className={secondary}
                  disabled={page === 0 || busy}
                  onClick={() => act(() => loadJob(job.id, page - 1))}
                >
                  Previous
                </button>
                <span className="text-sm">Page {page + 1}</span>
                <button
                  className={secondary}
                  disabled={items.length < 10 || busy}
                  onClick={() => act(() => loadJob(job.id, page + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {job.status === "preview" && (
              <button
                className={primary}
                disabled={busy || !job.summary.valid}
                onClick={() =>
                  act(async () => {
                    await api(`/api/data/jobs/${job.id}`, {
                      action: "confirm",
                    });
                    await loadJob(job.id);
                  })
                }
              >
                <CheckCircle2 className="size-4" />
                Import {job.summary.valid || 0} valid records
              </button>
            )}
            {job.status === "completed" && job.direction === "export" && (
              <a
                className={primary}
                href={`/api/data/jobs/${job.id}?download=1`}
              >
                Download {job.format === "csv" ? "CSV" : "ZIP"}
              </a>
            )}
            {job.status === "completed" && job.direction === "import" && (
              <Link
                className={primary}
                href={job.format === "template" ? "/waivers" : "/data/records"}
              >
                View imported{" "}
                {job.format === "template" ? "templates" : "records"}
              </Link>
            )}
            {job.direction === "import" &&
              ["preview", "completed", "failed"].includes(job.status) && (
                <a
                  className={secondary}
                  href={`/api/data/jobs/${job.id}?errors=1`}
                >
                  Download skipped / error rows
                </a>
              )}
            {job.status === "failed" && (
              <button
                className={secondary}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`/api/data/jobs/${job.id}`, { action: "retry" });
                    await loadJob(job.id);
                  })
                }
              >
                Retry safely
              </button>
            )}
            {["uploading", "preview", "failed"].includes(job.status) && (
              <button
                className={secondary}
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api(`/api/data/jobs/${job.id}`, { action: "cancel" });
                    await loadJob(job.id);
                  })
                }
              >
                Cancel transfer
              </button>
            )}
          </div>
          {job.status === "preview" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Review the matches and warnings before confirming. Invalid and
              duplicate rows are skipped. Unmatched images are not imported; map
              a signature filename to attach them. Templates are created as
              drafts for your review.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Downloads and staged files expire after seven days. Imported
            originals remain in your private archive.
          </p>
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold">
          {tab === "history" ? "Transfer history" : "Recent transfers"}
        </h2>
        <div className="mt-3 divide-y rounded-xl border">
          {jobs.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              Your imports and exports will appear here.
            </p>
          ) : (
            jobs.map((j) => (
              <button
                key={j.id}
                onClick={() => act(() => loadJob(j.id))}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium capitalize">
                    {j.direction} · {j.format}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {j.created_at
                      ? new Date(j.created_at).toLocaleString()
                      : ""}
                  </p>
                </div>
                <span className="text-sm capitalize">{j.status}</span>
              </button>
            ))
          )}
        </div>
        <div className="mt-3 flex gap-3">
          <button
            className={secondary}
            disabled={!historyPage}
            onClick={() => setHistoryPage((p) => p - 1)}
          >
            Newer
          </button>
          <button
            className={secondary}
            disabled={jobs.length < 20}
            onClick={() => setHistoryPage((p) => p + 1)}
          >
            Older
          </button>
        </div>
      </section>
    </div>
  );
}
