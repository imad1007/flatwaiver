/** Whole days from now until the given ISO timestamp, floored at 0. */
export function daysLeftUntil(iso: string): number {
  const msLeft = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}
