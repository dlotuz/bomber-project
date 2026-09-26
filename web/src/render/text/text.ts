// Motor de texto: um estilo por fonte da ROM (glifos recortados de faixas da ROM em tempo de execução + glifos próprios)
// e o fallback com a fonte atual quando não há ROM ou o estilo ainda não tem mapa.
import type { SpriteBank } from '../sprite-bank';
import { pixToCanvas } from '../sprite-bank';
import { romState, tilesFrom, sceneVramCgram, zteBlock, readColors, bgr555ToRgba, type RomAssets } from '../../app/rom-api';
import type { ExtraGlyph, GlyphCut, GlyphMask, IndexedImage, StripSource, StyleRomDef, TextStyleId, Tone } from './types';
import { GLYPH_MAPS } from './glyph-maps';
import { EXTRA_GLYPHS } from './extra-glyphs';
import { FALLBACK_EXTRA, fallbackPix } from './fallback-font';
import { S } from './strings';
export { fallbackMissing } from './fallback-font';

export interface RomFont { style: TextStyleId; def: StyleRomDef; glyphs: Map<string, IndexedImage> }

const HEX = '0123456789abcdef';
export function parseExtra(g: ExtraGlyph): IndexedImage {
  const w = g.rows[0]?.length ?? 0, h = g.rows.length;
  const px = new Uint8Array(w * h);
  g.rows.forEach((r, y) => [...r].forEach((c, x) => { px[y * w + x] = c === '.' ? 0 : g.legend ? (g.legend[c] ?? 0) : HEX.indexOf(c); }));
  return { w, h, px };
}

function crop(src: IndexedImage, x: number, y: number, w: number, h: number): IndexedImage {
  const px = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px[j * w + i] = src.px[(y + j) * src.w + x + i] ?? 0;
  return { w, h, px };
}

/** Deixa no recorte só a letra das sementes (ver `GlyphMask`). Sementes fora do recorte ou fora de `fill` são ignoradas. */
export function maskCut(g: IndexedImage, seeds: readonly (readonly [number, number])[], m: GlyphMask): IndexedImage {
  const { w, h, px } = g, fill = new Set(m.fill), edge = new Set(m.edge);
  const keep = new Uint8Array(w * h), stack: number[] = [];
  for (const [x, y] of seeds) {
    const i = y * w + x;
    if (x >= 0 && y >= 0 && x < w && y < h && fill.has(px[i]) && !keep[i]) { keep[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const j = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !keep[j] && fill.has(px[j])) { keep[j] = 1; stack.push(j); }
    }
  }
  for (let k = 0; k < m.grow; k++) {
    const add: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (keep[i] || !edge.has(px[i])) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && keep[ny * w + nx]) { near = true; break; }
      }
      if (near) add.push(i);
    }
    for (const i of add) keep[i] = 1;
  }
  return { w, h, px: px.map((v, i) => (keep[i] ? v : 0)) };
}

/** Zera todo pixel cujo índice não esteja em `body` (mantém só o corpo/brilho da letra, sem o contorno). */
function applyBodyOnly(g: IndexedImage, body: readonly number[]): IndexedImage {
  const set = new Set(body);
  return { w: g.w, h: g.h, px: g.px.map(v => (set.has(v) ? v : 0)) };
}

function cutGlyph(s: IndexedImage, c: GlyphCut, def: StyleRomDef): IndexedImage {
  const y = c.y ?? 0;
  let g = crop(s, c.x, y, c.w, c.h ?? def.height);
  if (c.seeds && def.mask) g = maskCut(g, c.seeds.map(([sx, sy]) => [sx - c.x, sy - y] as const), def.mask);
  if (def.bodyOnly) g = applyBodyOnly(g, def.bodyOnly);
  return g;
}

const CONN4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const CONN8 = [...CONN4, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Redesenha o contorno depois de montar a frase (ver `StyleRomDef.outline`): `width` camadas de vizinhos
 *  (`conn` 4 ou 8, padrão 8) a partir de qualquer pixel não nulo, sem sobrescrever pixel já preenchido. Com
 *  `below`, um pixel novo com corpo em cima (vizinho na linha −1) usa `below`; senão usa `index`. */
function addOutline(img: IndexedImage, o: { index: number; width?: number; conn?: 4 | 8; below?: number }): IndexedImage {
  const { w, h } = img;
  let px = img.px;
  const dirs = o.conn === 4 ? CONN4 : CONN8;
  for (let k = 0, layers = o.width ?? 1; k < layers; k++) {
    const next = px.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (px[i]) continue;
      let near = false, above = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && px[ny * w + nx]) { near = true; if (dy === -1) above = true; }
      }
      if (near) next[i] = above && o.below !== undefined ? o.below : o.index;
    }
    px = next;
  }
  return { w, h, px };
}

