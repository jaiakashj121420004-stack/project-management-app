/**
 * strokeTexture.ts — grain for the pencil and crayon pens.
 *
 * A small tile of random per-pixel alpha, tinted with the stroke colour, used as
 * a repeating pattern fill. Strokes are still crisp vector outlines; the grain is
 * just a fill, so it scales with zoom like paper tooth would. Tiles are cached by
 * (kind, colour) so a page of pencil strokes shares a handful of canvases.
 */
import type { StrokeTexture } from './elements';

const TILE = 128;
const cache = new Map<string, HTMLCanvasElement>();

/** Small deterministic PRNG so a stroke looks the same on every device. */
function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function parseColor(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The grain tile for a texture + colour, or null where there is no DOM. */
export function textureTile(texture: StrokeTexture, color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${texture}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const [r, g, b] = parseColor(color);
  const image = ctx.createImageData(TILE, TILE);
  const rand = rng(texture === 'pencil' ? 1337 : 4242);
  // Crayon grain clumps (waxy gaps in blobs); pencil is fine, even graphite tooth.
  const blob = new Float32Array(TILE * TILE);
  if (texture === 'crayon') {
    for (let i = 0; i < blob.length; i += 1) blob[i] = rand();
  }
  for (let y = 0; y < TILE; y += 1) {
    for (let x = 0; x < TILE; x += 1) {
      const i = y * TILE + x;
      let alpha: number;
      if (texture === 'pencil') {
        alpha = 0.5 + rand() * 0.5;
      } else {
        const smooth =
          (blob[i]! + blob[((y + 1) % TILE) * TILE + x]! + blob[y * TILE + ((x + 1) % TILE)]!) / 3;
        alpha = smooth < 0.4 ? 0.12 + rand() * 0.2 : 0.7 + rand() * 0.3;
      }
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  cache.set(key, canvas);
  return canvas;
}
