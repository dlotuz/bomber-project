import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const CAPTURES: string | null = process.env.SB4_CAPTURES ?? null;
export interface Capture { vram: Uint8Array; cgram: Uint16Array; oam: Uint8Array; ppu: Uint8Array }

export function loadCapture(name: string): Capture | null {
  if (!CAPTURES) return null;
  const p = (ext: string) => join(CAPTURES, `${name}.${ext}`);
  if (!existsSync(p('vram'))) return null;
  const cg = readFileSync(p('cgram'));
  return {
    vram: new Uint8Array(readFileSync(p('vram'))),
    cgram: new Uint16Array(cg.buffer.slice(cg.byteOffset, cg.byteOffset + 512)),
    oam: new Uint8Array(readFileSync(p('oam'))),
    ppu: new Uint8Array(readFileSync(p('ppu'))),
  };
}
/** Mapa de BG a partir de um endereço de palavra da VRAM (BG1 = $4000, BG2 = $4400, BG3 = $5400). */
export function capturedMap(c: Capture, wordAddr: number, w = 32, h = 32): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = c.vram[(wordAddr + i) * 2] | (c.vram[(wordAddr + i) * 2 + 1] << 8);
  return out;
}
export interface OamRow { i: number; x: number; y: number; tile: number; pal: number; prio: number; h: boolean; v: boolean; big: boolean }
/** OAM padrão do SNES: 128 × 4 bytes + tabela alta de 32 bytes (bit 0 = x8, bit 1 = tamanho). */
export function parseOam(oam: Uint8Array): OamRow[] {
  const rows: OamRow[] = [];
  for (let i = 0; i < 128; i++) {
    const hi = (oam[512 + (i >> 2)] >> ((i & 3) * 2)) & 3;
    let x = oam[i * 4] | ((hi & 1) << 8); if (x >= 256) x -= 512;
    const attr = oam[i * 4 + 3];
    rows.push({ i, x, y: oam[i * 4 + 1], tile: oam[i * 4 + 2] | ((attr & 1) << 8), pal: (attr >> 1) & 7, prio: (attr >> 4) & 3,
      h: (attr & 0x40) !== 0, v: (attr & 0x80) !== 0, big: (hi & 2) !== 0 });
  }
  return rows.filter(r => r.y < 224 || r.y >= 240);   // y 224..239 = escondido
}
export interface Rect { x0: number; y0: number; x1: number; y1: number }   // px, inclusivo
/** Fração de casas 16×16 iguais entre dois mapas, ignorando as casas que tocam algum retângulo (texto). */
export function mapMatch(a: Uint16Array, b: Uint16Array, ignore: readonly Rect[] = [], hofs = 0, vofs = 0): number {
  let same = 0, total = 0;
  for (let lin = 0; lin < 14; lin++) for (let col = 0; col < 16; col++) {
    const x = col * 16 - hofs, y = lin * 16 - vofs;
    if (ignore.some(r => x + 15 >= r.x0 && x <= r.x1 && y + 15 >= r.y0 && y <= r.y1)) continue;
    total++;
    if (a[lin * 32 + col] === b[lin * 32 + col]) same++;
  }
  return total ? same / total : 1;
}
