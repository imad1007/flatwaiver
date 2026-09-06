// Shared output shape for the public read API (/api/v1/*). Keeps the internal
// column names (e.g. signing_channel) from leaking into the public contract.

export interface PublicSignatureRow {
  id: string;
  template_id: string;
  signer_name: string;
  signer_email: string | null;
  is_minor: boolean;
  flagged: boolean;
  tag: string | null;
  signing_channel: string;
  signed_at: string;
}

export function shapeSignature(row: PublicSignatureRow) {
  return {
    id: row.id,
    template_id: row.template_id,
    signer_name: row.signer_name,
    signer_email: row.signer_email,
    is_minor: row.is_minor,
    flagged: row.flagged,
    tag: row.tag,
    channel: row.signing_channel,
    signed_at: row.signed_at,
  };
}

export function shapeCursorPage<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    hasMore,
    nextCursor: hasMore ? data.at(-1)?.id ?? null : null,
  };
}
