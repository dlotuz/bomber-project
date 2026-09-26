// RLE duplo do Modo 7 [GFX §2.4] ($C4:6201). Porte de decomp.decode_m7rle.
import { hiromOffset } from '../view';

export interface M7Result { vram: Uint8Array; usedPix: number; usedMap: number }

/** Gera `words` palavras de VRAM: byte baixo = mapa (fluxo em `mapAddr`), byte alto = pixel (fluxo em `pixAddr`). */
export function decodeM7Rle(rom: Uint8Array, pixAddr: number, mapAddr: number, words = 0x4000): M7Result {
  let p = hiromOffset(pixAddr), m = hiromOffset(mapAddr);
  const p0 = p, m0 = m, out = new Uint8Array(words * 2);
  let cp = 0, cm = 0, vp = 0, vm = 0;
  for (let k = 0; k < words; k++) {
    if (cp) cp--;
    else {
      const b = rom[p];
      if (b & 0x80) { vp = b & 0x7f; cp = (rom[p + 1] - 1) & 0xff; p += 2; }
      else { vp = b; p += 1; }
    }
    if (cm) cm--;
    else {
      const b = rom[m];
      if (b === 0x01) { cm = (rom[m + 1] - 1) & 0xff; vm = rom[m + 2]; m += 3; }
      else { vm = b; m += 1; }
    }
    out[2 * k] = vm; out[2 * k + 1] = vp;
  }
  return { vram: out, usedPix: p - p0, usedMap: m - m0 };
}
