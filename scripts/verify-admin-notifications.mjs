import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adminNotificationSchema } from "../src/lib/admin-notification-input.ts";

const valid = { title: " Update ", message: " New feature available ", all: false, recipients: ["123e4567-e89b-42d3-a456-426614174000"] };
assert.equal(adminNotificationSchema.parse(valid).title, "Update");
assert.equal(adminNotificationSchema.safeParse({ ...valid, recipients: [] }).success, false);
assert.equal(adminNotificationSchema.safeParse({ ...valid, recipients: [], all: true }).success, true);
for (const invalid of [{ title: " " }, { title: "x".repeat(121) }, { message: " " }, { message: "x".repeat(2001) }, { recipients: ["bad-id"] }, { all: "true" }]) {
  assert.equal(adminNotificationSchema.safeParse({ ...valid, ...invalid }).success, false);
}
const sql = await readFile(new URL("../supabase/migrations/0016_admin_notifications.sql", import.meta.url), "utf8");
assert.match(sql, /enable row level security/);
assert.match(sql, /recipient_id = \(select auth.uid\(\)\)/);
assert.match(sql, /from public, anon, authenticated/);
assert.match(sql, /where p_all or id = any\(p_recipients\)/);
const action = await readFile(new URL("../src/app/admin/notifications/actions.ts", import.meta.url), "utf8");
assert.ok(action.indexOf("await assertAdmin()") < action.indexOf('.rpc('));
const inbox = await readFile(new URL("../src/app/api/notifications/route.ts", import.meta.url), "utf8");
assert.match(inbox, /eq\("recipient_id", user.id\)/);
assert.match(inbox, /private, no-store/);
console.log("Admin notification validation and access contracts passed (no messages sent)");
