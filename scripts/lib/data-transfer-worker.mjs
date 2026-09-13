import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, stat, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  LIMITS,
  parseCsv,
  mapCsvRow,
  parseTemplate,
  dateTime,
  dedupeKey,
  hash,
  safeFilename,
  csvLine,
  csvRecord,
  CSV_COLUMNS,
  optionsSchema,
  filterQuery,
  validateImportedRecord,
} from "../../src/lib/data-transfer-core.mjs";
import {
  download,
  uploadFile,
  extractZip,
  checkDocument,
  makeZip,
  fileHash,
  recordLines,
} from "./data-transfer-io.mjs";
import {
  checkTransfer,
  withTransferSignal,
  JOB_TIMEOUT_MS,
} from "./data-transfer-runtime.mjs";

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}
async function utf8File(path) {
  return new TextDecoder("utf-8", { fatal: true }).decode(await readFile(path));
}
export async function* pages(
  db,
  table,
  configure = (q) => q,
  columns = "*",
  pageSize = 500,
) {
  let cursor = "";
  for (;;) {
    checkTransfer();
    let q = configure(db.from(table).select(columns))
      .order("id")
      .limit(pageSize);
    if (cursor) q = q.gt("id", cursor);
    const rows = checked(await q);
    for (const row of rows) {
      checkTransfer();
      yield row;
    }
    if (rows.length < pageSize) break;
    cursor = rows.at(-1).id;
  }
}
async function patchJob(db, job, update) {
  checkTransfer();
  const data = checked(
    await db
      .from("data_jobs")
      .update({
        leased_until: new Date(Date.now() + 120000).toISOString(),
        ...update,
      })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .gt("leased_until", new Date().toISOString())
      .gt("expires_at", new Date().toISOString())
      .select("id"),
  );
  if (!data?.length) throw new Error("Job lease lost");
}
async function readInputs(db, job, directory) {
  const files = new Map();
  let total = 0,
    inputBytes = 0;
  for await (const entry of pages(db, "data_job_files", (q) =>
    q.eq("job_id", job.id),
  )) {
    if (!entry.path.startsWith(`${job.org_id}/transfers/${job.id}/input/`))
      throw new Error("Invalid upload path");
    const ext = entry.filename.split(".").at(-1).toLowerCase();
    const max =
      ext === "zip"
        ? LIMITS.zip
        : ["csv", "json"].includes(ext)
          ? LIMITS.csv
          : LIMITS.file;
    inputBytes += Number(entry.size);
    if (Number(entry.size) > max || inputBytes > LIMITS.zip)
      throw new Error("Upload exceeds input size limits");
    const file = await download(
      db,
      "uploads",
      entry.path,
      job.org_id,
      directory,
      Math.min(max, Number(entry.size)),
    );
    if (file.size !== entry.size)
      throw new Error(`Upload incomplete: ${entry.filename}`);
    const entries = entry.filename.toLowerCase().endsWith(".zip")
      ? await extractZip(file.local, directory, {
          files: LIMITS.files - files.size,
          expanded: LIMITS.expanded - total,
        })
      : new Map([[entry.filename, file]]);
    for (const [name, item] of entries) {
      total += item.size;
      if (files.has(name))
        throw new Error(`Ambiguous filename: ${name}. Use unique names.`);
      if (files.size >= LIMITS.files || total > LIMITS.expanded)
        throw new Error("Transfer exceeds expanded file limits");
      files.set(name, item);
    }
  }
  if (!files.size) throw new Error("Upload at least one file");
  return files;
}
/** Only exact paths or a unique exact basename can match; never fuzzy-match names. */
export function matchFile(files, requested) {
  if (!requested) return null;
  if (files.has(requested)) return { name: requested, ...files.get(requested) };
  const matches = [...files].filter(
    ([name]) => name.split("/").at(-1) === requested,
  );
  if (matches.length > 1)
    throw new Error(`Ambiguous match for ${requested}; map its full path`);
  return matches.length ? { name: matches[0][0], ...matches[0][1] } : null;
}
async function inspectRecord(data, files, used) {
  const warnings = [];
  const explicit = data.pdf_filename;
  const pdf = matchFile(
    files,
    explicit || (data.external_id ? `${data.external_id}.pdf` : null),
  );
  if (explicit && !pdf) throw new Error(`Missing PDF: ${explicit}`);
  if (pdf) {
    if (!pdf.name.toLowerCase().endsWith(".pdf"))
      throw new Error("Expected a PDF");
    await checkDocument(pdf, pdf.name);
    if (data.expected_pdf_sha256 && data.expected_pdf_sha256 !== pdf.hash)
      throw new Error("PDF hash differs from backup manifest");
    data.pdf_filename = pdf.name;
    data.original_filename = pdf.name;
    data.expected_pdf_sha256 = pdf.hash;
    used.add(pdf.name);
  } else
    warnings.push(
      "No original PDF attached; this is a metadata-only imported record.",
    );
  const sig = matchFile(files, data.signature_filename);
  if (data.signature_filename && !sig)
    throw new Error("Missing source signature image");
  if (sig) {
    if (!/\.(png|jpe?g)$/i.test(sig.name))
      throw new Error("Expected PNG or JPEG source signature");
    await checkDocument(sig, sig.name);
    if (
      data.expected_signature_sha256 &&
      data.expected_signature_sha256 !== sig.hash
    )
      throw new Error("Signature hash differs from backup");
    data.signature_filename = sig.name;
    data.expected_signature_sha256 = sig.hash;
    used.add(sig.name);
  }
  if (!data.original_signed_at)
    warnings.push("Original signing date was not supplied.");
  data.record_origin = "imported";
  return warnings;
}
async function summarize(db, job) {
  return checked(await db.rpc("data_import_summary", { p_job: job.id }));
}
async function prepareImport(db, job, directory) {
  const options = optionsSchema.parse(job.options);
  const files = await readInputs(db, job, directory);
  const used = new Set();
  // Staging is replaceable. Final archive records and template versions are not.
  checked(
    await db.rpc("stage_data_import", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_items: [],
      p_reset: true,
    }),
  );
  const existing = new Set(),
    nativeIds = new Set(),
    templateKeys = new Set();
  for await (const r of pages(
    db,
    "imported_waivers",
    (q) => q.eq("org_id", job.org_id),
    "id,source_provider,dedupe_key",
  )) {
    existing.add(`${r.source_provider}/${r.dedupe_key}`);
    if (job.format === "restore") nativeIds.add(r.id);
  }
  if (job.format === "restore")
    for await (const r of pages(
      db,
      "signed_waivers",
      (q) => q.eq("org_id", job.org_id),
      "id",
    ))
      nativeIds.add(r.id);
  for await (const t of pages(
    db,
    "waiver_templates",
    (q) => q.eq("org_id", job.org_id),
    "id,import_key",
  )) {
    if (t.import_key) templateKeys.add(t.import_key);
    templateKeys.add(`id:${t.id}`);
  }
  let row = 0;
  let batch = [];
  let batchBytes = 0;
  const seen = new Set();
  const flushPreview = async () => {
    if (!batch.length) return;
    checked(
      await db.rpc("stage_data_import", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_items: batch,
      }),
    );
    batch = [];
    batchBytes = 0;
    await patchJob(db, job, { progress: row });
  };
  const stage = async (kind, raw, convert) => {
    if (++row > LIMITS.rows) throw new Error("Too many import records");
    const oversizedRaw =
      Buffer.byteLength(JSON.stringify(raw)) >
      (kind === "template" ? 2 * 1024 ** 2 : 200000);
    const item = {
      id: randomUUID(),
      job_id: job.id,
      row_number: row,
      kind,
      status: "valid",
      data: {
        original_values: oversizedRaw
          ? {
              omitted:
                "Source row exceeds the import metadata limit. Review the original upload.",
            }
          : raw,
      },
      error: null,
      warnings: [],
    };
    try {
      if (oversizedRaw)
        throw new Error("Source row exceeds the import metadata limit");
      let data = await convert();
      if (kind === "record") {
        data = validateImportedRecord(data);
        item.warnings = await inspectRecord(data, files, used);
        data.source_provider =
          job.format === "restore" ? "flatwaiver_backup" : options.provider;
        data.template_id = options.templateId || null;
        data.dedupe_key = dedupeKey(data);
      }
      const key =
        kind === "record"
          ? `${data.source_provider}/${data.dedupe_key}`
          : data.dedupe_key;
      const duplicate =
        seen.has(key) ||
        (kind === "record"
          ? existing.has(key) ||
            (job.format === "restore" && nativeIds.has(data.external_id))
          : templateKeys.has(key));
      if (options.duplicates === "copy")
        data.dedupe_key += `/copy/${job.id}/${row}`;
      else if (duplicate) {
        item.status = "skipped";
        item.error = "Duplicate record";
      }
      seen.add(key);
      item.data = data;
    } catch (error) {
      item.status = "invalid";
      item.error = String(error.message).slice(0, 1000);
    }
    const itemBytes = Buffer.byteLength(JSON.stringify(item));
    if (batch.length && batchBytes + itemBytes > 2 * 1024 ** 2)
      await flushPreview();
    batch.push(item);
    batchBytes += itemBytes;
    if (batch.length === 100) await flushPreview();
  };
  const template = async (raw) => {
    const pkg = parseTemplate(raw);
    const name = options.name || `${pkg.name} (Imported)`;
    return {
      name,
      content: { ...pkg.content, title: name },
      settings: pkg.settings,
      dedupe_key: pkg.exported_id
        ? `id:${pkg.exported_id}`
        : `template:${hash(JSON.stringify(pkg))}`,
    };
  };
  if (job.format === "restore") {
    const manifestFile = files.get("manifest.json");
    const records = files.get("records.ndjson");
    if (!manifestFile || !records)
      throw new Error("Backup needs manifest.json and records.ndjson");
    const manifest = JSON.parse(await utf8File(manifestFile.local));
    if (
      manifest.format !== "flatwaiver-backup" ||
      manifest.version !== 1 ||
      !Array.isArray(manifest.files)
    )
      throw new Error("Unsupported FlatWaiver backup format");
    if (manifest.files.length > LIMITS.files)
      throw new Error("Too many manifest files");
    const listed = new Set();
    for (const entry of manifest.files) {
      if (!entry || typeof entry.name !== "string" || listed.has(entry.name))
        throw new Error("Invalid or duplicate manifest entry");
      listed.add(entry.name);
      const actual = files.get(entry.name);
      if (!actual || actual.hash !== entry.sha256 || actual.size !== entry.size)
        throw new Error(`Backup checksum mismatch: ${entry.name}`);
    }
    for (const name of files.keys())
      if (name !== "manifest.json" && !listed.has(name))
        throw new Error(`Unlisted backup file: ${name}`);
    let restoredRecords = 0,
      restoredTemplateCount = 0;
    for (const [name, file] of files)
      if (name.startsWith("templates/") && name.endsWith(".json")) {
        const raw = JSON.parse(await utf8File(file.local));
        await stage("template", raw, () => template(raw));
        restoredTemplateCount++;
      }
    for await (const line of recordLines(records.local)) {
      if (!line.trim()) continue;
      restoredRecords++;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        throw new Error("Malformed backup record");
      }
      await stage("record", r, async () => {
        if (!r.id || typeof r.id !== "string")
          throw new Error("Missing exported submission ID");
        return {
          external_id: r.id,
          waiver_title: r.waiver_title,
          participant_name: r.participant_name,
          participant_email: r.participant_email,
          participant_phone: r.participant_phone,
          date_of_birth: r.date_of_birth,
          original_signed_at: dateTime(r.original_signed_at),
          source_template_id: r.template_id,
          field_values: r.field_values ?? {},
          source_evidence: {
            // Preserve the complete original record, including earlier import
            // timestamps/IDs. New import timestamps describe this restore only.
            backup_exported_record: r,
            backup_record: r.source_evidence,
            exported_origin: r.record_origin,
            exported_source: r.source_provider,
          },
          pdf_filename: r.pdf_filename,
          signature_filename: r.signature_filename,
          expected_pdf_sha256: r.pdf_sha256,
          expected_signature_sha256: r.signature_sha256,
        };
      });
    }
    if (
      restoredRecords !== manifest.submission_count ||
      restoredTemplateCount !== manifest.template_count
    )
      throw new Error("Backup record counts differ from manifest");
  } else if (job.format === "template") {
    const jsons = [...files].filter(([n]) => n.endsWith(".json"));
    if (!jsons.length) throw new Error("Choose a FlatWaiver template JSON");
    for (const [, f] of jsons) {
      const raw = JSON.parse(await utf8File(f.local));
      await stage("template", raw, () => template(raw));
    }
  } else {
    const csvs = [...files].filter(([n]) => n.toLowerCase().endsWith(".csv"));
    if (csvs.length > 1) throw new Error("Upload one CSV per import");
    if (job.format === "csv" && !csvs.length)
      throw new Error("Upload a CSV file");
    if (csvs.length) {
      const { headers, rows } = parseCsv(
        await utf8File(csvs[0][1].local),
        options.delimiter,
      );
      if (!Object.values(options.mapping).some(Boolean))
        throw new Error("Map at least one CSV column before preview");
      for (const values of rows)
        await stage(
          "record",
          Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])),
          () => mapCsvRow(headers, values, options.mapping),
        );
    }
    // PDFs without a confident CSV match become explicitly labelled standalone
    // preview rows, rather than being silently associated with a participant.
    for (const [name] of files)
      if (name.toLowerCase().endsWith(".pdf") && !used.has(name))
        await stage("record", { filename: name }, async () => ({
          pdf_filename: name,
          participant_name: options.participant || null,
          original_signed_at: dateTime(options.signedAt),
          field_values: {},
          source_evidence: {},
        }));
  }
  if (batch.length)
    checked(
      await db.rpc("stage_data_import", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_items: batch,
      }),
    );
  const summary = await summarize(db, job);
  summary.unmatchedImages = [...files.keys()].filter(
    (name) => /\.(png|jpe?g)$/i.test(name) && !used.has(name),
  ).length;
  await patchJob(db, job, {
    status: "preview",
    summary,
    total: row,
    progress: row,
    leased_until: null,
    lease_token: null,
    error: null,
  });
}
async function immutableFile(
  db,
  job,
  item,
  file,
  name,
  bucket,
  directory,
  expected,
) {
  if (!file || file.hash !== expected)
    throw new Error("Source document changed after preview");
  const type = await checkDocument(file, name);
  const ext = name.split(".").at(-1).toLowerCase();
  const path = `${job.org_id}/imported/${item.id}.${ext}`;
  try {
    await uploadFile(db, bucket, path, file.local, type);
  } catch (error) {
    // A prior attempt may have uploaded before its database transaction. Only
    // reuse the object if the bytes are identical; never overwrite evidence.
    const existing = await download(db, bucket, path, job.org_id, directory);
    if (existing.hash !== file.hash) throw error;
  }
  return path;
}
async function commitImport(db, job, directory) {
  const files = await readInputs(db, job, directory);
  const restoredTemplates = new Map();
  let batch = [];
  let batchBytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    checked(
      await db.rpc("commit_data_import", {
        p_job: job.id,
        p_lease: job.lease_token,
        p_items: batch,
      }),
    );
    batch = [];
    batchBytes = 0;
    const summary = await summarize(db, job);
    await patchJob(db, job, {
      summary,
      progress: summary.imported + summary.skipped + summary.invalid,
    });
  };
  // Create all template drafts first, then resolve restored record associations
  // through this organization's templates only.
  for (const kind of ["template", "record"]) {
    for await (const item of pages(
      db,
      "data_import_items",
      (q) => q.eq("job_id", job.id).eq("status", "valid").eq("kind", kind),
      "*",
      kind === "template" ? 1 : 50,
    )) {
      const d = item.data;
      try {
        if (item.kind === "record") {
          if (
            job.format === "restore" &&
            d.source_template_id &&
            !d.template_id
          ) {
            if (!restoredTemplates.has(d.source_template_id)) {
              const direct = checked(
                await db
                  .from("waiver_templates")
                  .select("id")
                  .eq("org_id", job.org_id)
                  .eq("id", d.source_template_id)
                  .maybeSingle(),
              );
              const restored =
                direct ??
                checked(
                  await db
                    .from("waiver_templates")
                    .select("id")
                    .eq("org_id", job.org_id)
                    .eq("import_key", `id:${d.source_template_id}`)
                    .maybeSingle(),
                );
              restoredTemplates.set(d.source_template_id, restored?.id ?? null);
            }
            d.template_id = restoredTemplates.get(d.source_template_id);
          }
          if (d.pdf_filename) {
            d.pdf_path = await immutableFile(
              db,
              job,
              item,
              files.get(d.pdf_filename),
              d.pdf_filename,
              "signed-pdfs",
              directory,
              d.expected_pdf_sha256,
            );
            d.pdf_sha256 = d.expected_pdf_sha256;
          }
          if (d.signature_filename) {
            d.signature_path = await immutableFile(
              db,
              job,
              item,
              files.get(d.signature_filename),
              d.signature_filename,
              "signatures",
              directory,
              d.expected_signature_sha256,
            );
            d.signature_sha256 = d.expected_signature_sha256;
          }
        }
        const itemBytes = Buffer.byteLength(JSON.stringify(d));
        if (batch.length && batchBytes + itemBytes > 2 * 1024 ** 2)
          await flush();
        batch.push({ id: item.id, data: d });
        batchBytes += itemBytes;
        if (batch.length === 100) await flush();
      } catch (error) {
        throw new Error(
          `Import interrupted at row ${item.row_number}: ${error.message}`,
        );
      }
    }
    await flush();
  }
  await flush();
  const summary = await summarize(db, job);
  await patchJob(db, job, {
    status: "completed",
    summary,
    progress: job.total,
    completed_at: new Date().toISOString(),
    leased_until: null,
    lease_token: null,
  });
}
function normalizeNative(r, template) {
  return {
    id: r.id,
    record_origin: "native",
    source_provider: "flatwaiver",
    external_id: null,
    template_id: r.template_id,
    waiver_title: template?.name,
    participant_name: r.signer_name,
    participant_email: r.signer_email,
    participant_phone: r.field_values?.phone ?? null,
    date_of_birth: r.signer_dob,
    original_signed_at: r.signed_at,
    created_at: r.created_at,
    field_values: r.field_values,
    pdf_path: r.pdf_path,
    pdf_sha256: r.pdf_sha256,
    signature_path: r.signature_path,
    source_evidence: { native_record: r },
  };
}
async function exportJob(db, job, directory) {
  const options = optionsSchema.parse(job.options);
  const filters = options.filters;
  const templates = new Map();
  for await (const t of pages(
    db,
    "waiver_templates",
    (q) => q.eq("org_id", job.org_id),
    "id,name,status",
  )) {
    if (templates.size >= LIMITS.files)
      throw new Error("Too many templates for one transfer");
    templates.set(t.id, { id: t.id, name: t.name, status: t.status });
  }
  const entries = new Map();
  const fileManifest = [];
  let totalBytes = 0;
  let templateCount = 0,
    count = 0;
  const add = async (name, local, sha) => {
    if (entries.size >= LIMITS.files)
      throw new Error(
        "Archive contains more than 50,000 files. Narrow the date range.",
      );
    const size = (await stat(local)).size;
    totalBytes += size;
    if (totalBytes > LIMITS.expanded)
      throw new Error("Export exceeds 5 GB. Narrow the date range.");
    entries.set(name, local);
    fileManifest.push({
      name,
      sha256: sha ?? (await fileHash(local)),
      size,
    });
  };
  const json = async (name, value) => {
    const local = join(directory, randomUUID());
    const serialized = JSON.stringify(value, null, 2);
    if (
      name.startsWith("templates/") &&
      Buffer.byteLength(serialized) > 2 * 1024 ** 2
    )
      throw new Error("Template package exceeds 2 MB");
    await writeFile(local, serialized);
    await add(name, local);
  };
  if (["templates", "backup"].includes(job.format))
    for (const [id, summary] of templates) {
      if (filters.template && filters.template !== id) continue;
      if (
        filters.templateStatus !== "all" &&
        filters.templateStatus !== summary.status
      )
        continue;
      const t = checked(
        await db
          .from("waiver_templates")
          .select("*")
          .eq("id", id)
          .eq("org_id", job.org_id)
          .single(),
      );
      const history = [];
      let historyBytes = Buffer.byteLength(JSON.stringify(t));
      for await (const version of pages(
        db,
        "template_versions",
        (q) => q.eq("template_id", id),
        "*",
        1,
      )) {
        historyBytes += Buffer.byteLength(JSON.stringify(version));
        if (historyBytes > 2 * 1024 ** 2)
          throw new Error("Template and version history exceed 2 MB");
        history.push(version);
      }
      const v = history.find((v) => v.id === t.current_version_id);
      const content =
        t.draft_content ??
        (v
          ? {
              title: t.name,
              blocks: v.body,
              fields: v.fields,
              consent_text: v.consent_text,
              minor_mode: v.minor_mode,
            }
          : null);
      // An empty shell is preserved in backups; imports correctly flag it for review.
      await json(`templates/${safeFilename(t.name)}-${id}.json`, {
        format: "flatwaiver-template",
        version: 1,
        exported_id: id,
        name: t.name,
        content,
        settings: { expiry_months: t.expiry_months, photo_mode: t.photo_mode },
        source_status: t.status,
        version_history: history,
      });
      templateCount++;
    }
  const recordsFile = join(directory, "records.ndjson");
  const records = await open(recordsFile, "w");
  const custom = new Set();
  let recordBytes = 0;
  try {
    if (job.format !== "templates")
      for (const native of [true, false]) {
        if (
          (filters.origin === "native" && !native) ||
          (filters.origin === "imported" && native)
        )
          continue;
        for await (const raw of pages(
          db,
          native ? "signed_waivers" : "imported_waivers",
          (q) =>
            filterQuery(
              q
                .eq("org_id", job.org_id)
                .lte(native ? "created_at" : "imported_at", job.created_at),
              filters,
              native,
            ),
        )) {
          const t = templates.get(raw.template_id);
          if (
            filters.templateStatus !== "all" &&
            t?.status !== filters.templateStatus
          )
            continue;
          const r = native
            ? normalizeNative(raw, t)
            : {
                ...raw,
                record_origin: "imported",
                source_provider: raw.source_provider,
              };
          if (++count > LIMITS.rows)
            throw new Error(
              "Export exceeds 100,000 records. Narrow the date range.",
            );
          for (const key of Object.keys(r.field_values ?? {})) custom.add(key);
          if (custom.size > LIMITS.columns)
            throw new Error(
              "More than 250 custom fields. Export individual templates.",
            );
          if (["pdfs", "backup"].includes(job.format)) {
            if (r.pdf_path) {
              const file = await download(
                db,
                "signed-pdfs",
                r.pdf_path,
                job.org_id,
                directory,
              );
              if (file.hash !== r.pdf_sha256)
                throw new Error(`Stored PDF checksum mismatch for ${r.id}`);
              r.pdf_filename = `waivers/${safeFilename(r.participant_name || "record")}-${(r.original_signed_at || "undated").slice(0, 10)}-${r.id}.pdf`;
              await add(r.pdf_filename, file.local, file.hash);
            } else if (job.format === "pdfs")
              throw new Error(
                "A selected imported record has no PDF. Select native records or use a full backup with a missing-file manifest.",
              );
            if (job.format === "backup" && r.signature_path) {
              const sig = await download(
                db,
                "signatures",
                r.signature_path,
                job.org_id,
                directory,
              );
              if (r.signature_sha256 && r.signature_sha256 !== sig.hash)
                throw new Error("Stored signature checksum mismatch");
              r.signature_filename = `signatures/${r.id}.${r.signature_path.split(".").at(-1)}`;
              r.signature_sha256 = sig.hash;
              await add(r.signature_filename, sig.local, sig.hash);
            }
          }
          delete r.pdf_path;
          delete r.signature_path;
          const line = JSON.stringify(r) + "\n";
          recordBytes += Buffer.byteLength(line);
          if (recordBytes > LIMITS.metadata)
            throw new Error(
              "Export metadata exceeds 512 MB. Narrow the date range.",
            );
          await records.write(line);
          if (count % 100 === 0) await patchJob(db, job, { progress: count });
        }
      }
  } finally {
    await records.close();
  }
  const csvPath = join(directory, "submissions.csv");
  const csv = await open(csvPath, "w");
  const keys = [...custom].sort();
  let csvBytes = 0;
  try {
    await csv.write(
      "\uFEFF" + csvLine([...CSV_COLUMNS, ...keys.map((k) => `custom:${k}`)]),
    );
    for await (const line of recordLines(recordsFile))
      if (line) {
        const row = csvRecord(JSON.parse(line), keys);
        csvBytes += Buffer.byteLength(row);
        if (csvBytes > LIMITS.metadata)
          throw new Error("CSV export exceeds 512 MB. Narrow the date range.");
        await csv.write(row);
      }
  } finally {
    await csv.close();
  }
  if (job.format === "backup") {
    if (
      (await stat(recordsFile)).size > LIMITS.metadata ||
      (await stat(csvPath)).size > LIMITS.metadata
    )
      throw new Error("Backup metadata exceeds 512 MB. Narrow the date range.");
    await add("submissions.csv", csvPath);
    await add("records.ndjson", recordsFile);
    await json("manifest.json", {
      format: "flatwaiver-backup",
      version: 1,
      exported_at: new Date().toISOString(),
      snapshot_before: job.created_at,
      organization_id: job.org_id,
      submission_count: count,
      template_count: templateCount,
      filters,
      files: fileManifest.slice(),
      note: "Restored records are imported copies; they do not become native FlatWaiver signing evidence.",
    });
  }
  const output = job.format === "csv" ? csvPath : join(directory, "export.zip");
  if (job.format !== "csv") await makeZip(entries, output);
  if (job.format !== "csv" && (await stat(output)).size > LIMITS.zip)
    throw new Error("Archive exceeds 5 GB. Narrow the date range.");
  const name = `flatwaiver-${job.format}-${job.created_at.slice(0, 10)}.${job.format === "csv" ? "csv" : "zip"}`;
  const path = `${job.org_id}/transfers/${job.id}/output/${job.lease_token}/${name}`;
  await uploadFile(
    db,
    "uploads",
    path,
    output,
    job.format === "csv" ? "text/csv; charset=utf-8" : "application/zip",
  );
  await patchJob(db, job, {
    status: "completed",
    output_path: path,
    total: count,
    progress: count,
    summary: { records: count, templates: templateCount },
    completed_at: new Date().toISOString(),
    leased_until: null,
    lease_token: null,
  });
}
export async function cleanupTransfers(db) {
  // Signed upload tokens live for two hours. Let them expire before removing a
  // cancelled prefix, so a late upload cannot recreate an untracked object.
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const jobs = checked(
    await db
      .from("data_jobs")
      .select("id,org_id")
      .lt("expires_at", cutoff)
      .neq("status", "expired")
      .limit(50),
  );
  // Also process cancelled jobs; expired status is retained as history, while a
  // summary flag prevents repeatedly listing an already-cleaned prefix.
  const cancelled = checked(
    await db
      .from("data_jobs")
      .select("id,org_id")
      .eq("status", "expired")
      .lt("expires_at", cutoff)
      .is("output_path", null)
      .limit(50),
  );
  // A previous cleanup can fail after fencing a completed export. Its output
  // path is still populated, so it must remain eligible until marked cleaned.
  const interrupted = checked(
    await db
      .from("data_jobs")
      .select("id,org_id")
      .eq("status", "expired")
      .lt("expires_at", cutoff)
      .neq("output_path", "cleaned")
      .limit(50),
  );
  for (const job of [...jobs, ...cancelled, ...interrupted]) {
    if (!checked(await db.rpc("begin_data_cleanup", { p_job: job.id })))
      continue;
    const prefix = `${job.org_id}/transfers/${job.id}`;
    const removeTree = async (path) => {
      for (;;) {
        checkTransfer();
        const rows = checked(
          await db.storage.from("uploads").list(path, { limit: 100 }),
        );
        if (!rows.length) break;
        for (const row of rows) {
          const child = `${path}/${row.name}`;
          if (row.id) checked(await db.storage.from("uploads").remove([child]));
          else await removeTree(child);
        }
      }
    };
    await removeTree(prefix);
    // Remove only uncommitted evidence left by interrupted/duplicate attempts.
    // Any object referenced by an immutable imported record is retained.
    for await (const item of pages(db, "data_import_items", (q) =>
      q.eq("job_id", job.id).eq("kind", "record"),
    )) {
      const exists = checked(
        await db
          .from("imported_waivers")
          .select("id")
          .eq("id", item.id)
          .eq("org_id", job.org_id)
          .maybeSingle(),
      );
      if (exists) continue;
      for (const [key, bucket] of [
        ["pdf_filename", "signed-pdfs"],
        ["signature_filename", "signatures"],
      ]) {
        const filename = item.data[key];
        if (!filename) continue;
        const ext = filename.split(".").at(-1).toLowerCase();
        if (["pdf", "png", "jpg", "jpeg"].includes(ext))
          checked(
            await db.storage
              .from(bucket)
              .remove([`${job.org_id}/imported/${item.id}.${ext}`]),
          );
      }
    }
    checked(await db.from("data_job_files").delete().eq("job_id", job.id));
    checked(await db.from("data_import_items").delete().eq("job_id", job.id));
    checked(
      await db
        .from("data_jobs")
        .update({ status: "expired", output_path: "cleaned" })
        .eq("id", job.id),
    );
  }
}
export async function processNextTransfer(
  db,
  { signal, timeoutMs = JOB_TIMEOUT_MS, heartbeatMs = 30000 } = {},
) {
  signal?.throwIfAborted();
  checked(await db.rpc("recover_data_jobs"));
  const jobs = checked(await db.rpc("claim_data_job"));
  const job = jobs?.[0];
  if (!job) return false;
  let base;
  const lost = new AbortController();
  const executionSignal = AbortSignal.any(
    [
      signal,
      lost.signal,
      AbortSignal.timeout(
        Math.max(
          1,
          Math.min(timeoutMs, Date.parse(job.expires_at) - Date.now()),
        ),
      ),
    ].filter(Boolean),
  );
  let renewing = false;
  const heartbeat = setInterval(async () => {
    if (renewing || executionSignal.aborted) return;
    renewing = true;
    try {
      await withTransferSignal(executionSignal, () =>
        patchJob(db, job, {
          leased_until: new Date(Date.now() + 120000).toISOString(),
        }),
      );
    } catch (error) {
      lost.abort(error);
    } finally {
      renewing = false;
    }
  }, heartbeatMs);
  try {
    await withTransferSignal(executionSignal, async () => {
      checkTransfer();
      base = await mkdtemp(join(tmpdir(), "flatwaiver-transfer-"));
      const owner = checked(
        await db
          .from("profiles")
          .select("id")
          .eq("id", job.user_id)
          .eq("org_id", job.org_id)
          .eq("role", "owner")
          .maybeSingle(),
      );
      if (!owner) throw new Error("Account owner access changed");
      if (job.direction === "export") await exportJob(db, job, base);
      else if (job.confirmed_at) await commitImport(db, job, base);
      else await prepareImport(db, job, base);
    });
  } catch (error) {
    console.error("Data transfer failed", job.id, error.message);
    try {
      await patchJob(db, job, {
        status: "failed",
        error: String(error.message).slice(0, 400),
        leased_until: null,
        lease_token: null,
      });
    } catch {
      console.error(
        "Could not mark transfer failed; its lease will expire",
        job.id,
      );
    }
  } finally {
    clearInterval(heartbeat);
    // Only delete the exact generated directory under the OS temporary root.
    const root = resolve(tmpdir()) + sep;
    const target = base ? resolve(base) : "";
    if (
      target.startsWith(root) &&
      target.slice(root.length).startsWith("flatwaiver-transfer-")
    )
      await rm(target, { recursive: true, force: true });
  }
  return true;
}
