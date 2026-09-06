import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicNetworkAddress } from "@/lib/network-address";

const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan"];

export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Webhook URLs must use https.");
  if (url.username || url.password) throw new Error("Webhook URLs cannot contain credentials.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error("Webhook URLs must use a public hostname.");
  }
  let addresses: { address: string }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Webhook hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    throw new Error("Webhook URLs must resolve only to public network addresses.");
  }
  return url;
}
