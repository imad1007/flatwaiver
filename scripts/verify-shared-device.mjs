import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [publicWaiver, signRoute, signingForm, checkinActions, checkinPage] =
  await Promise.all([
    source("src/lib/public-waiver.ts"),
    source("src/app/api/sign/[slug]/route.ts"),
    source("src/components/signing-form.tsx"),
    source("src/app/(app)/checkin/actions.ts"),
    source("src/app/(app)/checkin/page.tsx"),
  ]);

assert.match(publicWaiver, /if \(templateError\) throw new PublicWaiverLoadError/);
assert.match(publicWaiver, /versionResult\.error \|\| orgResult\.error \|\| subResult\.error/);
assert.match(publicWaiver, /if \(!version \|\| !org \|\| !sub\) throw new PublicWaiverLoadError/);
assert.match(signRoute, /error instanceof PublicWaiverLoadError/);
assert.match(signRoute, /waiver service is temporarily unavailable[\s\S]*503/);

assert.match(signingForm, /3 \* 60 \* 1000/);
assert.match(signingForm, /Shared device: entries clear after 3 minutes/);
assert.match(signingForm, />\s*Clear form\s*</);
assert.match(signingForm, /autoComplete=\{props\.kiosk \? "off"/);
assert.match(signingForm, /armKioskPrivacyReset\(5000\)/);
assert.match(signingForm, /clearTimeout\(kioskResetTimerRef\.current\)/);

assert.ok(
  checkinActions.match(/requireOrgRole\("staff"\)/g)?.length === 2,
  "check-in and undo remain staff-only"
);
assert.ok(
  checkinActions.match(/\.eq\("org_id", caller\.orgId\)/g)?.length >= 3,
  "signature, duplicate, and delete checks remain organization-scoped"
);
assert.match(checkinActions, /if \(error \|\| !deleted\)/);
assert.match(checkinPage, /signaturesResult\.error \|\| checkinsResult\.error \|\| templatesResult\.error/);
assert.match(checkinPage, /rawQ\?\.trim\(\)\.slice\(0, 100\)/);

console.log("shared-device verification passed (availability, privacy reset, check-in access)");
