/** Imagem RGBA pura (sem DOM), usada para gerar toda a pixel art por código. */
export interface Pix { w: number; h: number; data: Uint8ClampedArray }

export type Palette = Record<string, string | null>;

export function makePix(w: number, h: number): Pix {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function setPx(p: Pix, x: number, y: number, hex: string): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
  const [r, g, b] = hexToRgb(hex);
  const i = (y * p.w + x) * 4;
  p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255;
}

export function alphaAt(p: Pix, x: number, y: number): number {
  return p.data[(y * p.w + x) * 4 + 3];
}

export function fillRect(p: Pix, x: number, y: number, w: number, h: number, hex: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(p, xx, yy, hex);
}

/** Converte linhas de caracteres em pixels. Caractere sem cor (ou null) = transparente. */
export function fromRows(rows: readonly string[], pal: Palette): Pix {
  const h = rows.length, w = rows[0].length;
  const p = makePix(w, h);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`linha ${y} tem ${row.length} colunas, esperado ${w}`);
    for (let x = 0; x < w; x++) {
      const c = pal[row[x]];
      if (c) setPx(p, x, y, c);
    }
  });
  return p;
}

/** Copia `src` sobre `dst` em (dx,dy), respeitando transparência. */
export function blit(dst: Pix, src: Pix, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4;
    if (src.data[si + 3] === 0) continue;
    const tx = dx + x, ty = dy + y;
    if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
    const di = (ty * dst.w + tx) * 4;
    dst.data[di] = src.data[si]; dst.data[di + 1] = src.data[si + 1];
    dst.data[di + 2] = src.data[si + 2]; dst.data[di + 3] = src.data[si + 3];
  }
}

export function flipH(src: Pix): Pix {
  const p = makePix(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const si = (y * src.w + x) * 4, di = (y * src.w + (src.w - 1 - x)) * 4;
    for (let k = 0; k < 4; k++) p.data[di + k] = src.data[si + k];
  }
  return p;
}

/** Ruído determinístico por coordenada (0..255), para texturas. */
export function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h ^= h >>> 13; h = Math.imul(h, 1103515245);
  return (h >>> 16) & 255;
}
