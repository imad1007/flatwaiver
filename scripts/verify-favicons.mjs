import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { spawn } from 'node:child_process';

const source = 'public/flatwaiver-logo.png';
const png = size => sharp(source).resize(size, size).png().toBuffer();
const ico = await fs.readFile('src/app/favicon.ico');
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
const sizes = [16, 32, 48, 96, 256];
assert.equal(ico.readUInt16LE(4), sizes.length);
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  assert.equal(ico[entry] || 256, size);
  assert.equal(ico[entry + 1] || 256, size);
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert.deepEqual(ico.subarray(offset, offset + length), await png(size), 'ICO must contain approved artwork');
}
for (const [file, size] of [['src/app/icon.png', 96], ['src/app/apple-icon.png', 180], ['public/icons/flatwaiver-192.png', 192]]) {
  assert.deepEqual(await fs.readFile(file), await png(size), file);
  assert.equal((await sharp(file).metadata()).hasAlpha, true);
}
await assert.rejects(fs.access('src/app/icon.svg'), 'Old competing icon must be absent');
console.log('PASS: every ICO frame and PNG matches approved source, correct sizes, transparency preserved, no competing SVG');

if (process.argv.includes('--serve')) {
  const origin = 'http://127.0.0.1:3188';
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3188'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.on('data', value => { output = (output + value).slice(-4000); });
  server.stderr.on('data', value => { output = (output + value).slice(-4000); });
  try {
    let home;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(3000) });
        if (response.ok) { home = await response.text(); break; }
      } catch { /* wait for local startup */ }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(home, 'Built server failed to start: ' + output);
    const links = home.match(/<link\b[^>]*>/g) ?? [];
    for (const [rel, url] of [['icon', '/favicon.ico'], ['icon', '/icon.png'], ['apple-touch-icon', '/apple-icon.png'], ['manifest', '/manifest.webmanifest']]) {
      assert.ok(links.some(link => link.includes(`rel="${rel}"`) && link.includes(`href="${url}`)), `${rel} ${url} must be advertised`);
    }
    assert.ok(!links.some(link => /icon\.svg|vercel\.svg|next\.svg/.test(link)));
    for (const [url, file, type] of [
      ['/favicon.ico', 'src/app/favicon.ico', /image\/(x-icon|vnd.microsoft.icon)/],
      ['/icon.png', 'src/app/icon.png', /image\/png/],
      ['/apple-icon.png', 'src/app/apple-icon.png', /image\/png/],
      ['/icons/flatwaiver-192.png', 'public/icons/flatwaiver-192.png', /image\/png/],
      ['/flatwaiver-logo.png', source, /image\/png/],
    ]) {
      const response = await fetch(origin + url, { redirect: 'manual' });
      assert.equal(response.status, 200, url);
      assert.match(response.headers.get('content-type'), type);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(file));
    }
    const response = await fetch(origin + '/manifest.webmanifest');
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.equal(manifest.name, 'FlatWaiver');
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
    assert.equal(manifest.display, 'browser');
    console.log('PASS: production build advertises all icons and manifest; unauthenticated URLs serve exact image bytes and correct content types without redirects');
  } finally {
    server.kill();
  }
}
