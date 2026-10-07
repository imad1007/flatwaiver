import { z } from "zod";

export const MAX_SIGNATURE_BYTES = 1024 * 1024;
export const signatureSchema = z.string().startsWith("data:image/png;base64,")
  .max(22 + Math.ceil(MAX_SIGNATURE_BYTES / 3) * 4);
// Calendar dates stay as YYYY-MM-DD strings: never convert DOBs to local time.
export const participantDobSchema = z.iso.date().refine(
  value => value >= "0001-01-01" && value <= new Date().toISOString().slice(0, 10),
  "Enter a valid date of birth that is not in the future.",
);
export const participantSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  dateOfBirth: participantDobSchema,
  signatureDataUrl: signatureSchema,
  isMinor: z.boolean(),
  guardianName: z.string().trim().min(1).max(200).optional(),
  guardianRelationship: z.string().trim().min(2).max(100).optional(),
  guardianSignatureDataUrl: signatureSchema.optional(),
}).strict();
export type ParticipantSubmission = z.infer<typeof participantSchema>;

/** No permissive base64 decoding or unbounded raster dimensions. */
export function decodeSignature(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1].length % 4 !== 0) return null;
  const png = Buffer.from(match[1], "base64");
  if (png.length < 45 || png.length > MAX_SIGNATURE_BYTES || png.toString("base64") !== match[1]) return null;
  if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || png.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 4_000_000) return null;
  let offset = 8, hasPixels = false, ended = false;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    if (length > png.length - offset - 12) return null;
    const type = png.toString("ascii", offset + 4, offset + 8);
    if (offset === 8 && (type !== "IHDR" || length !== 13)) return null;
    let crc = 0xffffffff;
    for (const byte of png.subarray(offset + 4, offset + 8 + length)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== png.readUInt32BE(offset + 8 + length)) return null;
    if (type === "IDAT" && length) hasPixels = true;
    offset += length + 12;
    if (type === "IEND") { ended = length === 0; break; }
  }
  if (!hasPixels || !ended || offset !== png.length) return null;
  return png;
}

export function validateGroupSubmission(enabled: boolean, minorMode: string, count: unknown, raw: unknown):
  { participants: ParticipantSubmission[]; error?: never } | { error: string; participants?: never } {
  if (!enabled) return raw === undefined && count === undefined ? { participants: [] } : { error: "Group signing is disabled for this waiver." };
  if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 10 || !Array.isArray(raw) || raw.length !== count) {
    return { error: "Submit between 1 and 10 participants with a matching participant count." };
  }
  const participants: ParticipantSubmission[] = [];
  for (let i = 0; i < raw.length; i++) {
    const parsed = participantSchema.safeParse(raw[i]);
    const prefix = `Participant ${i + 1}: `;
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.path[0];
      return { error: prefix + (key === "fullName" ? "Full name is required (maximum 200 characters)." : key === "dateOfBirth" ? "Enter a valid date of birth that is not in the future." : key === "signatureDataUrl" ? "A valid signature is required." : "Invalid participant information.") };
    }
    const p = parsed.data;
    if (!decodeSignature(p.signatureDataUrl)) return { error: prefix + "Invalid signature image." };
    if (p.isMinor) {
      if (minorMode !== "allowed") return { error: prefix + "This waiver does not accept signatures for minors." };
      if (!p.guardianName || !p.guardianRelationship || !p.guardianSignatureDataUrl || !decodeSignature(p.guardianSignatureDataUrl)) {
        return { error: prefix + "Guardian name, relationship, and a valid signature are required." };
      }
    } else if (p.guardianName !== undefined || p.guardianRelationship !== undefined || p.guardianSignatureDataUrl !== undefined) {
      return { error: prefix + "Unexpected guardian information." };
    }
    participants.push(p);
  }
  return { participants };
}
