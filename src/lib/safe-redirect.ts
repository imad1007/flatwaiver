const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const REDIRECT_BASE = "https://flatwaiver.invalid";

/** Return a same-origin path suitable for client navigation or auth callbacks. */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value || !isSafePathText(value)) return fallback;

  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (!isSafePathText(nextDecoded)) return fallback;
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      return fallback;
    }
  }

  try {
    const target = new URL(value, REDIRECT_BASE);
    if (target.origin !== REDIRECT_BASE) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

function isSafePathText(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !CONTROL_CHARACTERS.test(value)
  );
}
