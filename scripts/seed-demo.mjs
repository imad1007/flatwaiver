/**
 * Dev-only demo seed.
 *
 * Creates a SEPARATE demo account (never touches your own org):
 *   - login:  demo@flatwaiver.dev / FlatWaiverDemo1!
 *   - org:    "Summit Adventure Park" with active subscription
 *   - ~10 published waiver templates across verticals (some with flag config)
 *   - ~250 signed waivers over the last 10 weeks: varied names, dates,
 *     channels, minors with guardians, and a realistic share of flagged rows
 *
 * Guardrails:
 *   - Refuses to run unless ALLOW_DEV_SEED=true is set in .env.local
 *   - Refuses to run when NODE_ENV=production
 *   - Aborts if the demo user already exists (append-only tables can't be
 *     cleanly re-seeded; wipe the demo org manually if you need a fresh run)
 *
 * Run with: npm run seed:demo
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
      "This seed writes ~250 rows to append-only tables — dev projects only."
  );
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\nSeeding demo data into ${env.NEXT_PUBLIC_SUPABASE_URL}\n`);

// ── Helpers ──────────────────────────────────────────────────────────────────

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

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
const contentSha256 = (body, fields, consentText) =>
  sha256(canonicalJson({ body, fields, consent_text: consentText }));

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

/** Minimal, valid single-page PDF with correct xref offsets. */
function makeSeedPdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => "\\" + c);
  let content = "BT /F1 14 Tf 72 720 Td";
  for (const [i, line] of lines.entries()) {
    content += `${i > 0 ? " 0 -22 Td" : ""} (${esc(line)}) Tj`;
  }
  content += " ET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

// 1x1 transparent PNG
const SIGNATURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const DEFAULT_CONSENT =
  "I agree to sign this document electronically and I acknowledge that my electronic signature is legally binding, per the ESIGN Act and UETA.";

// ── Demo content ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Maya", "Liam", "Sofia", "Noah", "Ava", "Ethan", "Isabella", "Mason", "Mia",
  "Lucas", "Amelia", "Oliver", "Harper", "Elijah", "Evelyn", "James", "Luna",
  "Ben", "Camila", "Alex", "Gianna", "Daniel", "Aria", "Henry", "Chloe",
  "Jackson", "Penelope", "Sebastian", "Layla", "Aiden", "Riley", "Matteo",
  "Zoey", "Sam", "Nora", "David", "Lily", "Joseph", "Eleanor", "Carter",
  "Hannah", "Owen", "Priya", "Wyatt", "Fatima", "John", "Keiko", "Luke",
  "Ingrid", "Diego",
];
const LAST_NAMES = [
  "Rodriguez", "Chen", "Smith", "Johnson", "Patel", "Williams", "Brown",
  "Garcia", "Kim", "Davis", "Martinez", "Nguyen", "Miller", "Lopez", "Wilson",
  "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Lee", "Perez", "White",
  "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "Hall", "Ali",
  "Wright", "Torres", "Hill", "Green", "Adams", "Nelson", "Baker", "Rivera",
  "Campbell", "Mitchell", "Carter", "Okafor", "Silva", "Kowalski",
];
const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "proton.me"];
const USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15",
  "Mozilla/5.0 (iPad; CPU OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
];

const para = (text) => ({ type: "paragraph", text });
const heading = (text) => ({ type: "heading", text });

function standardBlocks(activity, extras = []) {
  return [
    heading("RELEASE AND WAIVER OF LIABILITY"),
    para(
      `In consideration of being permitted to participate in ${activity}, I hereby release, waive, and discharge the operator, its owners, employees, and agents from any and all liability, claims, and causes of action arising out of or related to any loss or injury that may be sustained during participation. (Demo seed text.)`
    ),
    heading("ASSUMPTION OF RISK"),
    para(
      `I understand that ${activity} involves inherent risks, including serious injury. I knowingly and freely assume all such risks, both known and unknown, and accept full responsibility for my participation. (Demo seed text.)`
    ),
    ...extras,
  ];
}

const emailField = { key: "signer_email", type: "email", label: "Email", required: true };
const phoneField = { key: "phone", type: "phone", label: "Phone number", required: false };
const dobField = { key: "date_of_birth", type: "date_of_birth", label: "Date of birth", required: true };
const rulesCheckbox = (label) => ({ key: "rules_ack", type: "checkbox", label, required: true });
const medicalSelect = {
  key: "medical_condition",
  type: "select",
  label: "Do you have a medical condition we should know about?",
  required: true,
  options: ["No", "Yes"],
  flag_values: ["Yes"],
};

