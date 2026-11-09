import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

// Reuse the approved artwork unchanged; resize only, preserving transparency.
const source = 'public/flatwaiver-logo.png';
const metadata = await sharp(source).metadata();
assert.equal(metadata.width, metadata.height, 'Approved icon must be square');
assert.ok(metadata.width >= 512, 'Use the approved icon at 512px or larger');
const png = size => sharp(source).resize(size, size).png().toBuffer();

const sizes = [16, 32, 48, 96, 256];
const images = await Promise.all(sizes.map(png));
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2); // ICO
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(images[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await fs.mkdir('public/icons', { recursive: true });
await fs.writeFile('src/app/favicon.ico', Buffer.concat([directory, ...images]));
await fs.writeFile('src/app/icon.png', await png(96));
await fs.writeFile('src/app/apple-icon.png', await png(180));
await fs.writeFile('public/icons/flatwaiver-192.png', await png(192));
console.log('Generated ICO (16/32/48/96/256), PNG (96), Apple (180), and manifest (192/512) icons');
