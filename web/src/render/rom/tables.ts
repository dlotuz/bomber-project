import type { RomAssets } from '../../rom/types';

export const ITEM_TABLE = 0xc15fe0;     // 4 B por ID ($00..$2F): u16 palavra do BG2, u16 lógico (lido em $C1:5D00)
export const CROWN_TABLE = 0xc45d11;    // u16 por nº de coroas (0..9): palavra do HUD
export const TEAM_PALETTES = 0xc27b9d;  // mesmo formato de $C2:779D: ptr24 + atributo, índice c·32 + slot·4 (A1)

export interface RomTables {
  itemWord(id: number): number;
  crownWord(n: number): number;
  teamPalette(char: number, slot: number): Uint16Array;
}

const cache = new WeakMap<RomAssets, RomTables>();

export function romTables(a: RomAssets): RomTables {
  const hit = cache.get(a);
  if (hit) return hit;
  const rom = a.rom;
  const items = new Map<number, number>();
  const pals = new Map<number, Uint16Array>();
  const t: RomTables = {
    itemWord(id) {
      const k = id & 0x3f;
      let w = items.get(k);
      if (w === undefined) { w = rom.u16(ITEM_TABLE + 4 * k); items.set(k, w); }
      return w;
    },
    crownWord: n => rom.u16(CROWN_TABLE + 2 * Math.max(0, Math.min(9, n))),
    teamPalette(char, slot) {
      const key = char * 8 + slot;
      let p = pals.get(key);
      if (!p) {
        const src = rom.p24(TEAM_PALETTES + 32 * char + 4 * slot);
        p = Uint16Array.from({ length: 16 }, (_, i) => rom.u16(src + 2 * i));
        pals.set(key, p);
      }
      return p;
    },
  };
  cache.set(a, t);
  return t;
}