/** Glifo `base` com os pixels não nulos de `over` por cima (a partir do canto de cima à esquerda). */
function overlay(base: IndexedImage, over: IndexedImage): IndexedImage {
  const px = base.px.slice();
  for (let y = 0; y < Math.min(base.h, over.h); y++) for (let x = 0; x < Math.min(base.w, over.w); x++) {
    const v = over.px[y * over.w + x];
    if (v) px[y * base.w + x] = v;
  }
  return { w: base.w, h: base.h, px };
}

export function fontFromParts(style: TextStyleId, def: StyleRomDef, strips: Record<string, IndexedImage>, extras: readonly ExtraGlyph[]): RomFont {
  const glyphs = new Map<string, IndexedImage>();
  for (const g of extras) if (!g.base) glyphs.set(g.ch, parseExtra(g));
  for (const c of def.cuts) {
    const s = strips[c.strip];
    if (s) glyphs.set(c.ch, cutGlyph(s, c, def));   // recorte da ROM vence
  }
  for (const g of extras) {                          // acentos sobre a letra-base (da ROM ou própria)
    const b = g.base ? glyphs.get(g.base) : undefined;
    if (b) glyphs.set(g.ch, overlay(b, parseExtra(g)));
  }
  return { style, def, glyphs };
}

export function layoutText(f: RomFont, text: string): IndexedImage {
  const chars = [...text];
  const parts = chars.map(ch => (ch === ' ' ? null : f.glyphs.get(ch) ?? null));
  // O espaço avança spaceWidth e ainda recebe o `spacing` dos dois lados (spaceWidth + 2·spacing no total). Mantido assim
  // porque mudar alteraria as larguras já medidas; com `spacing` negativo, ajuste o spaceWidth do estilo para compensar.
  const ws = parts.map((g, i) => (g ? g.w : chars[i] === ' ' ? f.def.spaceWidth : 0));
  // kerning por par (aditivo ao `spacing`): kern['TÓ'] = −20 aproxima o Ó do T
  const kern = chars.map((ch, i) => (i > 0 ? f.def.kern?.[chars[i - 1] + ch] ?? 0 : 0));
  const w = Math.max(0, ws.reduce((a, b) => a + b, 0) + f.def.spacing * (parts.length - 1) + kern.reduce((a, b) => a + b, 0));
  const h = f.def.height;
  const px = new Uint8Array(w * h);
  let x = 0;
  parts.forEach((g, i) => {
    x += kern[i];
    // só os pixels não nulos: com `spacing` negativo a letra seguinte se sobrepõe à anterior sem apagá-la
    if (g) for (let y = 0; y < Math.min(h, g.h); y++) for (let k = 0; k < g.w; k++) {
      const v = g.px[y * g.w + k], X = x + k;
      if (v && X >= 0 && X < w) px[y * w + X] = v;
    }
    x += ws[i] + f.def.spacing;
  });
  const img = { w, h, px };
  return f.def.outline ? addOutline(img, f.def.outline) : img;
}

export function glyphChars(style: TextStyleId, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): Set<string> {
  const cuts = maps[style]?.cuts ?? [];
  // um glifo com `base` só existe se a letra-base tiver recorte da ROM
  return new Set([...cuts.map(c => c.ch), ...extras[style].filter(g => !g.base || cuts.some(c => c.ch === g.base)).map(g => g.ch)]);
}
export function missingGlyphs(style: TextStyleId, text: string, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): string[] {
  const have = glyphChars(style, maps, extras);
  return [...new Set([...text].filter(ch => ch !== ' ' && !have.has(ch)))];
}

