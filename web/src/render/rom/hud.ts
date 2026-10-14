import type { CharacterAssets } from '../../rom/types';
import type { TileOverride } from './scene';
import { CLOCK_FROZEN_FROM } from '../../core/constants';
import { helmetRecolor, recolorBgr555, type SkinDef } from '../art/charskins';

export const HUD_WORDS = 96;

export function digitTile(d: number): number { return d === 0 ? 0x39 : 0x2f + d; }

function put(w: Uint16Array, row: number, col: number, tile: number): void {
  const i = row * 32 + col;
  w[i] = (w[i] & 0xfc00) | (0x200 + tile);
}

/** Dígitos cujos tiles viram o ∞ enquanto o tempo é infinito (nesse modo nenhum dígito aparece). */
const INF_DIGITS = [1, 2, 3] as const;
const INF_LOOP_W = 13;   // largura de cada volta do ∞ (o "0" da ROM, 8 px, esticado)

/** ∞ no estilo do relógio: duas voltas do "0" da ROM esticadas e sobrepostas, sobre o tile em branco do HUD
 *  (coluna 3 de `hudMap`); 3×3 tiles 8×8 gravados no lugar dos tiles dos dígitos de `INF_DIGITS`. */
export function infinityOverrides(tilePx: Uint8Array, hudMap: Uint16Array): TileOverride[] {
  const at = (tile: number, x: number, y: number): number => tilePx[tile * 64 + y * 8 + x];
  const glyph = (x: number, y: number): number => at(0x200 + digitTile(0) + 0x10 * (y >> 3), x, y & 7);
  const empty = glyph(0, 0);
  const W = 24;
  const cv = new Uint8Array(W * 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < W; x++) cv[y * W + x] = at(hudMap[(y >> 3) * 32 + 3] & 0x3ff, x & 7, y & 7);
  for (const x0 of [0, W - INF_LOOP_W]) for (let y = 0; y < 24; y++) for (let x = 0; x < INF_LOOP_W; x++) {
    const v = glyph(Math.floor((x * 8) / INF_LOOP_W), y);
    if (v !== empty) cv[y * W + x0 + x] = v;
  }
  return INF_DIGITS.flatMap((d, c) => [0, 1, 2].map(r => {
    const px = new Uint8Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px[y * 8 + x] = cv[(r * 8 + y) * W + c * 8 + x];
    return { tile: 0x200 + digitTile(d) + 0x10 * r, px };
  }));
}

/** Palavras das 3 linhas do HUD (mapa do BG1, linhas 28–30). `base` = ArenaAssets.hudMap. */
export function hudWords(base: Uint16Array, sec: number, present: readonly boolean[], crowns: readonly number[],
  crownWord: (n: number) => number): Uint16Array {
  const w = Uint16Array.from(base.subarray(0, HUD_WORDS));
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const ss = t % 60;
  const infinite = sec >= CLOCK_FROZEN_FROM;
  for (let r = 0; r < 3; r++) {
    const R = 0x10 * r;
    if (infinite) {   // tempo infinito: ∞ nas colunas 4–6 (tiles de `infinityOverrides`), 7 em branco
      INF_DIGITS.forEach((d, c) => put(w, r, 4 + c, digitTile(d) + R));
      w[r * 32 + 7] = w[r * 32 + 3];
    } else {
      if (m >= 10) put(w, r, 3, digitTile(Math.floor(m / 10) % 10) + R);
      put(w, r, 4, digitTile(m % 10) + R);
      put(w, r, 5, 0x3a + R);
      put(w, r, 6, digitTile(Math.floor(ss / 10)) + R);
      put(w, r, 7, digitTile(ss % 10) + R);
    }
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

/** Os 6 tiles 8×8 do rosto do personagem no slot (TL, TR, ML, MR, BL, BR; plano 5 D3); `crying` = rosto chorando
 *  do jogador morto (`hudCrying`, entrada c·5+slot de $C4:617F). */
export function headTiles(ch: CharacterAssets, slot: number, crying = false): Uint8Array[] {
  const px = (crying ? ch.hudCry(slot) : ch.hudHead(slot)).px;
  return [0, 1, 2, 3, 4, 5].map(i => px.subarray(i * 64, i * 64 + 64));
}

/** Índices de cor usados pelos tiles do HUD fora da região dos rostos e coroas (colunas 10–29): o fundo e a moldura. */
export function hudFrameIndices(tilePx: Uint8Array, hudMap: Uint16Array): Set<number> {
  const out = new Set<number>();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 32; c++) {
    if (c >= 10 && c <= 29) continue;
    const t = hudMap[r * 32 + c] & 0x3ff;
    for (let i = 0; i < 64; i++) { const v = tilePx[t * 64 + i]; if (v) out.add(v); }
  }
  return out;
}

/**
 * Skins no HUD: o rosto de cada slot usa os mesmos índices da linha de paleta do HUD (a de `src`), então não dá para
 * pintar só um rosto mudando a paleta. Em vez disso, cada skin ganha uma linha de BG livre (que nenhum mapa do quadro
 * usa), com a paleta do HUD pintada, e as 6 palavras do rosto desse slot passam a apontar para ela.
 */
export function paintHudFaces(b: { bg1: Uint16Array; bg2: Uint16Array; cg: Uint16Array }, hudRow: number, src: number,
  skins: readonly (SkinDef | null)[], keep: ReadonlySet<number>): void {
  if (!skins.some(Boolean)) return;
  const used = new Set<number>();
  for (const m of [b.bg1, b.bg2]) for (const w of m) used.add((w >> 10) & 7);
  const free = [0, 1, 2, 3, 4, 5, 6, 7].filter(r => !used.has(r));
  const rowOf = new Map<SkinDef, number>();
  skins.forEach((skin, k) => {
    if (!skin) return;
    let r = rowOf.get(skin);
    if (r === undefined) {
      r = free.shift();
      if (r === undefined) return;   // sem linha livre: o rosto fica como está
      rowOf.set(skin, r);
      const from = b.cg.slice(16 * src, 16 * src + 16), painted = skin.helmet ? helmetRecolor(from, skin) : recolorBgr555(from, skin);
      keep.forEach(i => { painted[i] = from[i]; });   // fundo do painel e moldura do HUD não mudam de cor
      b.cg.set(painted, 16 * r);
    }
    for (let line = 0; line < 3; line++) for (const col of [10 + 4 * k, 11 + 4 * k]) {
      const i = (hudRow + line) * 32 + col;
      b.bg1[i] = (b.bg1[i] & ~0x1c00) | (r << 10);
    }
  });
}

export function headOverrides(heads: readonly (Uint8Array[] | null)[]): TileOverride[] {
  const out: TileOverride[] = [];
  heads.forEach((h, slot) => {
    if (h) faceTileIds(slot).forEach((tile, i) => out.push({ tile, px: h[i] }));
  });
  return out;
}
