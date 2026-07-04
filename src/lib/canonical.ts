import { createHash } from "node:crypto";

/**
 * Deterministic JSON serialization: object keys sorted recursively so the
 * same logical content always hashes to the same value.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function sha256Hex(data: string | Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Hash of a template version's legal content: body + fields + consent_text. */
export function contentSha256(
  body: unknown,
  fields: unknown,
  consentText: string
): string {
  return sha256Hex(
    canonicalJson({ body, fields, consent_text: consentText })
  );
}
