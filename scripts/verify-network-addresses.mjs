import assert from "node:assert/strict";
import { isPublicNetworkAddress } from "../src/lib/network-address.ts";

for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
  assert.equal(isPublicNetworkAddress(address), true, address + " should be public");
}
for (const address of [
  "127.0.0.1", "10.0.0.1", "100.64.0.1", "169.254.169.254",
  "172.16.0.1", "192.168.1.1", "198.51.100.8", "224.0.0.1",
  "::", "::1", "fc00::1", "fe80::1", "2001:db8::1", "::127.0.0.1",
  "::ffff:127.0.0.1",
]) {
  assert.equal(isPublicNetworkAddress(address), false, address + " should be blocked");
}
console.log("Network address checks passed: 18 cases");