export function indexedToRgba(img: IndexedImage, colors: Uint16Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.w * img.h * 4);
  img.px.forEach((v, i) => {
    if (!v) return;
    const [r, g, b] = bgr555ToRgba(colors[v] ?? 0);
    out.set([r, g, b, 255], i * 4);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Faixas da ROM → imagem indexada

function putTile(img: IndexedImage, tpx: Uint8Array, t: number, dx: number, dy: number): void {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) img.px[(dy + y) * img.w + dx + x] = tpx[t * 64 + y * 8 + x] ?? 0;
}

const VRAM_BASE = { bg: [0x0000, 4], bg3: [0xa000, 2], obj: [0xc000, 4] } as const;

/** Decodifica uma faixa de glifos da ROM numa imagem indexada (tiles 8×8 lado a lado; cada linha da faixa tem 8 px). */
export function decodeStrip(src: StripSource, a: RomAssets): IndexedImage {
  switch (src.kind) {
    case 'raw': {
      const img: IndexedImage = { w: src.tiles * 8, h: src.rows.length * 8, px: new Uint8Array(src.tiles * 64 * src.rows.length) };
      src.rows.forEach((addr, r) => {
        const t = tilesFrom(a.rom.bytes(addr, src.tiles * 8 * src.bpp), 0, src.tiles, src.bpp);
        for (let c = 0; c < src.tiles; c++) putTile(img, t.px, c, c * 8, r * 8);
      });
      return img;
    }
    case 'zte': {
      const data = zteBlock(a, src.block);
      const img: IndexedImage = { w: src.tiles * 8, h: src.rows * 8, px: new Uint8Array(src.tiles * 64 * src.rows) };
      for (let r = 0; r < src.rows; r++) {
        const t = tilesFrom(data, src.offset + r * src.rowStride, src.tiles, 4);
        for (let c = 0; c < src.tiles; c++) putTile(img, t.px, c, c * 8, r * 8);
      }
      return img;
    }
    case 'vram': {
      const { vram } = sceneVramCgram(a, src.scene);
      const [base, bpp] = VRAM_BASE[src.region];
      const img: IndexedImage = { w: src.tiles * 8, h: src.rows * 8, px: new Uint8Array(src.tiles * 64 * src.rows) };
      for (let r = 0; r < src.rows; r++) for (let c = 0; c < src.tiles; c++) {
        const t = tilesFrom(vram, base + (src.tile + r * src.rowStride + c) * 8 * bpp, 1, bpp);
        putTile(img, t.px, 0, c * 8, r * 8);
      }
      return img;
    }
    case 'grid16': {
      const { vram } = sceneVramCgram(a, src.scene);
      const [base, bpp] = VRAM_BASE[src.region];
      const rows = src.cells.length, cols = Math.max(0, ...src.cells.map(r => r.length));
      const img: IndexedImage = { w: cols * 16, h: rows * 16, px: new Uint8Array(cols * 16 * rows * 16) };
      // Vizinhos do bloco como o PPU: coluna com volta no nibble baixo ($xF + 1 → $x0) e linha com volta no nibble alto
      // dentro da mesma página de 256 tiles (regra dos OBJ grandes; nos BG de 16×16 os blocos usados nunca terminam em $xF).
      const next = (t: number, dx: number, dy: number): number =>
        (t & ~0xff) | (((t & 0xf0) + dy * 16) & 0xf0) | (((t & 0x0f) + dx) & 0x0f);
      src.cells.forEach((row, r) => row.forEach((t, c) => {
        if (t < 0) return;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const tp = tilesFrom(vram, base + next(t, dx, dy) * 8 * bpp, 1, bpp);
          putTile(img, tp.px, 0, c * 16 + dx * 8, r * 16 + dy * 8);
        }
      }));
      return img;
    }
    case 'mode7': {
      const { chr, map } = a.mode7Draw();
      const img: IndexedImage = { w: src.w, h: src.h, px: new Uint8Array(src.w * src.h) };
      for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
        const X = src.x + i, Y = src.y + j;
        img.px[j * src.w + i] = chr[(map[(Y >> 3) * 128 + (X >> 3)] ?? 0) * 64 + (Y & 7) * 8 + (X & 7)] ?? 0;
      }
      return img;
    }
  }
}

const fontCache = new WeakMap<RomAssets, Map<TextStyleId, RomFont>>();

/** Fonte do estilo montada da ROM (`null` se o estilo ainda não tem mapa). Cada faixa é decodificada uma vez por ROM. */
export function buildRomFont(style: TextStyleId, a: RomAssets, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): RomFont | null {
  const def = maps[style];
  if (!def) return null;
  const cacheable = maps === GLYPH_MAPS && extras === EXTRA_GLYPHS;
  let perRom = fontCache.get(a);
  const hit = cacheable ? perRom?.get(style) : undefined;
  if (hit) return hit;
  const strips: Record<string, IndexedImage> = {};
  for (const [k, src] of Object.entries(def.strips)) strips[k] = decodeStrip(src, a);
  const f = fontFromParts(style, def, strips, extras[style]);
  if (cacheable) {
    if (!perRom) { perRom = new Map(); fontCache.set(a, perRom); }
    perRom.set(style, f);
  }
  return f;
}

