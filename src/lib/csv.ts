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
