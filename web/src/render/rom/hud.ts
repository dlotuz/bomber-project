import type { CharacterAssets } from '../../rom/types';
import type { TileOverride } from './scene';

export const HUD_WORDS = 96;

export function digitTile(d: number): number { return d === 0 ? 0x39 : 0x2f + d; }

function put(w: Uint16Array, row: number, col: number, tile: number): void {
  const i = row * 32 + col;
  w[i] = (w[i] & 0xfc00) | (0x200 + tile);
}

/** Palavras das 3 linhas do HUD (mapa do BG1, linhas 28–30). `base` = ArenaAssets.hudMap. */
export function hudWords(base: Uint16Array, sec: number, present: readonly boolean[], crowns: readonly number[],
  crownWord: (n: number) => number): Uint16Array {
  const w = Uint16Array.from(base.subarray(0, HUD_WORDS));
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const ss = t % 60;
  for (let r = 0; r < 3; r++) {
    const R = 0x10 * r;
    if (m >= 10) put(w, r, 3, digitTile(Math.floor(m / 10) % 10) + R);
    put(w, r, 4, digitTile(m % 10) + R);
    put(w, r, 5, 0x3a + R);
    put(w, r, 6, digitTile(Math.floor(ss / 10)) + R);
    put(w, r, 7, digitTile(ss % 10) + R);
    for (let k = 0; k < 5; k++) {
      if (!present[k]) continue;
      put(w, r, 10 + 4 * k, 0x01 + 2 * k + R);
      put(w, r, 11 + 4 * k, 0x02 + 2 * k + R);
    }
  }
  for (let k = 0; k < 5; k++) if (present[k]) w[32 + 12 + 4 * k] = crownWord(crowns[k] ?? 0);
  return w;
}

/** Tiles de BG do rosto do slot, na ordem TL, TR, ML, MR, BL, BR. */
export function faceTileIds(slot: number): number[] {
  const b = 0x201 + 2 * slot;
  return [b, b + 1, b + 16, b + 17, b + 32, b + 33];
}

/** Os 6 tiles 8×8 do rosto do personagem no slot (TL, TR, ML, MR, BL, BR; plano 5 D3). */
export function headTiles(ch: CharacterAssets, slot: number): Uint8Array[] {
  const px = ch.hudHead(slot).px;
  return [0, 1, 2, 3, 4, 5].map(i => px.subarray(i * 64, i * 64 + 64));
}

export function headOverrides(heads: readonly (Uint8Array[] | null)[]): TileOverride[] {
  const out: TileOverride[] = [];
  heads.forEach((h, slot) => {
    if (h) faceTileIds(slot).forEach((tile, i) => out.push({ tile, px: h[i] }));
  });
  return out;
}
