import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { signerPhone, phoneCsvText, csvEscape } from "../src/lib/csv.ts";
import { csvRecord, parseCsv } from "../src/lib/data-transfer-core.mjs";
import { normalizeNative } from "./lib/data-transfer-worker.mjs";

const fields = [{ key: "answer_7", type: "phone", label: "Mobile" }];
assert.equal(signerPhone({ answer_7: "0412 345 678" }, fields), "0412 345 678");
const native = normalizeNative({ field_values: { answer_7: "0412 345 678" }, template_versions: { fields } }, { name: "Waiver" });
assert.equal(native.participant_phone, "0412 345 678");
assert.equal(native.source_evidence.native_record.template_versions, undefined);
for (const key of ["phone", "mobile", "phone_number", "mobile_number"]) {
  assert.equal(signerPhone({ [key]: "+61 (412) 345-678" }), "+61 (412) 345-678");
}
assert.equal(signerPhone(null), "");
assert.equal(signerPhone({ emergency_phone: "999" }, [{ key: "emergency_phone", type: "phone" }]), "");
assert.equal(signerPhone({ phone: "111", mobile: "222" }), "111");
assert.equal(signerPhone({ phone: "", mobile: "0222" }), "0222");
assert.equal(csvEscape(phoneCsvText('0,"test"\n')), '"\'0,""test""\n"');

// Execute the real route with a deterministic database double (no credentials).
const rows = Array.from({ length: 503 }, (_, i) => ({
  id: String(i), signer_name: "Signer", signer_email: "test@example.test",
  template_id: "t", template_version_id: "v", signed_at: "2026-10-01T12:00:00Z",
  signing_channel: "web", pdf_sha256: "hash",
  field_values: i === 0 ? { answer_7: "0412 345 678" } : i === 1 ? { mobile: "+61 (412) 345-678" } : {},
}));
const calls = [];
globalThis.__phoneExportDb = {
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  from(table) {
    let columns;
    const query = {
      select(value) { columns = value; calls.push([table, "select", value]); return this; },
      order() { return this; },
      range(start, end) { this.start = start; this.end = end; return this; },
      then(resolve) {
        if (table === "signed_waivers") assert.match(columns, /field_values/);
        if (table === "template_versions") assert.match(columns, /fields/);
        const data = table === "signed_waivers" ? rows : table === "template_versions"
          ? [{ id: "v", version_number: 1, fields }] : [{ id: "t", name: "Waiver" }];
        resolve({ data: data.slice(this.start, this.end + 1), error: null });
      },
    };
    for (const method of ["ilike", "gte", "lte", "eq"]) query[method] = function (...args) {
      calls.push([table, method, ...args]); return this;
    };
    return query;
  },
};
globalThis.__phoneExportHelpers = { signerPhone, phoneCsvText, csvEscape };
const source = readFileSync(new URL("../src/app/api/signatures/export/route.ts", import.meta.url), "utf8")
  .replace(/import .* from "@\/lib\/supabase\/server";/, "const createClient = async () => globalThis.__phoneExportDb;")
  .replace(/import .* from "next\/server";/, "const NextResponse = Response;")
  .replace(/import .* from "@\/lib\/csv";/, "const { signerPhone, phoneCsvText, csvEscape } = globalThis.__phoneExportHelpers;");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const response = await GET(new Request("https://example.test/api/signatures/export?q=Signer&email=test&from=2026-10-01&to=2026-10-02&template=t&flagged=1"));
const parsed = parseCsv(await response.text());
assert.equal(parsed.rows.length, 503);
assert.equal(parsed.headers.at(-1), "Phone Number");
assert.equal(parsed.headers.length, 17);
assert.equal(parsed.rows[0].at(-1), "'0412 345 678");
assert.equal(parsed.rows[1].at(-1), "'+61 (412) 345-678");
assert.equal(parsed.rows[2].at(-1), "");
for (const column of ["signer_name", "signer_email", "signed_at", "template_id", "flagged"])
  assert.ok(calls.some((call) => call[2] === column), `Missing filter ${column}`);
for (const phone of ["0412345678", "+61 (412) 345-678", ""]) {
  const record = csvRecord({ participant_phone: phone, record_origin: "imported" }, []);
  assert.equal(parseCsv("a,b,c,d,e,phone,g,h,i,j,k,l,m,n,o,p,q,r,s\r\n" + record).rows[0][5], phone ? `'${phone}` : "");
}
delete globalThis.__phoneExportDb;
delete globalThis.__phoneExportHelpers;
console.log("Phone export checks passed: aliases, custom fields, missing values, escaping, filters, 503-row pagination, imported records.");
