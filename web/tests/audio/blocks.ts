/** Leitura dos blocos IPL e dos sets de samples pela imagem (como romaudio.py [AUD §1.2]), para o golden de RAM. */
import type { AudioImage } from '../../src/audio/host/image';

export type Seg = [number, Uint8Array];

export function blockSegments(img: AudioImage, id: number): Seg[] {
  let p = img.u24(0xc00190 + 3 * id);
  const out: Seg[] = [];
  for (;;) {
    const n = img.u16(p);
    if (!n) return out;
    const d = img.u16(p + 2);
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = img.u8(p + 4 + i);
    out.push([d, b]);
    p += 4 + n;
  }
}

export function sampleSetSegments(img: AudioImage, k: number): { list: Seg[]; samples: Seg[] } {
  const desc = 0xda0000 | img.u16(0xda17d2 + 2 * k);
  let up = 0xda0000 | img.u16(desc);
  const list: Seg[] = [];
  for (;;) {
    const n = img.u16(up);
    if (!n) break;
    const d = img.u16(up + 2);
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = img.u8(up + 4 + i);
    list.push([d, b]); up += 4 + n;
  }
  let dest = img.u16(desc + 2);
  const samples: Seg[] = [];
  for (let y = desc + 4; img.u8(y) !== 0xff; y++) {
    const s = img.u8(y);
    const len = img.u16(0xda2238 + 2 * s), at = img.u24(0xda2118 + 3 * s);
    const b = new Uint8Array(len);
    for (let i = 0; i < len; i++) b[i] = img.u8(at + i);
    samples.push([dest, b]); dest = (dest + len) & 0xffff;
  }
  return { list, samples };
}

/** Quantos bytes dos segmentos a RAM tem iguais / diferentes (ignora $00F0–$00FF, que são MMIO). */
export function compareSegs(ram: Uint8Array, segs: Seg[]): { bytes: number; diffs: number } {
  let bytes = 0, diffs = 0;
  for (const [d, b] of segs) for (let i = 0; i < b.length; i++) {
    const a = d + i;
    if (a > 0xffff || (a >= 0xf0 && a <= 0xff)) continue;
    bytes++;
    if (ram[a] !== b[i]) diffs++;
  }
  return { bytes, diffs };
}
