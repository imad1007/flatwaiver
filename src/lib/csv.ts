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
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = new Set(["phone", "mobile", "phonenumber", "mobilenumber", "telephone", "contactnumber", "cellphone", "cellphonenumber", "signerphone", "participantphone", "yourphone", "yourmobile"]);
  const otherContact = /emergency|guardian|parent|secondary|alternate/i;
  const definitions = Array.isArray(fields) ? fields as { key: string; label?: string; type?: string }[] : [];
  const keys = new Set([
    ...Object.keys(answers).filter((key) => aliases.has(normalize(key))),
    ...definitions.filter((f) => typeof f.key === "string" &&
      !otherContact.test(`${f.key} ${f.label ?? ""}`) &&
      (f.type === "phone" || aliases.has(normalize(f.label ?? ""))))
      .map((f) => f.key),
  ]);
  for (const key of keys) {
    if (definitions.some((f) => f.key === key && otherContact.test(f.label ?? ""))) continue;
    const value = answers[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

/** Spreadsheet text marker preserves leading zeroes without executable formulas. */
export function phoneCsvText(value: string): string {
  return value ? `'${value}` : "";
}
