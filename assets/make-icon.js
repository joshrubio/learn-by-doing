#!/usr/bin/env node
/* Draws the plugin icon as pixel art on a 32x32 grid and writes it as a 1024x1024 PNG.
   No dependencies. Run: node assets/make-icon.js */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const N = 32;
const SCALE = 32;
const COLOR = {
  bg: [0x2a, 0x45, 0xd6],
  shade: [0x1a, 0x2e, 0x99],
  paper: [0xf4, 0xf5, 0xf2],
  edge: [0xc9, 0xcf, 0xe3],
  ink: [0x16, 0x1b, 0x19],
  line: [0x9a, 0xa3, 0xc7],
  cursor: [0xff, 0xb3, 0x00],
};

const grid = Array.from({ length: N }, () => Array(N).fill(null));
const plot = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y][x] = COLOR[c]; };
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plot(x, y, c); };

/* rounded square background */
const R = 6;
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const cx = x < R ? R : x >= N - R ? N - 1 - R + 1 : x + 0.5;
    const cy = y < R ? R : y >= N - R ? N - 1 - R + 1 : y + 0.5;
    const inCorner = (x < R || x >= N - R) && (y < R || y >= N - R);
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (!inCorner || dx * dx + dy * dy <= R * R) plot(x, y, 'bg');
  }
}

/* book shadow under the pages */
rect(5, 25, 26, 25, 'shade');

/* pages: top row is one pixel narrower to suggest a curve */
rect(5, 9, 14, 9, 'paper'); rect(17, 9, 26, 9, 'paper');
rect(4, 10, 14, 23, 'paper'); rect(17, 10, 27, 23, 'paper');
rect(5, 24, 14, 24, 'edge'); rect(17, 24, 26, 24, 'edge');

/* spine */
rect(15, 9, 16, 24, 'ink');

/* left page: lines of text */
rect(6, 12, 12, 12, 'line');
rect(6, 15, 10, 15, 'line');
rect(6, 18, 12, 18, 'line');
rect(6, 21, 9, 21, 'line');

/* right page: a terminal prompt with a blinking cursor */
[[19, 12], [20, 13], [21, 14], [20, 15], [19, 16]].forEach(([x, y]) => plot(x, y, 'ink'));
rect(23, 15, 26, 16, 'cursor');
rect(19, 19, 25, 19, 'line');
rect(19, 21, 23, 21, 'line');

/* ---- PNG encoding ---- */
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const W = N * SCALE;
const raw = Buffer.alloc((W * 4 + 1) * W);
for (let y = 0; y < W; y++) {
  const row = y * (W * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < W; x++) {
    const px = grid[Math.floor(y / SCALE)][Math.floor(x / SCALE)];
    const o = row + 1 + x * 4;
    if (px) { raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255; }
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', '.claude-plugin', 'icon.png');
fs.writeFileSync(out, png);
console.log(`${out} ${W}x${W}px, ${(png.length / 1024).toFixed(1)} KB`);
