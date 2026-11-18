import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { signerPhone, phoneCsvText, csvEscape } from "../src/lib/csv.ts";
import { csvRecord, parseCsv } from "../src/lib/data-transfer-core.mjs";
import { normalizeNative } from "./lib/data-transfer-worker.mjs";
import { testDatabase } from "./lib/data-transfer-test-db.mjs";

const fields = [{ key: "answer_7", type: "phone", label: "Mobile" }];
assert.equal(signerPhone({ answer_7: "0412 345 678" }, fields), "0412 345 678");
const native = normalizeNative({ field_values: { answer_7: "0412 345 678" } }, { name: "Waiver" }, fields);
assert.equal(native.participant_phone, "0412 345 678");
assert.equal(native.source_evidence.native_record.template_versions, undefined);
for (const key of ["phone", "mobile", "phone_number", "mobile_number", "mobile_phone", "contact_mobile"]) {
  assert.equal(signerPhone({ [key]: "+61 (412) 345-678" }), "+61 (412) 345-678");
}
for (const label of ["Mobile phone (optional)", "Your mobile no.", "Contact number", "Téléphone", "Teléfono"]) {
  assert.equal(signerPhone({ answer_7: "0412 345 678" }, [{ key: "answer_7", type: "text", label }]), "0412 345 678");
}
assert.equal(signerPhone(null), "");
assert.equal(signerPhone({ emergency_phone: "999" }, [{ key: "emergency_phone", type: "phone" }]), "");
assert.equal(signerPhone({ answer_7: "999" }, [{ key: "answer_7", type: "phone", label: "Emergency contact" }]), "");
assert.equal(signerPhone({ phone: "111", mobile: "222" }), "111");
assert.equal(signerPhone({ phone: "", mobile: "0222" }), "0222");
assert.equal(signerPhone({ mobile: 412345678 }), "412345678");
assert.equal(csvEscape(phoneCsvText('0,"test"\n')), '"\'0,""test""\n"');

