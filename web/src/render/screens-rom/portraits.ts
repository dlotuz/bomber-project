// Retratos 32×32 dos personagens (revisão final do plano 10, I6): uma origem só na ROM para o placar e a seleção de
// personagem/equipes.
//
// - **Pixels:** a folha ZTE `$CD:E585` (4096 B = 128 tiles 4bpp, 16 de largura; 8 retratos de 4×4 tiles). A cena
//   `scoreboard` a carrega inteira em OBJ `$80` (VRAM `$D000`) e a `charsel` em BG `$200` (VRAM `$4000`) — é carga
//   estática do CAT, não DMA por personagem. Ordem na folha (medida nas capturas `scoreboard`/`charsel` e conferida
//   em 40 capturas de `montarias-e-telas` pelo casamento pixel a pixel com a paleta de cada personagem):
//   0 BLANCO, 1 GEAR, 2 TIGRA, 3 "×" (sem personagem), 4 RUBI, 5 AERO, 6 VERDI, 7 vazio.
// - **Cor:** tabela `$C1:B3C3` = 5 ponteiros (um por slot/jogador) para listas de 9 ponteiros (um por personagem, e
//   6–8 = o "×") de 16 cores em `$D6:7xxx`. Paleta = p24(p24($C1:B3C3 + 3·slot) + 3·personagem). Conferido: as
//   linhas OBJ 0–4 do placar e BG 2/3/4/0/7 da `charsel` são exatamente essas entradas.
// - **Onde a ROM usa:** placar = OBJ 32×32 no tile `$80 + desl`, paleta OBJ = slot; `charsel` = BG1 (tile16
//   `$200 + desl`), colunas 1–2, linhas 2+2·slot, com a paleta de BG da linha `CHARSEL_PORTRAIT_PAL[slot]`.
import type { RomAssets, Tiles } from '../../app/rom-api';
import { tilesFrom, zteBlock } from '../../app/rom-api';
import type { ObjEntry } from '../../app/rom-api';

export const PORTRAIT_SHEET_ADDR = 0xcde585;
export const PORTRAIT_PAL_TABLE = 0xc1b3c3;
/** Personagem (0..5, ordem de `CHARACTERS`) → retrato na folha. `NO_CHAR` (= 6, a 1ª entrada "×" da tabela de
 *  paletas) → o "×" da folha. */
export const PORTRAIT_OF_CHAR: readonly number[] = [0, 1, 2, 5, 6, 4, 3];
export const NO_CHAR = 6;
/** Deslocamento do retrato `i` na folha de 16 tiles de largura (4 retratos por faixa de 4 tiles de altura). */
export const portraitSheetOffset = (char: number): number => {
  const i = PORTRAIT_OF_CHAR[char] ?? PORTRAIT_OF_CHAR[NO_CHAR];
  return (i >> 2) * 64 + (i & 3) * 4;
};
/** Tile OBJ do retrato na cena `scoreboard` (folha em OBJ `$80`). */
export const scoreboardPortraitTile = (char: number): number => 0x80 + portraitSheetOffset(char);
/** Tile16 de BG do retrato na cena `charsel` (folha em BG `$200`). */
export const charselPortraitTile = (char: number): number => 0x200 + portraitSheetOffset(char);

/** 16 cores BGR555 do retrato de `char` no slot `slot` (0..4), lidas da ROM. */
export function portraitPalette(a: RomAssets, slot: number, char: number): Uint16Array {
  const list = a.rom.p24(PORTRAIT_PAL_TABLE + 3 * slot);
  const pal = a.rom.p24(list + 3 * Math.min(Math.max(char, 0), 8));
  const out = new Uint16Array(16);
  for (let i = 0; i < 16; i++) out[i] = a.rom.u16(pal + 2 * i);
  return out;
}

/** Cópia de `cgram` com a paleta do retrato de cada slot gravada na linha `rows[slot]` (0..15 da CGRAM). */
export function withPortraitPalettes(a: RomAssets, cgram: Uint16Array, chars: readonly number[], rows: readonly number[]): Uint16Array {
  const out = cgram.slice();
  chars.forEach((c, slot) => { if (rows[slot] !== undefined) out.set(portraitPalette(a, slot, c), 16 * rows[slot]); });
  return out;
}

const sheetCache = new WeakMap<RomAssets, Tiles>();
function sheet(a: RomAssets): Tiles {
  let t = sheetCache.get(a);
  if (!t) { t = tilesFrom(zteBlock(a, PORTRAIT_SHEET_ADDR), 0, 128, 4); sheetCache.set(a, t); }
  return t;
}
const pxCache = new WeakMap<RomAssets, Map<number, Uint8Array>>();
/** 32×32 índices de cor (0 = transparente) do retrato de `char`, direto da folha `$CD:E585`. */
export function portraitPixels(a: RomAssets, char: number): Uint8Array {
  let m = pxCache.get(a);
  if (!m) { m = new Map(); pxCache.set(a, m); }
  const off = portraitSheetOffset(char);
  let px = m.get(off);
  if (!px) {
    const t = sheet(a);
    px = new Uint8Array(32 * 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const n = off + (y >> 3) * 16 + (x >> 3);
      px[y * 32 + x] = t.px[n * 64 + (y & 7) * 8 + (x & 7)];
    }
    m.set(off, px);
  }
  return px;
}

/** OBJ 32×32 pronto (pixels da folha) do retrato de `char`, na paleta OBJ `pal`, prioridade 3. */
export function portraitObj(a: RomAssets, x: number, y: number, char: number, pal: number): ObjEntry {
  return { x, y, size: 32, pal, prio: 3, hflip: false, vflip: false, src: { px: portraitPixels(a, char) } };
}
