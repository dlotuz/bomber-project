// Tiles planares do SNES → índices [GFX §2.5].
import type { Tiles } from '../types';

/** Decodifica `count` tiles `bpp` (2 ou 4) a partir de `off` em `bytes`. Bytes além do fim contam como 0. */
export function decodeTiles(bytes: Uint8Array, bpp: 2 | 4, off = 0, count = Math.floor((bytes.length - off) / (8 * bpp))): Tiles {
  const size = 8 * bpp, px = new Uint8Array(count * 64);
  for (let t = 0; t < count; t++) {
    const base = off + t * size;
    for (let y = 0; y < 8; y++) {
      const p0 = bytes[base + 2 * y] ?? 0, p1 = bytes[base + 2 * y + 1] ?? 0;
      const p2 = bpp === 4 ? bytes[base + 16 + 2 * y] ?? 0 : 0, p3 = bpp === 4 ? bytes[base + 17 + 2 * y] ?? 0 : 0;
      for (let x = 0; x < 8; x++) {
        const bit = 7 - x;
        px[t * 64 + y * 8 + x] = ((p0 >> bit) & 1) | (((p1 >> bit) & 1) << 1) | (((p2 >> bit) & 1) << 2) | (((p3 >> bit) & 1) << 3);
      }
    }
  }
  return { bpp, count, px };
}