/** Cores do estilo (BGR555). `scene`: CGRAM da cena a partir da linha; `rom`: cores cruas no endereço. `tones` troca a origem. */
export function styleColors(def: StyleRomDef, a: RomAssets, tone?: Tone): Uint16Array {
  const alt = tone ? def.tones?.[tone] : undefined;
  const p = def.palette;
  if (p.kind === 'rom') return readColors(a, alt ?? p.addr, p.size);
  const start = (alt ?? p.row) * p.size;
  return sceneVramCgram(a, p.scene).cgram.slice(start, start + p.size);
}

// ---------------------------------------------------------------------------------------------------------------------
// Desenho

export const TONE_COLORS: Record<Tone, string> = {
  default: '', gray: '#8a8a8a', green: '#3fb24a', red: '#e8402a', blue: '#3a6ae0', white: '#ffffff', orange: '#ff8c1a', yellow: '#ffd23f',
};
export const STYLE_COLOR: Record<TextStyleId, string> = {
  titleMenu: '#ffffff', menuTitle: '#4a8cff', menuItem: '#e8402a', ascii8: '#ffffff', banner: '#3fd84a', spriteBlue: '#4a8cff',
  bigBattle: '#ffd23f', bigScore: '#ffd23f', bigVictory: '#ff8c1a', bigDraw: '#e8402a',
};
const isBig = (style: TextStyleId): boolean => style.startsWith('big');

export interface TextOpts { align?: 'left' | 'center' | 'right'; tone?: Tone; color?: string; scale?: number }

type Img = ReturnType<typeof pixToCanvas>;
const romCanvas = new WeakMap<RomAssets, Map<string, Img>>();
const fallbackCanvas = new Map<string, Img>();

function romFontNow(style: TextStyleId): { a: RomAssets; f: RomFont } | null {
  const a = romState.assets;
  if (!a || !GLYPH_MAPS[style]) return null;
  const f = buildRomFont(style, a);
  return f ? { a, f } : null;
}

const alignX = (x: number, w: number, align: TextOpts['align']): number =>
  align === 'center' ? x - Math.floor(w / 2) : align === 'right' ? x - w : x;

/** Desenha `text` no estilo e devolve a largura final (já com a escala). Com ROM usa os glifos da ROM; senão, o fallback. */
export function drawText(ctx: CanvasRenderingContext2D, bank: SpriteBank, style: TextStyleId, text: string, x: number, y: number,
  o: TextOpts = {}): number {
  const rf = romFontNow(style);
  if (rf) {
    const scale = o.scale ?? 1;
    const tone = o.tone ?? 'default';
    let perRom = romCanvas.get(rf.a);
    if (!perRom) { perRom = new Map(); romCanvas.set(rf.a, perRom); }
    const key = `${style}|${text}|${tone}`;
    let img = perRom.get(key);
    if (!img) {
      const lay = layoutText(rf.f, text);
      img = pixToCanvas({ w: lay.w, h: lay.h, data: indexedToRgba(lay, styleColors(rf.f.def, rf.a, tone)) });
      perRom.set(key, img);
    }
    const w = img.width * scale;
    ctx.drawImage(img, alignX(x, w, o.align), y, w, img.height * scale);
    return w;
  }
  const scale = o.scale ?? (isBig(style) ? 2 : 1);
  const color = o.color ?? (TONE_COLORS[o.tone ?? 'default'] || STYLE_COLOR[style]);
  const up = text.toUpperCase();
  let img: Img;
  if ([...up].some(ch => ch in FALLBACK_EXTRA)) {
    const key = `${color}|${up}`;
    img = fallbackCanvas.get(key) ?? pixToCanvas(fallbackPix(up, color));
    fallbackCanvas.set(key, img);
  } else img = bank.text(up, color);
  const w = img.width * scale;
  ctx.drawImage(img, alignX(x, w, o.align), y, w, img.height * scale);
  return w;
}

/** Largura que `drawText` ocuparia, sem desenhar. */
export function textWidth(style: TextStyleId, text: string, o: Pick<TextOpts, 'scale'> = {}): number {
  const rf = romFontNow(style);
  if (rf) return layoutText(rf.f, text).w * (o.scale ?? 1);
  return ([...text].length * 6 - 1 + 2) * (o.scale ?? (isBig(style) ? 2 : 1));
}

/** R27: "TEMPO ESGOTADO!" se couber em 1,25 × a largura de "TIME UP!" original no estilo `banner`; senão "TEMPO!". */
export function timeUpLabel(a: RomAssets | null = romState.assets): string {
  const ref = GLYPH_MAPS.banner?.meta?.timeUpWidth;
  const f = a && ref ? buildRomFont('banner', a) : null;
  if (!f || !ref) return S.battle.timeUp;
  return layoutText(f, S.battle.timeUp).w <= 1.25 * ref ? S.battle.timeUp : S.battle.timeUpShort;
}
