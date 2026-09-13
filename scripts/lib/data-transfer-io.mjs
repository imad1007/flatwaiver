import { createReadStream, createWriteStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import yazl from "yazl";
import {
  LIMITS,
  safeArchiveName,
  validateMagic,
} from "../../src/lib/data-transfer-core.mjs";
import { checkTransfer, transferSignal } from "./data-transfer-runtime.mjs";
import { storagePathBelongsToOrg } from "../../src/lib/storage-path.ts";

export function boundedStream(max, onChunk = () => {}) {
  let total = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      try {
        checkTransfer();
      } catch (error) {
        return callback(error);
      }
      total += chunk.length;
      if (total > max)
        return callback(new Error("File exceeds the transfer size limit"));
      onChunk(chunk);
      callback(null, chunk);
    },
  });
}
export async function fileHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
export async function* recordLines(path) {
  let pending = Buffer.alloc(0);
  for await (const chunk of createReadStream(path)) {
    pending = Buffer.concat([pending, chunk]);
    let at;
    while ((at = pending.indexOf(10)) !== -1) {
      if (at > 512 * 1024) throw new Error("Backup record line exceeds 512 KB");
      yield new TextDecoder("utf-8", { fatal: true }).decode(
        pending.subarray(0, at),
      );
      pending = pending.subarray(at + 1);
    }
    if (pending.length > 512 * 1024)
      throw new Error("Backup record line exceeds 512 KB");
  }
  if (pending.length)
    yield new TextDecoder("utf-8", { fatal: true }).decode(pending);
}
export async function download(
  db,
  bucket,
  path,
  orgId,
  directory,
  max = LIMITS.file,
) {
  if (!path || !storagePathBelongsToOrg(path, orgId))
    throw new Error("Storage ownership check failed");
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, 600);
  if (error) throw error;
  const signal = AbortSignal.any(
    [transferSignal(), AbortSignal.timeout(3600000)].filter(Boolean),
  );
  const response = await fetch(data.signedUrl, { signal });
  if (!response.ok || !response.body)
    throw new Error("A source file could not be downloaded");
  const local = join(directory, randomUUID());
  const digest = createHash("sha256");
  await pipeline(
    Readable.fromWeb(response.body),
    boundedStream(max, (c) => digest.update(c)),
    createWriteStream(local, { flags: "wx" }),
    { signal },
  );
  return { local, hash: digest.digest("hex"), size: (await stat(local)).size };
}
export async function uploadFile(db, bucket, path, local, contentType) {
  checkTransfer();
  const stream = createReadStream(local, { signal: transferSignal() });
  try {
    const { error } = await db.storage.from(bucket).upload(path, stream, {
      contentType,
      duplex: "half",
      upsert: false,
    });
    if (error) throw error;
  } finally {
    stream.destroy();
  }
}
/** Extract sequentially to generated filenames, never to archive-supplied paths. */
export async function extractZip(local, directory, limits = {}) {
  const maxEntries = limits.files ?? LIMITS.files;
  const maxExpanded = limits.expanded ?? LIMITS.expanded;
  const zip = await new Promise((resolve, reject) =>
    yauzl.open(
      local,
      { lazyEntries: true, strictFileNames: true, validateEntrySizes: true },
      (e, z) => (e ? reject(e) : resolve(z)),
    ),
  );
  const files = new Map();
  let total = 0,
    count = 0;
  try {
    await new Promise((resolve, reject) => {
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        (async () => {
          const name = safeArchiveName(entry.fileName);
          checkTransfer();
          if (++count > maxEntries)
            throw new Error("ZIP contains too many entries");
          if (entry.generalPurposeBitFlag & 1)
            throw new Error("Encrypted ZIP files are not supported");
          const type = (entry.externalFileAttributes >>> 16) & 0o170000;
          if (type && type !== 0o100000 && type !== 0o040000)
            throw new Error("ZIP links and special files are not supported");
          if (name.endsWith("/")) {
            zip.readEntry();
            return;
          }
          if (files.has(name)) throw new Error("Duplicate ZIP entry names");
          if (!/\.(pdf|png|jpe?g|csv|json|ndjson)$/i.test(name))
            throw new Error(`Unsupported archive entry: ${name}`);
          const max =
            /\.ndjson$/i.test(name) || name === "submissions.csv"
              ? LIMITS.metadata
              : /\.(csv|json)$/i.test(name)
                ? LIMITS.csv
                : LIMITS.file;
          total += entry.uncompressedSize;
          if (
            entry.uncompressedSize > max ||
            total > maxExpanded ||
            entry.uncompressedSize >
              Math.max(1, entry.compressedSize) * LIMITS.ratio
          )
            throw new Error("ZIP expansion limits exceeded");
          const stream = await new Promise((res, rej) =>
            zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))),
          );
          const output = join(directory, randomUUID());
          const digest = createHash("sha256");
          await pipeline(
            stream,
            boundedStream(max, (c) => digest.update(c)),
            createWriteStream(output, { flags: "wx" }),
          );
          files.set(name, {
            local: output,
            hash: digest.digest("hex"),
            size: entry.uncompressedSize,
          });
          zip.readEntry();
        })().catch(reject);
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
  return files;
}
export async function checkDocument(file, name) {
  if ((await stat(file.local)).size > LIMITS.file)
    throw new Error("Document exceeds 50 MB");
  const handle = await open(file.local, "r");
  try {
    const bytes = Buffer.alloc(8);
    const { bytesRead } = await handle.read(bytes, 0, 8, 0);
    return validateMagic(bytes.subarray(0, bytesRead), name);
  } finally {
    await handle.close();
  }
}
export async function makeZip(entries, output) {
  const zip = new yazl.ZipFile();
  const done = pipeline(
    zip.outputStream,
    boundedStream(LIMITS.zip),
    createWriteStream(output, { flags: "wx" }),
  );
  zip.on("error", (error) => zip.outputStream.destroy(error));
  for (const [name, local] of entries)
    zip.addFile(local, safeArchiveName(name), { compress: false });
  zip.end();
  await done;
}
