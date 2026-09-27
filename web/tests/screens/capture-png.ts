// PNG das capturas (RGB/RGBA 8 bits, sem entrelaçamento) → RGBA 256×224, para comparar pixels do nosso PPU com o
// quadro original (revisão final do plano 10: scrolls medidos por pixel, retratos, coroas).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { CAPTURES } from './captures';

export interface Rgba { w: number; h: number; data: Uint8Array }

export function decodePng(buf: Uint8Array): Rgba {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 8, w = 0, h = 0, type = 0;
  const idat: Uint8Array[] = [];
  while (o < buf.length) {
    const len = dv.getUint32(o), kind = String.fromCharCode(...buf.subarray(o + 4, o + 8));
    const body = buf.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') {
      w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); type = body[9];
      if (body[8] !== 8 || body[12] !== 0 || (type !== 2 && type !== 6)) throw new Error('PNG não suportado');
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : 3, stride = w * bpp;
  const cur = new Uint8Array(stride), prev = new Uint8Array(stride);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = (line[i] + p) & 0xff;
    }
    for (let x = 0; x < w; x++) {
      out.set([cur[x * bpp], cur[x * bpp + 1], cur[x * bpp + 2], 255], (y * w + x) * 4);
    }
    prev.set(cur);
  }
  return { w, h, data: out };
}

/** `<nome>.png` de SB4_CAPTURES, ou null. */
export function loadCapturePng(name: string): Rgba | null {
  if (!CAPTURES) return null;
  const p = join(CAPTURES, `${name}.png`);
  return existsSync(p) ? decodePng(new Uint8Array(readFileSync(p))) : null;
}

export interface PxRect { x0: number; y0: number; x1: number; y1: number }   // inclusivo
/** Fração de pixels iguais (tolerância `tol` por canal: as capturas convertem BGR555 → RGB de outro jeito) entre
 *  `ours` (RGBA 256×224) e a captura, dentro de `area` (padrão: a tela toda) e fora de `ignore`. */
export function pixelMatch(ours: Uint8Array | Uint8ClampedArray, cap: Rgba, ignore: readonly PxRect[] = [],
  area: PxRect = { x0: 0, y0: 0, x1: 255, y1: 223 }, tol = 8): number {
  let ok = 0, tot = 0;
  for (let y = area.y0; y <= area.y1; y++) for (let x = area.x0; x <= area.x1; x++) {
    if (ignore.some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) continue;
    const i = (y * 256 + x) * 4;
    tot++;
    if (Math.abs(ours[i] - cap.data[i]) <= tol && Math.abs(ours[i + 1] - cap.data[i + 1]) <= tol && Math.abs(ours[i + 2] - cap.data[i + 2]) <= tol) ok++;
  }
  return tot ? ok / tot : 1;
}
