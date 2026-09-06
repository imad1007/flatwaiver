import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/0014_activation_milestones.sql", import.meta.url),
  "utf8"
);

assert.match(sql, /unique\s*\(org_id, milestone\)/i);
assert.match(sql, /after insert on signed_waivers/i);
assert.match(sql, /after update of status, current_version_id on waiver_templates/i);
assert.match(sql, /on conflict \(org_id, milestone\) do nothing/gi);
assert.match(sql, /activation_milestones_immutable/i);
assert.match(sql, /security_invoker\s*=\s*true/i);

for (const sensitiveColumn of ["signer_name", "signer_email", "field_values", "pdf_path"]) {
  assert.equal(
    /create table activation_milestones[\s\S]*?;/i.exec(sql)?.[0].includes(sensitiveColumn),
    false,
    `milestone table must not contain ${sensitiveColumn}`
  );
}

console.log("Activation migration checks passed: atomic, immutable, privacy-safe");
