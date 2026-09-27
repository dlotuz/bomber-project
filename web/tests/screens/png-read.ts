import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { CAPTURES } from './captures';

export interface Rgb { w: number; h: number; px: Uint8Array /* RGB, 3 bytes por pixel */ }

/** Decodifica PNG 8 bits RGB/RGBA sem entrelaçamento (formato das capturas `cenas/*.png`). */
export function decodePng(buf: Uint8Array): Rgb {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 8, w = 0, h = 0, ch = 3;
  const idat: Uint8Array[] = [];
  while (p < buf.length) {
    const len = dv.getUint32(p), type = String.fromCharCode(...buf.subarray(p + 4, p + 8));
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); ch = data[9] === 6 ? 4 : 3; if (data[8] !== 8 || data[12]) throw new Error('PNG não suportado'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, cur = new Uint8Array(stride), prev = new Uint8Array(stride);
  const px = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) px.set(cur.subarray(x * ch, x * ch + 3), (y * w + x) * 3);
    prev.set(cur);
  }
  return { w, h, px };
}

/** PNG da captura `cenas/<nome>.png`, ou null sem SB4_CAPTURES. */
export function capturePng(name: string): Rgb | null {
  if (!CAPTURES) return null;
  const f = join(CAPTURES, `${name}.png`);
  return existsSync(f) ? decodePng(new Uint8Array(readFileSync(f))) : null;
}

export const rgbAt = (img: Rgb, x: number, y: number): number[] => { const i = (y * img.w + x) * 3; return [img.px[i], img.px[i + 1], img.px[i + 2]]; };
export const imgAt = (img: ImageData, x: number, y: number): number[] => { const i = (y * 256 + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
