/**
 * Encode an untrusted value as one CSV cell.
 *
 * Spreadsheet apps can execute cells beginning with formula sigils even when
 * those cells are quoted CSV. Prefixing an apostrophe makes the value literal;
 * leading whitespace is included in the check because some apps ignore it.
 */
export function csvEscape(value: string): string {
  const literal = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(literal)) {
    return `"${literal.replace(/"/g, '""')}"`;
  }
  return literal;
}

/** Resolve the signer's number, never an emergency/guardian contact number. */
export function signerPhone(values: unknown, fields: unknown = []): string {
  if (!values || typeof values !== "object" || Array.isArray(values)) return "";
  const answers = values as Record<string, unknown>;
  const words = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const otherContact = /\b(emergency|guardian|parent|secondary|alternate|alternative)\b|\bnext of kin\b/;
  const phoneWords = /\b(phone|mobile|telephone|telefono|telemovel|cell|cellular|contact (?:number|no)|tel)\b/;
  const compactAlias = /^(?:(?:your|signer|participant|contact|primary|customer|client))?(?:phone|mobile|telephone|telefono|telemovel|cell)(?:number|no|phone)?$/;
  const isPhone = (s: string) => phoneWords.test(words(s)) || compactAlias.test(words(s).replace(/ /g, ""));
  const definitions = Array.isArray(fields) ? fields.filter((f): f is { key: string; label?: string; type?: string } =>
    !!f && typeof f === "object" && typeof f.key === "string") : [];
  const byKey = new Map(definitions.map((f) => [f.key, f]));
  const keys = new Set<string>([
    ...Object.keys(answers).filter((key) => isPhone(key)),
    ...definitions.filter((f) => f.type === "phone" || isPhone(f.label ?? "")).map((f) => f.key),
  ]);
  for (const key of keys) {
    if (otherContact.test(words(`${key} ${byKey.get(key)?.label ?? ""}`))) continue;
    const value = answers[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

/** Spreadsheet text marker preserves leading zeroes without executable formulas. */
export function phoneCsvText(value: string): string {
  return value ? `'${value}` : "";
}
