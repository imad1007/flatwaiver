import assert from "node:assert/strict";
import { renewalEmailIdempotencyKey } from "../src/lib/renewal-idempotency.ts";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";

assert.equal(renewalEmailIdempotencyKey(first), renewalEmailIdempotencyKey(first));
assert.notEqual(renewalEmailIdempotencyKey(first), renewalEmailIdempotencyKey(second));
assert.match(renewalEmailIdempotencyKey(first), /^renewal-[0-9a-f-]{36}$/);
assert.ok(renewalEmailIdempotencyKey(first).length <= 256);

console.log("Renewal idempotency checks passed: 4 assertions");
