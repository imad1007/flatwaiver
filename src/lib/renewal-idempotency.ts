/** Stable provider key shared by manual and scheduled renewal delivery. */
export function renewalEmailIdempotencyKey(signedWaiverId: string): string {
  return `renewal-${signedWaiverId}`;
}
