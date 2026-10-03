import "server-only";
import { Creem } from "creem";
import { resolveCreemServer } from "@/lib/creem-environment";
import { tiktokPaymentProperties } from "@/lib/tiktok-pixel";

/** Only look up the transaction ID stored by the verified payment webhook. */
export async function getTikTokPaymentProperties(transactionId: string, subscriptionId: string) {
  const apiKey = process.env.CREEM_API_KEY?.trim();
  if (!apiKey || resolveCreemServer(process.env.CREEM_SERVER, apiKey) !== "prod") return null;
  const creem = new Creem({ apiKey, server: "prod", timeoutMs: 5_000 });
  const transaction = await creem.transactions.getById(transactionId);
  if (transaction.id !== transactionId || transaction.subscription !== subscriptionId) return null;
  return tiktokPaymentProperties(transaction);
}
