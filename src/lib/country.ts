/** ISO region validation also rejects provider placeholders such as XX. */
export function countryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || ["XX", "ZZ", "EU", "UN"].includes(code)) return null;
  const name = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(code);
  return name ? code : null;
}

export function countryName(raw: unknown): string | null {
  const code = countryCode(raw);
  return code ? new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null : null;
}
