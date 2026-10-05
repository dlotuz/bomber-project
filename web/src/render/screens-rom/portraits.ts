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

/** As 16 cores como estão em `$C1:B3C3`. No pacote embutido (`public/rom-pack.dat`, só as faixas que o jogo leu ao
 *  gerar o pacote) as combinações (slot, personagem) que ninguém desenhou vêm zeradas. */
function romPortraitPalette(a: RomAssets, slot: number, char: number): Uint16Array {
  const list = a.rom.p24(PORTRAIT_PAL_TABLE + 3 * slot);
  const pal = a.rom.p24(list + 3 * Math.min(Math.max(char, 0), 8));
  const out = new Uint16Array(16);
  for (let i = 0; i < 16; i++) out[i] = a.rom.u16(pal + 2 * i);
  return out;
}
const blank = (p: Uint16Array): boolean => p.every(v => v === 0);

const rgb = (v: number): [number, number, number] => [v & 31, (v >> 5) & 31, (v >> 10) & 31];
const dist = (a: number, b: number): number => { const A = rgb(a), B = rgb(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const luma = (v: number): number => { const c = rgb(v); return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; };

/**
 * Paleta de retrato que falta no pacote, montada a partir das paletas do boneco (`character(char).palettes`, que vêm
 * completas): cada cor do retrato segue a cor do boneco que melhor a explica nos slots conhecidos (o slot 0 sempre
 * está no pacote) e ganha a cor do boneco no slot pedido, com o brilho da cor original do retrato. Cores iguais em
 * todos os slots conhecidos (pele, olhos, contorno) ficam como estão. Conferido contra as combinações que existem:
 * não fica idêntico ao original, mas na mesma cor do jogador.
 */
function derivedPortraitPalette(a: RomAssets, slot: number, char: number): Uint16Array {
  const spr = a.character(char).palettes;
  const known: { por: Uint16Array; spr: Uint16Array }[] = [];
  for (let s = 0; s < spr.length; s++) {
    const por = romPortraitPalette(a, s, char);
    if (!blank(por)) known.push({ por, spr: spr[s] });
  }
  const target = spr[slot];
  if (!known.length || !target) return romPortraitPalette(a, slot, char);
  const { por: p0, spr: s0 } = known[0];
  // fundo do quadrinho (cor 15): é do slot, não do personagem — o de outro personagem nesse slot que esteja no pacote
  let back = p0[15];
  for (let c = 0; c <= NO_CHAR; c++) { const o = romPortraitPalette(a, slot, c); if (!blank(o)) { back = o[15]; break; } }
  return p0.map((v, i) => {
    if (i === 15) return back;
    if (i < 2) return v;   // transparente e contorno
    if (known.length > 1 && known.every(k => k.por[i] === v)) return v;
    let j = 2, best = Infinity;
    for (let k = 2; k < 15; k++) {
      const e = known.reduce((sum, kn) => sum + dist(kn.por[i], kn.spr[k]), 0);
      if (e < best) { best = e; j = k; }
    }
    if (known.length === 1 && s0[j] === target[j]) return v;
    const f = (luma(v) + 0.5) / (luma(s0[j]) + 0.5);
    const [r, g, b] = rgb(target[j]).map(x => Math.max(0, Math.min(31, Math.round(x * f))));
    return r | (g << 5) | (b << 10);
  });
}

/** 16 cores BGR555 do retrato de `char` no slot `slot` (0..4), lidas da ROM (ou montadas, se faltam no pacote —
 *  ver `derivedPortraitPalette`; sem isso o retrato sai preto quando dois jogadores pegam o mesmo personagem). */
export function portraitPalette(a: RomAssets, slot: number, char: number): Uint16Array {
  const pal = romPortraitPalette(a, slot, char);
  return blank(pal) && char < NO_CHAR ? derivedPortraitPalette(a, slot, char) : pal;
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
