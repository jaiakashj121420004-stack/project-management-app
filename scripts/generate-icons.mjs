/**
 * Aurora PWA icon generator — zero dependencies (Node built-ins only).
 *
 * Draws the Aurora mark (a bold "A" glyph over a violet→cyan aurora gradient
 * with a magenta glow) directly to RGBA pixels and encodes PNGs by hand, so we
 * never add an image toolchain to the project. Re-run after changing the brand:
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs (committed binaries) into ./public:
 *   pwa-192x192.png · pwa-512x512.png  — manifest icons (purpose "any")
 *   maskable-512x512.png               — full-bleed, glyph inside the safe zone
 *   apple-touch-icon.png (180)         — iOS home-screen icon
 *   favicon.svg                        — crisp vector tab icon
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(publicDir, { recursive: true });

// --- tiny color/math helpers ------------------------------------------------
const VIOLET = [124, 58, 237];
const CYAN = [6, 182, 212];
const MAGENTA = [236, 72, 153];
const INK = [248, 246, 255];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Distance from point (px,py) to segment (ax,ay)-(bx,by), all normalized. */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1e-9), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Render an icon to a raw RGBA Buffer. `h` is the glyph half-height (0..0.5). */
function renderRGBA(size, h) {
  const buf = Buffer.alloc(size * size * 4);
  const aa = 1.6 / size; // ~1px anti-aliasing in normalized units
  const r = 0.16 * h; // stroke half-thickness

  // "A" geometry, centered.
  const apex = [0.5, 0.5 - h];
  const footHalf = 0.66 * h;
  const left = [0.5 - footHalf, 0.5 + h];
  const right = [0.5 + footHalf, 0.5 + h];
  const crossT = 0.62; // crossbar position down each leg
  const crossL = [lerp(apex[0], left[0], crossT), lerp(apex[1], left[1], crossT)];
  const crossR = [lerp(apex[0], right[0], crossT), lerp(apex[1], right[1], crossT)];

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);

      // Aurora background: diagonal violet→cyan, with a magenta glow top-right.
      let color = mix(VIOLET, CYAN, clamp(u * 0.55 + v * 0.55, 0, 1));
      const glow = smoothstep(0.55, 0, Math.hypot(u - 0.8, v - 0.2));
      color = mix(color, MAGENTA, glow * 0.6);

      // Glyph coverage from the min distance to the three strokes.
      const d =
        Math.min(
          segDist(u, v, apex[0], apex[1], left[0], left[1]),
          segDist(u, v, apex[0], apex[1], right[0], right[1]),
          segDist(u, v, crossL[0], crossL[1], crossR[0], crossR[1]),
        ) - r;
      const cover = 1 - smoothstep(-aa, aa, d);
      color = mix(color, INK, cover);

      const o = (y * size + x) * 4;
      buf[o] = Math.round(color[0]);
      buf[o + 1] = Math.round(color[1]);
      buf[o + 2] = Math.round(color[2]);
      buf[o + 3] = 255; // full-bleed, opaque
    }
  }
  return buf;
}

// --- minimal PNG encoder ----------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // bytes 10-12 default 0 (compression/filter/interlace)

  // Prefix each scanline with filter byte 0.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writePNG(name, size, h) {
  const png = encodePNG(size, renderRGBA(size, h));
  writeFileSync(join(publicDir, name), png);
  console.log(`  ✓ ${name} (${png.length} bytes)`);
}

// --- favicon.svg (vector) ---------------------------------------------------
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Aurora">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#06B6D4"/>
    </linearGradient>
    <radialGradient id="glow" cx="51" cy="13" r="34" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#EC4899" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#EC4899" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <rect width="64" height="64" rx="14" fill="url(#glow)"/>
  <path d="M32 13 L46 51 H39.5 L36.7 43 H27.3 L24.5 51 H18 Z M29.4 36 H34.6 L32 28 Z"
        fill="#F8F6FF"/>
</svg>
`;

console.log('Generating Aurora PWA icons →', publicDir);
writePNG('pwa-192x192.png', 192, 0.34);
writePNG('pwa-512x512.png', 512, 0.34);
writePNG('maskable-512x512.png', 512, 0.26); // glyph inside the maskable safe zone
writePNG('apple-touch-icon.png', 180, 0.34);
writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg);
console.log('  ✓ favicon.svg');
console.log('Done.');
