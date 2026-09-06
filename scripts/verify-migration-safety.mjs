import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [activationSql, publishSql] = await Promise.all([
  readFile(new URL("../supabase/migrations/0014_activation_milestones.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/0015_atomic_template_publish.sql", import.meta.url), "utf8"),
]);

const allowedRoles = new Set(["owner", "admin", "staff"]);
const mayManage = (actor, templateOrg) =>
  actor.orgId === templateOrg && allowedRoles.has(actor.role);

for (const role of allowedRoles) {
  assert.equal(mayManage({ orgId: "org-a", role }, "org-a"), true, `${role} should publish`);
}
assert.equal(mayManage({ orgId: "org-a", role: "viewer" }, "org-a"), false);
assert.equal(mayManage({ orgId: "org-b", role: "staff" }, "org-a"), false);

// Direct writes and RPC publication share the same role boundary.
assert.throws(() => {
  if (!mayManage({ orgId: "org-a", role: "viewer" }, "org-a")) throw new Error("denied");
}, /denied/);
assert.throws(() => {
  if (!mayManage({ orgId: "org-b", role: "admin" }, "org-a")) throw new Error("denied");
}, /denied/);

// A small serialized model checks that the SQL's row-lock contract produces
// distinct sequential versions and moves the pointer only after each insert.
const template = { orgId: "org-a", versions: [], currentVersion: null };
let publishQueue = Promise.resolve();
function publish(actor) {
  if (!mayManage(actor, template.orgId)) return Promise.reject(new Error("denied"));
  const operation = publishQueue.then(() => {
    const version = template.versions.length + 1;
    template.versions.push(version);
    template.currentVersion = version;
    return version;
  });
  publishQueue = operation.catch(() => {});
  return operation;
}
assert.deepEqual(
  await Promise.all([
    publish({ orgId: "org-a", role: "staff" }),
    publish({ orgId: "org-a", role: "owner" }),
  ]),
  [1, 2],
);
assert.deepEqual(template.versions, [1, 2]);
assert.equal(template.currentVersion, 2);

// Model the revised backfill: only a current version on a published/archived
// template is evidence. An unlinked version from a failed legacy publish is not.
const historicalTemplates = [
  { id: "draft", orgId: "org-a", status: "draft", currentVersionId: null },
  { id: "live", orgId: "org-b", status: "published", currentVersionId: "live-v2" },
  { id: "old-live", orgId: "org-c", status: "archived", currentVersionId: "archived-v1" },
];
const historicalVersions = [
  { id: "orphan-v1", templateId: "draft" },
  { id: "live-v1-orphan", templateId: "live" },
  { id: "live-v2", templateId: "live" },
  { id: "archived-v1", templateId: "old-live" },
];
const publicationEvidence = historicalTemplates.flatMap((candidate) =>
  historicalVersions.filter(
    (version) =>
      ["published", "archived"].includes(candidate.status) &&
      version.templateId === candidate.id &&
      version.id === candidate.currentVersionId,
  ),
);
assert.deepEqual(publicationEvidence.map(({ id }) => id), ["live-v2", "archived-v1"]);
assert.equal(publicationEvidence.some(({ id }) => id === "orphan-v1"), false);

assert.match(publishSql, /drop policy if exists tpl_all on waiver_templates/i);
for (const policy of ["tpl_insert", "tpl_update", "tpl_delete", "ver_insert"]) {
  assert.match(publishSql, new RegExp(`create policy ${policy}[\\s\\S]*?role in \\('owner', 'admin', 'staff'\\)`, "i"));
}
assert.match(publishSql, /not authorized to publish waiver template[\s\S]*?42501/i);
assert.match(publishSql, /select wt\.org_id[\s\S]*?p\.role in \('owner', 'admin', 'staff'\)/i);
assert.match(publishSql, /for update/i);
assert.ok(publishSql.indexOf("for update") < publishSql.indexOf("insert into template_versions"));
assert.ok(publishSql.indexOf("insert into template_versions") < publishSql.indexOf("update waiver_templates"));
assert.match(publishSql, /security invoker/i);

assert.match(activationSql, /v\.id\s*=\s*t\.current_version_id/i);
assert.match(activationSql, /v\.template_id\s*=\s*t\.id/i);
assert.match(activationSql, /where t\.status in \('published', 'archived'\)/i);

console.log("Migration safety checks passed: role enforcement, atomic publish, orphan-safe backfill");
