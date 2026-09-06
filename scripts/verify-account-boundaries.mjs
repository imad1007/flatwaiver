import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [account, branding, onboarding, auth, accountPage, brandingPage] =
  await Promise.all([
    source("src/app/(app)/settings/account/actions.ts"),
    source("src/app/(app)/settings/branding/actions.ts"),
    source("src/app/onboarding/actions.ts"),
    source("src/lib/auth.ts"),
    source("src/app/(app)/settings/account/page.tsx"),
    source("src/app/(app)/settings/branding/page.tsx"),
  ]);

assert.match(account, /requireOrgRole\("admin"\)/);
assert.match(account, /\.eq\("id", caller\.orgId\)[\s\S]*?\.select\("id"\)/);
assert.match(branding, /requireOrgRole\("admin"\)/);
assert.match(branding, /branding\/\$\{crypto\.randomUUID\(\)\}/);
assert.ok(
  branding.indexOf("await saveBranding(orgId, branding)") <
    branding.lastIndexOf('.remove([previousLogoPath])'),
  "new pointer is saved before old logo cleanup"
);
assert.ok(
  onboarding.match(/requireOrgRole\("owner"\)/g)?.length === 2,
  "both onboarding mutations remain owner-only"
);
assert.match(onboarding, /if \(subError\) return \{ ok: false/);
assert.match(onboarding, /if \(tErr \|\| !template\)[\s\S]*?ok: false/);
assert.ok(auth.match(/if \(profileError\) throw/g)?.length === 2);
assert.match(auth, /if \(error\) throw new Error\("Couldn't load your subscription/);
assert.match(accountPage, /canEditBusiness=\{canManageBranding\(caller\.role\)\}/);
assert.match(brandingPage, /canEdit=\{canManageBranding\(caller\.role\)\}/);

console.log("account boundary verification passed (auth, roles, outcomes, logo ordering)");