const TEMPLATES = [
  { name: "Adult Climbing Waiver", slug: "demo-climbing", activity: "rock climbing and bouldering", fields: [emailField, dobField, medicalSelect, rulesCheckbox("I have read the climbing safety rules")], minors: true, volume: 42, flagRate: 0.09 },
  { name: "Trampoline Park Waiver", slug: "demo-trampoline", activity: "trampoline park activities", fields: [emailField, dobField, phoneField, medicalSelect], minors: true, volume: 55, flagRate: 0.07, minorRate: 0.35 },
  { name: "Gym Membership Waiver", slug: "demo-gym", activity: "fitness training and gym use", fields: [emailField, phoneField, medicalSelect], minors: false, volume: 30, flagRate: 0.1 },
  { name: "Martial Arts Class Waiver", slug: "demo-martial-arts", activity: "martial arts instruction and sparring", fields: [emailField, dobField, medicalSelect], minors: true, volume: 22, flagRate: 0.08, minorRate: 0.3 },
  { name: "Kayak Tour Waiver", slug: "demo-kayak", activity: "guided kayak tours", fields: [emailField, dobField, { key: "swim_ability", type: "select", label: "Can you swim 50 meters unassisted?", required: true, options: ["Yes", "No"], flag_values: ["No"] }], minors: true, volume: 25, flagRate: 0.12 },
  { name: "Escape Room Waiver", slug: "demo-escape-room", activity: "escape room experiences", fields: [emailField], minors: true, volume: 20, flagRate: 0 },
  { name: "Shooting Range Waiver", slug: "demo-range", activity: "supervised firearm range use", fields: [emailField, dobField, { key: "experience", type: "select", label: "Firearm experience level", required: true, options: ["First time", "Some experience", "Experienced"], flag_values: ["First time"] }, rulesCheckbox("I have read and understood the range safety briefing")], minors: false, volume: 18, flagRate: 0.25 },
  { name: "Bike Rental Agreement", slug: "demo-bike-rental", activity: "bicycle and e-bike rental", fields: [emailField, phoneField, rulesCheckbox("I agree to return the equipment in the condition received")], minors: false, volume: 16, flagRate: 0 },
  { name: "Yoga Studio Waiver", slug: "demo-yoga", activity: "yoga and mobility classes", fields: [emailField, medicalSelect], minors: false, volume: 12, flagRate: 0.06 },
  { name: "Zipline Adventure Waiver", slug: "demo-zipline", activity: "zipline and aerial adventure courses", fields: [emailField, dobField, phoneField, medicalSelect], minors: true, volume: 14, flagRate: 0.08 },
];

// ── Main ─────────────────────────────────────────────────────────────────────

const DEMO_EMAIL = "demo@flatwaiver.dev";
const DEMO_PASSWORD = "FlatWaiverDemo1!";

