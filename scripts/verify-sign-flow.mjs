/**
 * Dev-only end-to-end check of the public signing data path.
 *
 * Part A — round-trip integrity: submits a real signature through
 * POST /api/sign/<slug> and asserts the values survived every stage:
 *   1. the append-only signed_waivers row (field_values + flagged)
 *   2. the stored signed PDF (labels and answers rendered)
 *   3. the SHA-256 audit hash (recomputed over the stored bytes == pdf_sha256,
 *      with the answers inside those hashed bytes)
 *
 * Part B — medical-condition conditional (three states):
 *   - "No" + no detail        → accepted; record/hash/PDF correct
 *   - "Yes" + empty detail    → rejected server-side (simulates client bypass)
 *   - "Yes" + detail filled   → accepted; detail persisted, hashed, in PDF
 *
 * Setup: if the target waiver's current version lacks the medical detail
 * field, a NEW version is published with it appended (append-only — existing
 * versions and signed rows are never touched).
 *
 * Guardrails (same as seed-demo):
 *   - Refuses to run unless ALLOW_DEV_SEED=true in .env.local
 *   - Refuses to run when NODE_ENV=production
 *   - Each run appends TWO rows to the demo org's signed_waivers (append-only,
 *     cannot be deleted) — dev projects only.
 *
 * Requirements: `npm run seed:demo` has been run (uses the demo-gym waiver)
 * and `npm run dev` is up (default http://localhost:3000, override BASE_URL).
 *
 * Run with: npm run verify:sign-flow
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ── Env loading + gates ──────────────────────────────────────────────────────

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...parseEnvFile(join(root, ".env.local")), ...process.env };

function parseEnvFile(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].trim();
  }
  return out;
}

if (process.env.NODE_ENV === "production") {
  fail("Refusing to run: NODE_ENV is production.");
}
if (env.ALLOW_DEV_SEED !== "true") {
  fail(
    "Refusing to run: set ALLOW_DEV_SEED=true in .env.local first.\n" +
      "  Each run appends rows to the append-only signed_waivers table."
  );
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const BASE_URL = (env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SLUG = env.VERIFY_SLUG ?? "demo-gym";
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const sbHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

// Must match src/lib/types.ts (MEDICAL_CONDITION_KEY / MEDICAL_CONDITION_DETAIL_KEY).
const MEDICAL_KEY = "medical_condition";
const MEDICAL_DETAIL_KEY = "medical_condition_detail";
const MEDICAL_DETAIL_FIELD = {
  key: MEDICAL_DETAIL_KEY,
  type: "multiline",
  label: "Please describe the medical condition",
  required: false, // the conditional rule enforces it when the answer is yes
};

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}
function assert(ok, passMsg, failMsg) {
  if (!ok) fail(failMsg);
  console.log(`✓ ${passMsg}`);
}

// ── Setup: ensure the waiver pairs the medical field with a detail field ────

const [template] = await sbGet(
  `waiver_templates?select=id,slug,current_version_id&slug=eq.${SLUG}&status=eq.published`
);
if (!template) fail(`No published template "${SLUG}" — run \`npm run seed:demo\` first.`);

let [version] = await sbGet(
  `template_versions?select=id,version_number,body,fields,consent_text,minor_mode&id=eq.${template.current_version_id}`
);
if (!version) fail("Current template version not found.");

if (!version.fields.some((f) => f.key === MEDICAL_DETAIL_KEY)) {
  if (!version.fields.some((f) => f.key === MEDICAL_KEY)) {
    fail(`"${SLUG}" has no ${MEDICAL_KEY} field — pick a waiver that has one (VERIFY_SLUG).`);
  }
  const fields = [...version.fields, MEDICAL_DETAIL_FIELD];
  const [newVersion] = await sbPost("template_versions", {
    template_id: template.id,
    version_number: version.version_number + 1,
    body: version.body,
    fields,
    consent_text: version.consent_text,
    minor_mode: version.minor_mode,
    content_sha256: contentSha256(version.body, fields, version.consent_text),
  });
  await sbPatch(`waiver_templates?id=eq.${template.id}`, {
    current_version_id: newVersion.id,
    updated_at: new Date().toISOString(),
  });
  console.log(
    `✓ Published v${newVersion.version_number} of "${SLUG}" with the medical detail field (append-only)`
  );
  version = newVersion;
}

// ── Shared submission plumbing ───────────────────────────────────────────────

// 1x1 white PNG — passes the server's magic-byte check.
const SIGNATURE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const runId = Date.now();

async function submit(name, fieldValues) {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/sign/${SLUG}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnstileToken: "dev-dummy-token",
        signerName: name,
        isMinor: false,
        fieldValues,
        signatureDataUrl: SIGNATURE_PNG,
        consentGiven: true,
        channel: "link",
      }),
    });
  } catch {
    fail(`Could not reach ${BASE_URL} — is \`npm run dev\` running?`);
  }
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function fetchRecord(signerName) {
  const [row] = await sbGet(
    `signed_waivers?select=id,field_values,flagged,pdf_path,pdf_sha256` +
      `&signer_name=eq.${encodeURIComponent(signerName)}`
  );
  if (!row) fail(`No signed_waivers row found for "${signerName}".`);
  const pdfRes = await fetch(`${SB}/storage/v1/object/signed-pdfs/${row.pdf_path}`, {
    headers: sbHeaders,
  });
  if (!pdfRes.ok) fail(`Could not download stored PDF (${pdfRes.status}).`);
  const pdf = Buffer.from(await pdfRes.arrayBuffer());
  return { row, pdf, pdfText: extractPdfText(pdf) };
}

// ── State 1 — "No", detail empty → accepted, record/hash/PDF correct ────────

console.log(`\n— State 1: "No" + no detail (${SLUG} via ${BASE_URL}) —`);
const noName = `SignFlow No ${runId}`;
const phoneSentinel = `555-${String(runId).slice(-7)}`;
const res1 = await submit(noName, {
  signer_email: "sign-flow-check@example.com",
  phone: phoneSentinel,
  [MEDICAL_KEY]: "No",
});
assert(res1.status === 200, "accepted (200)", `expected 200, got ${res1.status}: ${JSON.stringify(res1.body)}`);

const s1 = await fetchRecord(noName);
assert(
  s1.row.field_values[MEDICAL_KEY] === "No" && !(MEDICAL_DETAIL_KEY in s1.row.field_values),
  'row stores medical_condition="No" with no detail key (legitimately empty ≠ dropped)',
  `unexpected field_values: ${JSON.stringify(s1.row.field_values)}`
);
assert(s1.row.flagged === false, 'row not flagged for "No"', "row wrongly flagged");
assert(
  sha256(s1.pdf) === s1.row.pdf_sha256,
  "stored PDF hash matches pdf_sha256 audit column",
  "hash mismatch on state-1 PDF"
);
assert(
  /medical condition[^]{0,60}?No/.test(s1.pdfText) && s1.pdfText.includes(phoneSentinel),
  'PDF renders the "No" answer and the phone sentinel inside the hashed bytes',
  "state-1 PDF text missing expected content"
);

// ── State 2 — "Yes", detail empty → rejected server-side (client bypassed) ──

console.log('\n— State 2: "Yes" + empty detail, direct API call (client bypassed) —');
const res2 = await submit(`SignFlow Bypass ${runId}`, {
  signer_email: "sign-flow-check@example.com",
  [MEDICAL_KEY]: "Yes",
});
assert(
  res2.status === 400,
  "rejected with 400 despite bypassing the client form",
  `expected 400, got ${res2.status}: ${JSON.stringify(res2.body)}`
);
assert(
  typeof res2.body?.error === "string" && res2.body.error.toLowerCase().includes("required"),
  `clear validation error returned: "${res2.body?.error}"`,
  `error message unclear: ${JSON.stringify(res2.body)}`
);
const ghost = await sbGet(
  `signed_waivers?select=id&signer_name=eq.${encodeURIComponent(`SignFlow Bypass ${runId}`)}`
);
assert(ghost.length === 0, "no row was written for the rejected submission", "rejected submission still wrote a row");

// ── State 3 — "Yes" + detail filled → full Part A round-trip ────────────────

console.log('\n— State 3: "Yes" + detail filled (Part A round-trip) —');
const yesName = `SignFlow Yes ${runId}`;
const detailSentinel = `Asthma, inhaler in bag (check ${runId})`;
const res3 = await submit(yesName, {
  signer_email: "sign-flow-check@example.com",
  phone: phoneSentinel,
  [MEDICAL_KEY]: "Yes",
  [MEDICAL_DETAIL_KEY]: detailSentinel,
});
assert(res3.status === 200, "accepted (200)", `expected 200, got ${res3.status}: ${JSON.stringify(res3.body)}`);

const s3 = await fetchRecord(yesName);
assert(
  s3.row.field_values[MEDICAL_KEY] === "Yes" &&
    s3.row.field_values[MEDICAL_DETAIL_KEY] === detailSentinel,
  "row persists the answer and the exact detail text",
  `unexpected field_values: ${JSON.stringify(s3.row.field_values)}`
);
assert(s3.row.flagged === true, 'row flagged ("Yes" matches flag config)', "row not flagged");
assert(
  sha256(s3.pdf) === s3.row.pdf_sha256,
  "stored PDF hash matches pdf_sha256 audit column",
  "hash mismatch on state-3 PDF"
);
assert(
  s3.pdfText.includes("medical condition") &&
    /medical condition[^]{0,60}?Yes/.test(s3.pdfText),
  'PDF renders the medical label and "Yes" answer',
  "state-3 PDF missing the medical answer"
);
assert(
  s3.pdfText.includes(detailSentinel),
  "PDF renders the detail text — covered by the audit hash",
  "detail sentinel not found in state-3 PDF text"
);

console.log(
  `\n✓ All checks passed — Part A round-trip intact and the medical conditional` +
    `\n  enforces yes→detail on the server. (test rows ${s1.row.id}, ${s3.row.id})`
);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sbGet(pathAndQuery) {
  const res = await fetch(`${SB}/rest/v1/${pathAndQuery}`, { headers: sbHeaders });
  if (!res.ok) fail(`Supabase GET ${pathAndQuery} → ${res.status}`);
  return res.json();
}
async function sbPost(table, body) {
  const res = await fetch(`${SB}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Supabase POST ${table} → ${res.status}: ${await res.text()}`);
  return res.json();
}
async function sbPatch(pathAndQuery, body) {
  const res = await fetch(`${SB}/rest/v1/${pathAndQuery}`, {
    method: "PATCH",
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Supabase PATCH ${pathAndQuery} → ${res.status}: ${await res.text()}`);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// Same canonicalization as src/lib/canonical.ts (and seed-demo.mjs).
function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortValue(value[key]);
    return sorted;
  }
  return value;
}
function contentSha256(body, fields, consentText) {
  return sha256(canonicalJson({ body, fields, consent_text: consentText }));
}

/**
 * Minimal text extraction for @react-pdf output: inflate FlateDecode streams
 * and decode the hex glyph runs (<48656c6c6f>) in document order. Good enough
 * to assert a substring is present; not a general PDF text extractor.
 */
function extractPdfText(buf) {
  let text = "";
  let i = 0;
  while ((i = buf.indexOf("stream", i)) !== -1) {
    let s = i + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const e = buf.indexOf("endstream", s);
    if (e === -1) break;
    try {
      const inflated = inflateSync(buf.subarray(s, e)).toString("latin1");
      for (const m of inflated.matchAll(/<([0-9a-fA-F]+)>/g)) {
        const hex = m[1];
        for (let j = 0; j + 1 < hex.length; j += 2) {
          text += String.fromCharCode(parseInt(hex.slice(j, j + 2), 16));
        }
      }
    } catch {
      // non-Flate or non-text stream — skip
    }
    i = e + 9;
  }
  return text;
}
