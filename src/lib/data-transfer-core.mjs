import { createHash } from "node:crypto";
import { z } from "zod";
import { csvEscape } from "./csv.ts";
import {
  draftContentSchema,
  draftHasMeaningfulContent,
} from "./waiver-schema.ts";

export const LIMITS = {
  files: 50000,
  rows: 100000,
  columns: 250,
  csv: 20 * 1024 ** 2,
  file: 50 * 1024 ** 2,
  zip: 5 * 1024 ** 3,
  metadata: 512 * 1024 ** 2,
  expanded: 5 * 1024 ** 3,
  ratio: 200,
};
export const providers = [
  "other",
  "smartwaiver",
  "waiverforever",
  "waiverfile",
  "flatwaiver_backup",
];
export const mappingFields = [
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
const date = z
  .string()
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Use a valid YYYY-MM-DD date",
  );
export const filtersSchema = z
  .object({
    from: date.default(""),
    to: date.default(""),
    template: z.union([z.uuid(), z.literal("")]).default(""),
    q: z.string().max(200).default(""),
    email: z.string().max(254).default(""),
    origin: z.enum(["all", "native", "imported"]).default("all"),
    flagged: z.boolean().default(false),
    templateStatus: z
      .enum(["all", "draft", "published", "archived"])
      .default("all"),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "From date must precede To date",
  );
export const optionsSchema = z.object({
  filters: filtersSchema.default(() => filtersSchema.parse({})),
  provider: z.enum(providers).default("other"),
  mapping: z.record(z.string().max(200), z.string().max(250)).default({}),
  delimiter: z.enum([",", ";", "\t"]).default(","),
  duplicates: z.enum(["skip", "copy"]).default("skip"),
  templateId: z.union([z.uuid(), z.literal("")]).default(""),
  name: z.string().max(200).default(""),
  signedAt: z.string().max(50).default(""),
  participant: z.string().max(200).default(""),
});
export const templatePackageSchema = z
  .object({
    format: z.literal("flatwaiver-template"),
    version: z.literal(1),
    exported_id: z.string().max(200).optional(),
    name: z.string().min(1).max(200),
    content: draftContentSchema,
    settings: z
      .object({
        expiry_months: z.number().int().min(1).max(120).nullable().optional(),
        photo_mode: z.enum(["off", "optional", "required"]).optional(),
      })
      .default({}),
  })
  .refine(
    (v) => draftHasMeaningfulContent(v.content),
    "Template has no waiver text",
  );
export function parseTemplate(raw) {
  if (Buffer.byteLength(JSON.stringify(raw)) > 2 * 1024 ** 2)
    throw new Error("Template exceeds 2 MB");
  const pkg = templatePackageSchema.parse(raw);
  if (
    new Set(pkg.content.fields.map((f) => f.key)).size !==
    pkg.content.fields.length
  )
    throw new Error("Duplicate field keys");
  return pkg;
}
export function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function safeFilename(name) {
  return (
    String(name)
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}_. -]/gu, "-")
      .replace(/^[. ]+|[. ]+$/g, "")
      .slice(0, 90) || "record"
  );
}
export function safeArchiveName(name) {
  if (
    !name ||
    name.length > 500 ||
    name.startsWith("/") ||
    /[\\:\x00-\x1f]/.test(name) ||
    name.split("/").some((p) => p === ".." || p === ".")
  )
    throw new Error("Unsafe archive path");
  return name;
}
export function validateMagic(bytes, name) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  if (
    ext === "png" &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    ["jpg", "jpeg"].includes(ext) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  throw new Error("File content does not match a supported PDF, PNG or JPEG");
}
export function dateTime(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && date.safeParse(value).success)
    return `${value}T00:00:00.000Z`;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Use an ISO signing date with timezone, or YYYY-MM-DD");
  if (!date.safeParse(value.slice(0, 10)).success)
    throw new Error("Invalid signing date");
  return new Date(value).toISOString();
}
export function validateImportedRecord(raw) {
  const nullableText = (max) => z.string().max(max).nullish();
  const parsed = z
    .object({
      external_id: nullableText(500),
      participant_name: nullableText(500),
      participant_email: z.email().nullish(),
      participant_phone: nullableText(100),
      date_of_birth: date.nullish(),
      original_signed_at: nullableText(100),
      waiver_title: nullableText(500),
      field_values: z.record(z.string().max(200), z.unknown()).default({}),
      source_evidence: z.record(z.string(), z.unknown()).default({}),
      pdf_filename: nullableText(500),
      source_template_id: z.uuid().nullish(),
      signature_filename: nullableText(500),
      expected_pdf_sha256: nullableText(64),
      expected_signature_sha256: nullableText(64),
    })
    .parse(raw);
  if (Buffer.byteLength(JSON.stringify(parsed)) > 200000)
    throw new Error("Imported row exceeds 200 KB");
  parsed.original_signed_at = dateTime(parsed.original_signed_at);
  return parsed;
}
/** Bounded RFC4180 parser. Quoted newlines and escaped quotes are preserved. */
export function parseCsv(text, delimiter = ",") {
  if (Buffer.byteLength(text) > LIMITS.csv)
    throw new Error("CSV exceeds 20 MB");
  if (text.includes("\0"))
    throw new Error("CSV must be UTF-8 text without null bytes");
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    cell = "",
    quoted = false,
    closed = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > LIMITS.columns) throw new Error("Too many CSV columns");
  };
  const pushRow = () => {
    pushCell();
    if (row.some((v) => v !== "")) rows.push(row);
    row = [];
    if (rows.length > LIMITS.rows + 1) throw new Error("Too many CSV rows");
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === delimiter) pushCell();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Malformed CSV quotes");
      cell += c;
    }
    if (cell.length > 100000)
      throw new Error("CSV cell exceeds 100,000 characters");
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell || row.length || closed) pushRow();
  const headers = rows.shift() ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h.trim() || h.length > 200) ||
    new Set(headers).size !== headers.length
  )
    throw new Error(
      "CSV needs unique, non-empty column names (max 200 characters)",
    );
  return { headers, rows };
}
export function mapCsvRow(headers, values, mapping, defaults = {}) {
  if (headers.length !== values.length)
    throw new Error("Column count differs from header");
  const data = { ...defaults, field_values: {}, source_evidence: {} };
  const used = new Set();
  headers.forEach((header, i) => {
    const target = mapping[header];
    if (!target) return;
    if (used.has(target)) throw new Error(`Multiple columns map to ${target}`);
    used.add(target);
    const value = values[i].trim();
    if (target.startsWith("custom:")) {
      const key = target.slice(7);
      if (!key || ["__proto__", "constructor", "prototype"].includes(key))
        throw new Error("Invalid custom field");
      data.field_values[key] = values[i];
    } else if (!mappingFields.includes(target))
      throw new Error("Unsupported field mapping");
    else if (target.startsWith("original_") && target !== "original_signed_at")
      data.source_evidence[target] = value;
    else data[target] = value || null;
  });
  if (
    data.participant_email &&
    !z.email().safeParse(data.participant_email).success
  )
    throw new Error("Invalid email");
  if (data.date_of_birth && !date.safeParse(data.date_of_birth).success)
    throw new Error("Invalid date of birth");
  data.original_signed_at = dateTime(data.original_signed_at);
  if (
    !data.external_id &&
    !data.participant_name &&
    !data.participant_email &&
    !data.pdf_filename
  )
    throw new Error(
      "Map an external ID, participant name/email or PDF filename",
    );
  return data;
}
export function dedupeKey(data) {
  return data.external_id
    ? `id:${data.external_id}`
    : `sha256:${hash(JSON.stringify(data))}`;
}
export function csvLine(values) {
  return (
    values
      .map((v) =>
        csvEscape(
          v == null
            ? ""
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v),
        ),
      )
      .join(",") + "\r\n"
  );
}
export const CSV_COLUMNS = [
  "submission_id",
  "waiver_id",
  "waiver_title",
  "participant_name",
  "participant_email",
  "participant_phone",
  "date_of_birth",
  "signed_at",
  "created_at",
  "signature_status",
  "source",
  "external_id",
  "original_filename",
  "pdf_sha256",
  "field_values_json",
  "source_evidence_json",
  "record_origin",
  "original_signed_at",
  "imported_at",
];
export function sourceLabel(provider) {
  return (
    {
      smartwaiver: "Smartwaiver",
      waiverforever: "WaiverForever",
      waiverfile: "WaiverFile",
      flatwaiver_backup: "FlatWaiver backup",
      other: "Other",
    }[provider] ?? "Other"
  );
}
export function csvRecord(row, customKeys) {
  return csvLine([
    row.id,
    row.template_id,
    row.waiver_title,
    row.participant_name,
    row.participant_email,
    row.participant_phone,
    row.date_of_birth,
    row.original_signed_at,
    row.created_at ?? row.imported_at,
    row.record_origin === "native"
      ? "Signed through FlatWaiver"
      : `Imported from ${sourceLabel(row.source_provider)}`,
    row.source_provider,
    row.external_id,
    row.original_filename,
    row.pdf_sha256,
    row.field_values,
    row.source_evidence,
    row.record_origin === "native" ? "native" : "imported",
    row.original_signed_at,
    row.record_origin === "native" ? null : row.imported_at,
    ...customKeys.map((k) => row.field_values?.[k]),
  ]);
}
export function filterQuery(query, filters, native = true) {
  const dateColumn = native ? "signed_at" : "original_signed_at";
  if (filters.from) query = query.gte(dateColumn, `${filters.from}T00:00:00Z`);
  if (filters.to)
    query = query.lt(
      dateColumn,
      new Date(Date.parse(filters.to) + 86400000).toISOString(),
    );
  if (filters.template) query = query.eq("template_id", filters.template);
  if (filters.q)
    query = query.ilike(
      native ? "signer_name" : "participant_name",
      `%${filters.q.replace(/[%_\\]/g, "\\$&")}%`,
    );
  if (filters.email)
    query = query.ilike(
      native ? "signer_email" : "participant_email",
      `%${filters.email.replace(/[%_\\]/g, "\\$&")}%`,
    );
  if (filters.flagged)
    query = native
      ? query.eq("flagged", true)
      : query.eq("id", "00000000-0000-0000-0000-000000000000");
  return query;
}
