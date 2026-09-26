// Motor de texto: um estilo por fonte da ROM (glifos recortados de faixas da ROM em tempo de execução + glifos próprios)
// e o fallback com a fonte atual quando não há ROM ou o estilo ainda não tem mapa.
import type { SpriteBank } from '../sprite-bank';
import { pixToCanvas } from '../sprite-bank';
import { romState, tilesFrom, sceneVramCgram, zteBlock, readColors, bgr555ToRgba, type RomAssets } from '../../app/rom-api';
import type { ExtraGlyph, IndexedImage, StripSource, StyleRomDef, TextStyleId, Tone } from './types';
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

export function fontFromParts(style: TextStyleId, def: StyleRomDef, strips: Record<string, IndexedImage>, extras: readonly ExtraGlyph[]): RomFont {
  const glyphs = new Map<string, IndexedImage>();
  for (const g of extras) glyphs.set(g.ch, parseExtra(g));
  for (const c of def.cuts) {
    const s = strips[c.strip];
    if (s) glyphs.set(c.ch, crop(s, c.x, c.y ?? 0, c.w, c.h ?? def.height));   // recorte da ROM vence
  }
  return { style, def, glyphs };
}

export function layoutText(f: RomFont, text: string): IndexedImage {
  const parts = [...text].map(ch => (ch === ' ' ? null : f.glyphs.get(ch) ?? null));
  const ws = parts.map((g, i) => (g ? g.w : [...text][i] === ' ' ? f.def.spaceWidth : 0));
  const w = Math.max(0, ws.reduce((a, b) => a + b, 0) + f.def.spacing * (parts.length - 1));
  const h = f.def.height;
  const px = new Uint8Array(w * h);
  let x = 0;
  parts.forEach((g, i) => {
    if (g) for (let y = 0; y < Math.min(h, g.h); y++) for (let k = 0; k < g.w; k++) px[y * w + x + k] = g.px[y * g.w + k];
    x += ws[i] + f.def.spacing;
  });
  return { w, h, px };
}

export function glyphChars(style: TextStyleId, maps = GLYPH_MAPS, extras = EXTRA_GLYPHS): Set<string> {
  return new Set([...(maps[style]?.cuts ?? []).map(c => c.ch), ...extras[style].map(g => g.ch)]);
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
