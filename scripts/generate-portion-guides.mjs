// Generates the tier-4 portion-guide PNGs in public/images/portion-guides.
// Run with: npm run generate:portion-guides
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.argv[2] ?? resolve(REPO_ROOT, 'public/images/portion-guides');
const SIZE = 512;
const SS = 3; // supersample factor for smooth edges
const W = SIZE * SS;

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePng(path, pixels) {
  const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const off = y * (SIZE * 3 + 1);
    raw[off] = 0;
    for (let x = 0; x < SIZE; x++) {
      const i = off + 1 + x * 3;
      const p = (y * SIZE + x) * 3;
      raw[i] = pixels[p];
      raw[i + 1] = pixels[p + 1];
      raw[i + 2] = pixels[p + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// --- shape predicates, all in normalized 0..1 space -----------------------
const rounded = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.max(Math.abs(x - cx) - (hw - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (hh - r), 0);
  return Math.hypot(dx, dy) <= r;
};
const disc = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

const GUIDES = {
  // Palm = protein: a wide rounded palm slab.
  palm: {
    color: '#e11d48',
    shape: (x, y) => rounded(x, y, 0.5, 0.52, 0.29, 0.2, 0.13),
  },
  // Fist = vegetables: a closed round fist.
  fist: {
    color: '#16a34a',
    shape: (x, y) => disc(x, y, 0.5, 0.5, 0.27),
  },
  // Cupped hand = carbs: a bowl (lower half of a disc).
  cupped_hand: {
    color: '#d97706',
    shape: (x, y) =>
      (disc(x, y, 0.5, 0.44, 0.3) && !disc(x, y, 0.5, 0.44, 0.22) && y >= 0.44) ||
      (y >= 0.42 && y <= 0.48 && x >= 0.2 && x <= 0.8),
  },
  // Entire thumb = healthy fats: a tall rounded thumb.
  thumb: {
    color: '#7c3aed',
    shape: (x, y) => rounded(x, y, 0.5, 0.5, 0.115, 0.28, 0.115),
  },
  // Thumb tip = concentrated fats: a small tip disc.
  thumb_tip: {
    color: '#ca8a04',
    shape: (x, y) => disc(x, y, 0.5, 0.5, 0.13),
  },
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, { color, shape }] of Object.entries(GUIDES)) {
  const accent = hex(color);
  const bg = mix(accent, [255, 255, 255], 0.9).map(Math.round);
  const plate = mix(accent, [255, 255, 255], 0.78).map(Math.round);

  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px * SS + sx + 0.5) / W;
          const y = (py * SS + sy + 0.5) / W;
          const c = shape(x, y) ? accent : disc(x, y, 0.5, 0.5, 0.4) ? plate : bg;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * SIZE + px) * 3;
      pixels[i] = Math.round(r / n);
      pixels[i + 1] = Math.round(g / n);
      pixels[i + 2] = Math.round(b / n);
    }
  }

  const bytes = writePng(`${OUT_DIR}/${name.replace(/_/g, '-')}.png`, pixels);
  console.log(`${name}.png ${bytes} bytes`);
}
