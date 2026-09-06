import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ASSIGNABLE_ROLES,
  canManageBilling,
  canManageBranding,
  canManageTeam,
  canManageTemplates,
  normalizeRole,
} from "../src/lib/permissions.ts";

const expected = {
  owner: [true, true, true],
  admin: [true, true, true],
  staff: [false, false, true],
  viewer: [false, false, false],
};

for (const [role, permissions] of Object.entries(expected)) {
  assert.deepEqual(
    [canManageTeam(role), canManageBilling(role), canManageTemplates(role)], permissions,
    `${role} capability matrix`
  );
}

assert.deepEqual(ASSIGNABLE_ROLES, ["admin", "staff", "viewer"]);
assert.equal(normalizeRole("owner"), "owner");
assert.equal(normalizeRole("unexpected-role"), "viewer", "unknown roles fail closed");
assert.equal(normalizeRole(null), "viewer", "missing roles fail closed");
assert.equal(canManageBranding("owner"), true);
assert.equal(canManageBranding("admin"), true);
assert.equal(canManageBranding("staff"), false);
assert.equal(canManageBranding("viewer"), false);

const actions = await readFile(
  new URL("../src/app/(app)/settings/team/actions.ts", import.meta.url),
  "utf8"
);
assert.match(actions, /const idSchema = z\.string\(\)\.uuid/);
assert.ok(
  actions.match(/\.eq\("org_id", caller\.orgId\)/g)?.length >= 6,
  "mutations and lookups remain organization-scoped"
);
assert.ok(
  actions.match(/\.select\("id"\)/g)?.length >= 4,
  "writes return affected rows before success"
);
assert.match(actions, /if \(membersError \|\| orgError \|\| !org\)/);
assert.match(actions, /if \(inviteError\)/);
assert.match(actions, /if \(error \|\| !updated\)/);
assert.match(actions, /if \(error \|\| !removed\)/);

console.log("team access verification passed (permission matrix + mutation contracts)");
