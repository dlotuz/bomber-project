// Personagens [ANI §2.3–2.5, GFX §3.3] e rostos do HUD ($C4:6170/$C4:617F/$C4:61F7).
import type { CharacterAssets, Tiles } from './types';
import type { RomView } from './view';
import { decodeTiles } from './decode/tiles';
import { readBgr555 } from './decode/palette';
import { decodeZte } from './decode/zte';

export const CHAR_SHEETS = 0xc20730, VICTORY_SHEETS = 0xc28ebf, CHAR_PALETTES = 0xc2779d;
export const HUD_HEAD_BLOCKS = 0xc46170, HUD_HEAD_SRC = 0xc4617f, HUD_HEAD_DST = 0xc461f7;

/** Quadro 32×32 (índices) de uma folha de 16 tiles de largura: g → +(g&3)·$80 + (g>>2)·$800, linhas de tiles a cada $200. */
export function sheetFrame(rom: RomView, sheet: number, g: number): Uint8Array {
  const base = sheet + (g & 3) * 0x80 + (g >> 2) * 0x800, out = new Uint8Array(1024);
  for (let r = 0; r < 4; r++) {
    const t = decodeTiles(rom.bytes(base + r * 0x200, 128), 4);
    for (let k = 0; k < 4; k++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      out[(r * 8 + y) * 32 + k * 8 + x] = t.px[k * 64 + y * 8 + x];
  }
  return out;
}

/** Buffer $7F:208C: os 5 blocos ZTE de $C4:6170 em $1000·i (20 KB). */
export function hudHeadBuffer(rom: RomView): Uint8Array {
  const buf = new Uint8Array(0x5000);
  for (let i = 0; i < 5; i++) buf.set(decodeZte(rom.data, rom.p24(HUD_HEAD_BLOCKS + 3 * i)).data.subarray(0, 0x1000), 0x1000 * i);
  return buf;
}

/** Rosto do HUD da entrada `e` (= $4A·5 + slot): 3 linhas de 2 tiles (64 B) a partir de buffer + u16($C4:617F + 2e), linhas a cada $200.
 *  Ordem dos 6 tiles: (0,0) (1,0) (0,1) (1,1) (0,2) (1,2) — vão para os tiles de BG $201+2·slot, +1, +$10, +$11, +$20, +$21. */
export function hudHeadTiles(rom: RomView, buf: Uint8Array, e: number): Tiles {
  const src = rom.u16(HUD_HEAD_SRC + 2 * e), raw = new Uint8Array(192);
  for (let r = 0; r < 3; r++) raw.set(buf.subarray(src + r * 0x200, src + r * 0x200 + 64), 64 * r);
  return decodeTiles(raw, 4);
}

export function loadCharacter(rom: RomView, c: number, heads: () => Uint8Array): CharacterAssets {
  if (!(c >= 0 && c <= 5)) throw new RangeError(`personagem inválido: ${c}`);
  const sheet = rom.p24(CHAR_SHEETS + 3 * c), vsheet = rom.p24(VICTORY_SHEETS + 3 * c);
  const frames = new Map<number, Uint8Array>(), victoryFrames = new Map<number, Uint8Array>(), hudHeads = new Map<number, Tiles>();
  return {
    char: c,
    frame: g => { let f = frames.get(g); if (!f) { f = sheetFrame(rom, sheet, g); frames.set(g, f); } return f; },
    palettes: Array.from({ length: 5 }, (_, s) => readBgr555(rom.bytes(rom.p24(CHAR_PALETTES + 32 * c + 4 * s), 32), 0, 16)),
    victoryFrame: g => {
      if (!(g >= 0 && g <= 3)) throw new RangeError(`quadro de vitória inválido: ${g}`);
      let f = victoryFrames.get(g); if (!f) { f = sheetFrame(rom, vsheet, g); victoryFrames.set(g, f); } return f;
    },
    hudHead: slot => {
      if (!(slot >= 0 && slot <= 4)) throw new RangeError(`slot de rosto do HUD inválido: ${slot}`);
      let t = hudHeads.get(slot); if (!t) { t = hudHeadTiles(rom, heads(), (6 + c) * 5 + slot); hudHeads.set(slot, t); } return t;
    },
  };
}