async function main() {
  // Abort if already seeded
  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers();
  if (listError) fail(`Could not list users: ${listError.message}`);
  if (usersPage.users.some((u) => u.email === DEMO_EMAIL)) {
    fail(
      `Demo user ${DEMO_EMAIL} already exists — seed appears to have run before.\n` +
        "  signed_waivers is append-only, so re-seeding would duplicate data.\n" +
        "  To re-seed: delete the demo org's rows manually (see README runbook note)."
    );
  }

  // 1. Demo user + org + subscription
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (userError) fail(`createUser: ${userError.message}`);
  const userId = created.user.id;

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: "Summit Adventure Park", waiver_volume_band: "1000+", branding: { color: "#0891B2" } })
    .select("id")
    .single();
  if (orgError) fail(`organizations insert: ${orgError.message}`);
  const orgId = org.id;

  await must(admin.from("profiles").insert({ id: userId, org_id: orgId, email: DEMO_EMAIL, role: "owner" }), "profiles insert");
  await must(
    admin.from("subscriptions").insert({
      org_id: orgId,
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
    }),
    "subscriptions insert"
  );
  console.log(`✓ Demo user + org created (${orgId})`);

  // 2. Shared storage artifacts (visibly demo, clearly not real evidence)
  const pdfBytes = makeSeedPdf([
    "FLATWAIVER — DEMO SEED DOCUMENT",
    "This file was generated by the dev seed script.",
    "It is NOT a real signed waiver and carries no evidence value.",
  ]);
  const pdfPath = `${orgId}/seed/demo-signed.pdf`;
  const sigPath = `${orgId}/seed/demo-signature.png`;
  await must(
    admin.storage.from("signed-pdfs").upload(pdfPath, pdfBytes, { contentType: "application/pdf" }),
    "seed PDF upload"
  );
  await must(
    admin.storage.from("signatures").upload(sigPath, SIGNATURE_PNG, { contentType: "image/png" }),
    "seed signature upload"
  );
  const pdfHash = sha256(pdfBytes);
  console.log("✓ Placeholder artifacts uploaded (PDF labeled as demo seed)");

  // 3. Templates + published versions
  const templateRows = [];
  for (const t of TEMPLATES) {
    const blocks = standardBlocks(t.activity);
    const { data: tpl } = await must(
      admin
        .from("waiver_templates")
        .insert({ org_id: orgId, slug: t.slug, name: t.name, status: "draft", draft_content: { title: t.name, blocks, fields: t.fields, consent_text: DEFAULT_CONSENT, minor_mode: t.minors ? "allowed" : "disallowed" } })
        .select("id")
        .single(),
      `template ${t.slug}`
    );
    const { data: version } = await must(
      admin
        .from("template_versions")
        .insert({
          template_id: tpl.id,
          version_number: 1,
          body: blocks,
          fields: t.fields,
          consent_text: DEFAULT_CONSENT,
          minor_mode: t.minors ? "allowed" : "disallowed",
          content_sha256: contentSha256(blocks, t.fields, DEFAULT_CONSENT),
        })
        .select("id")
        .single(),
      `version ${t.slug}`
    );
    await must(
      admin.from("waiver_templates").update({ status: "published", current_version_id: version.id }).eq("id", tpl.id),
      `publish ${t.slug}`
    );
    templateRows.push({ ...t, id: tpl.id, versionId: version.id });
  }
  console.log(`✓ ${templateRows.length} templates published`);

  // 4. Signed waivers
  const rows = [];
  for (const t of templateRows) {
    for (let i = 0; i < t.volume; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const name = `${first} ${last}`;
      const email = chance(0.82)
        ? `${first.toLowerCase()}.${last.toLowerCase()}${rand(1, 99)}@${pick(EMAIL_DOMAINS)}`
        : null;

      // Recent-biased date in the last 70 days, business hours
      const daysAgo = Math.floor(70 * Math.pow(Math.random(), 1.5));
      const signedAt = new Date();
      signedAt.setUTCDate(signedAt.getUTCDate() - daysAgo);
      signedAt.setUTCHours(rand(9, 20), rand(0, 59), rand(0, 59), 0);

      const isMinor = t.minors && chance(t.minorRate ?? 0.12);
      const flagged = t.flagRate > 0 && chance(t.flagRate);

      const fieldValues = {};
      for (const f of t.fields) {
        if (f.type === "email") fieldValues[f.key] = email ?? `${first.toLowerCase()}@${pick(EMAIL_DOMAINS)}`;
        else if (f.type === "phone") { if (chance(0.7)) fieldValues[f.key] = `+1 ${rand(201, 989)} 555 ${String(rand(0, 9999)).padStart(4, "0")}`; }
        else if (f.type === "date_of_birth") {
          const age = isMinor ? rand(8, 17) : rand(18, 67);
          fieldValues[f.key] = `${signedAt.getUTCFullYear() - age}-${String(rand(1, 12)).padStart(2, "0")}-${String(rand(1, 28)).padStart(2, "0")}`;
        } else if (f.type === "checkbox") fieldValues[f.key] = true;
        else if (f.type === "select") {
          const flagVals = f.flag_values ?? [];
          const safe = f.options.filter((o) => !flagVals.includes(o));
          fieldValues[f.key] = flagged && flagVals.length ? pick(flagVals) : pick(safe.length ? safe : f.options);
        }
      }
      // A row only counts as flagged if a flaggable field actually matched
      const actuallyFlagged = t.fields.some(
        (f) => (f.flag_values ?? []).includes(String(fieldValues[f.key] === true ? "yes" : fieldValues[f.key] ?? ""))
      );

      rows.push({
        org_id: orgId,
        template_id: t.id,
        template_version_id: t.versionId,
        signer_name: name,
        signer_email: email,
        signer_dob: fieldValues.date_of_birth ?? null,
        is_minor: isMinor,
        guardian_name: isMinor ? `${pick(FIRST_NAMES)} ${last}` : null,
        guardian_relationship: isMinor ? pick(["Parent", "Parent", "Legal guardian"]) : null,
        field_values: fieldValues,
        signature_path: sigPath,
        guardian_signature_path: isMinor ? sigPath : null,
        pdf_path: pdfPath,
        pdf_sha256: pdfHash,
        consent_given: true,
        consent_text_snapshot: DEFAULT_CONSENT,
        flagged: actuallyFlagged,
        signed_at: signedAt.toISOString(),
        ip: `${rand(11, 220)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`,
        user_agent: pick(USER_AGENTS),
        signing_channel: Math.random() < 0.45 ? "link" : Math.random() < 0.6 ? "qr" : "kiosk",
      });
    }
  }

  for (let i = 0; i < rows.length; i += 50) {
    await must(admin.from("signed_waivers").insert(rows.slice(i, i + 50)), `signed_waivers batch ${i / 50 + 1}`);
  }
  const flaggedCount = rows.filter((r) => r.flagged).length;
  const minorCount = rows.filter((r) => r.is_minor).length;
  console.log(`✓ ${rows.length} signed waivers inserted (${flaggedCount} flagged, ${minorCount} minors)`);

  console.log(`
Done. Log in as the demo account to see a lived-in workspace:

  email:    ${DEMO_EMAIL}
  password: ${DEMO_PASSWORD}

Your own account is untouched — use it to see the empty states.
`);
}

async function must(promise, label) {
  const result = await promise;
  if (result.error) fail(`${label}: ${result.error.message}`);
  return result;
}

main().catch((e) => fail(e?.message ?? String(e)));