// Execute the real route with a deterministic database double (no credentials).
const rows = Array.from({ length: 503 }, (_, i) => ({
  id: String(i), org_id: "tenant-a", signer_name: `Signer ${i}`, signer_email: "test@example.test",
  template_id: "t", template_version_id: "v", signed_at: i === 502 ? "2026-10-02T23:59:59.999Z" : "2026-10-01T12:00:00Z",
  signing_channel: "web", pdf_sha256: "hash", flagged: true,
  participant_search: i === 0 ? "Signer 0 Child Two" : `Signer ${i}`,
  participants: i === 0 ? [{ full_name: "Signer 0" }, { full_name: "Child Two" }] : null,
  field_values: i === 0 ? { answer_7: "0412 345 678" } : i === 1 ? { mobile: "+61 (412) 345-678" } : {},
}));
rows.push({ ...rows[0], id: "other-tenant", org_id: "tenant-b", field_values: { answer_7: "SECRET" } });
rows.push({ ...rows[0], id: "outside-range", signed_at: "2026-10-03T00:00:00Z" });
const calls = [];
let currentUser = { id: "user", org_id: "tenant-a" };
globalThis.__phoneExportDb = {
  auth: { getUser: async () => ({ data: { user: currentUser } }) },
  from(table) {
    let columns;
    const query = {
      select(value) { columns = value; calls.push([table, "select", value]); return this; },
      order(column) { calls.push([table, "order", column]); return this; },
      range(start, end) { this.start = start; this.end = end; return this; },
      then(resolve) {
        if (table === "signed_waivers") assert.match(columns, /field_values/);
        if (table === "template_versions") assert.match(columns, /fields/);
        const data = table === "signed_waivers" ? rows : table === "template_versions"
          ? [{ id: "v", version_number: 1, fields }] : [{ id: "t", name: "Waiver" }];
        const scoped = data.filter((row) => table !== "signed_waivers" || row.org_id === currentUser?.org_id);
        const filtered = scoped.filter((row) => (this.filters ?? []).every(([method, column, value]) => {
          const actual = row[column];
          if (method === "ilike") return String(actual ?? "").toLowerCase().includes(value.replaceAll("%", "").toLowerCase());
          if (method === "eq") return actual === value;
          if (method === "gte") return actual >= value;
          if (method === "lte") return actual <= value;
          if (method === "lt") return actual < value;
          return false;
        }));
        resolve({ data: filtered.slice(this.start, this.end + 1), error: null });
      },
    };
    for (const method of ["ilike", "gte", "lte", "lt", "eq"]) query[method] = function (column, value) {
      calls.push([table, method, column, value]);
      (this.filters ??= []).push([method, column, value]);
      return this;
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
const phoneColumn = parsed.headers.indexOf("Phone Number");
assert.equal(phoneColumn, 16);
assert.equal(parsed.headers.length, 20);
assert.equal(parsed.rows[0][phoneColumn], "'0412 345 678");
assert.equal(parsed.rows[1][phoneColumn], "'+61 (412) 345-678");
assert.equal(parsed.rows[2][phoneColumn], "");
assert.equal(parsed.rows[0][parsed.headers.indexOf("participant_count")], "2");
assert.deepEqual(JSON.parse(parsed.rows[0][parsed.headers.indexOf("participant_names")]), ["Signer 0", "Child Two"]);
assert.equal(parsed.rows.at(-1)[0], "502"); // end-of-day fractional seconds are included
assert.ok(!parsed.rows.some((row) => row[0] === "other-tenant" || row[0] === "outside-range"));
assert.ok(calls.some((call) => call[1] === "order" && call[2] === "id"));
for (const column of ["participant_search", "signer_email", "signed_at", "template_id", "flagged"])
  assert.ok(calls.some((call) => call[2] === column), `Missing filter ${column}`);
currentUser = null;
assert.equal((await GET(new Request("https://example.test/api/signatures/export"))).status, 401);
for (const phone of ["0412345678", "+61 (412) 345-678", ""]) {
  const record = csvRecord({ participant_phone: phone, record_origin: "imported" }, []);
  assert.equal(parseCsv("a,b,c,d,e,phone,g,h,i,j,k,l,m,n,o,p,q,r,s\r\n" + record).rows[0][5], phone ? `'${phone}` : "");
}
// Run the real signed-waiver SELECT policy in a local PostgreSQL fixture.
const fixture = await testDatabase();
try {
  const { pg } = fixture;
  await pg.exec(readFileSync(new URL("../supabase/migrations/0002_rls.sql", import.meta.url), "utf8"));
  await pg.exec("grant select on signed_waivers to authenticated");
  const orgA = randomUUID(), orgB = randomUUID(), userA = randomUUID(), userB = randomUUID();
  await pg.query("insert into organizations(id,name) values($1,'A'),($2,'B')", [orgA, orgB]);
  await pg.query("insert into profiles(id,org_id,role,email) values($1,$2,'owner','a@example.test'),($3,$4,'owner','b@example.test')", [userA, orgA, userB, orgB]);
  await pg.query("insert into signed_waivers(id,org_id,signer_name,field_values) values($1,$2,'A', $3),($4,$5,'B',$6)", [randomUUID(), orgA, { mobile: "0412" }, randomUUID(), orgB, { mobile: "SECRET" }]);
  for (const [user, expected] of [[userA, "A"], [userB, "B"]]) {
    await pg.exec(`set role authenticated;set "test.uid"='${user}';`);
    const visible = (await pg.query("select signer_name,field_values from signed_waivers")).rows;
    assert.equal(visible.length, 1);
    assert.equal(visible[0].signer_name, expected);
    await pg.exec("reset role;");
  }
} finally {
  await fixture.close();
}
delete globalThis.__phoneExportDb;
delete globalThis.__phoneExportHelpers;
console.log("Phone export checks passed: aliases, custom fields, missing values, escaping, filters, 503-row pagination, imported records.");
