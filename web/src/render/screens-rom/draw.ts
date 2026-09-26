// Textura Modo 7 e desenho da tela EMPATE (spec §6.11, §7.5; T14 do plano 10).
import { bgr555ToRgba, sceneVramCgram, tilesFrom, type Mode7Layer, type ObjEntry, type RomAssets } from '../../app/rom-api';
import { buildRomFont, drawText, layoutText } from '../text/text';
import type { IndexedImage } from '../text/types';
import { S } from '../text/strings';
import { pixToCanvas, type Img, type SpriteBank } from '../sprite-bank';
import { PpuCanvas, sceneFrame, sceneGfx, sceneMaps, type SceneGfx, type SceneMaps } from './scene';

export interface DrawTexture { chr: Uint8Array; map: Uint8Array }

/** Plano Modo 7 de 1024×1024 (mapa 128×128, 256 tiles 8×8 de 8 bits) com `img` centrada em
 *  (512 − ⌊w/2⌋, 512 − ⌊h/2⌋). O tile 0 fica vazio; tiles de conteúdo idêntico são reaproveitados. */
export function buildDrawTexture(img: IndexedImage): DrawTexture {
  const map = new Uint8Array(128 * 128);
  const chr = new Uint8Array(256 * 64);
  const ox = 512 - (img.w >> 1), oy = 512 - (img.h >> 1);
  const byKey = new Map<string, number>();
  let next = 1;
  if (img.w > 0 && img.h > 0) {
    const gx0 = Math.floor(ox / 8), gx1 = Math.floor((ox + img.w - 1) / 8);
    const gy0 = Math.floor(oy / 8), gy1 = Math.floor((oy + img.h - 1) / 8);
    const block = new Uint8Array(64);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        let any = false;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const ix = gx * 8 + x - ox, iy = gy * 8 + y - oy;
          const v = ix >= 0 && ix < img.w && iy >= 0 && iy < img.h ? img.px[iy * img.w + ix] : 0;
          block[y * 8 + x] = v;
          if (v) any = true;
        }
        if (!any) continue;   // já é o tile 0 (mapa começa zerado)
        const key = block.join(',');
        let idx = byKey.get(key);
        if (idx === undefined) {
          if (next > 255) throw new RangeError('buildDrawTexture: mais de 255 tiles distintos');
          idx = next++;
          byKey.set(key, idx);
          chr.set(block, idx * 64);
        }
        map[((gy % 128) + 128) % 128 * 128 + (((gx % 128) + 128) % 128)] = idx;
      }
    }
  }
  return { chr, map };
}

/** `chr[map[(Y>>3)·128 + (X>>3)]·64 + (Y&7)·8 + (X&7)]` (spec §6.11). */
export function m7Pixel(tex: DrawTexture, X: number, Y: number): number {
  return tex.chr[tex.map[(Y >> 3) * 128 + (X >> 3)] * 64 + (Y & 7) * 8 + (X & 7)];
}

// ---------------------------------------------------------------------------------------------------------------------
// Desenho com ROM (§7.5, R21) e fallback (§6.14)

/** Posições reais dos 5 bomberitas na captura (`draw1.oam`/`draw2.oam`, 5 OBJ 32×32 lado a lado sobre o disco). */
export const CHAR_X: readonly number[] = [48, 80, 112, 144, 176];
export const CHAR_Y = 168;

/** Vermelho/amarelo/verde "principais" da CGRAM de `draw2` (índices mais saturados de cada rampa: linha 1 = vermelho,
 *  linha 2 = amarelo, linha 0 = verde — conferido em `analise/extraido/graficos-formato/cenas/draw2.cgram`). Usados
 *  para colorir o índice mais frequente da textura construída (ela pode não usar os MESMOS índices que o jogo original,
 *  já que P e T são glifos nossos — T18); por isso a troca de cor recai sobre o índice dominante da textura, não num
 *  índice fixo da ROM. */
export const CYCLE_RGB: readonly [number, number, number][] = [
  [255, 74, 0],    // vermelho: draw2.cgram[27]
  [255, 239, 0],   // amarelo: draw2.cgram[44]
  [57, 206, 0],    // verde: draw2.cgram[12]
];
const CYCLE_TONE = ['red', 'yellow', 'green'] as const;

export interface Letters { scale: number; color: 0 | 1 | 2 }
export interface DrawSceneInput { chars: readonly number[]; active: readonly boolean[] }

const rgbCss = ([r, g, b]: readonly [number, number, number]): string => `rgb(${r},${g},${b})`;

/** Cada letra do Modo 7 original usa uma rampa de índices (a T18 documenta 3: `5–15`, `21–31`, `37–47`, uma por
 *  letra/grupo — E, M, A da ROM e P, T próprios reaproveitam essas mesmas 3). Em vez de fixar essas faixas (o que
 *  dependeria de como a T18 desenhou P e T), agrupamos aqui os índices não nulos realmente usados na textura
 *  construída por proximidade, e devolvemos o mais frequente ("recheio") de cada grupo, em ordem crescente de
 *  índice — assim a troca de cor funciona em qualquer conjunto de letras que `buildDrawTexture` receber. */
function colorGroups(tex: DrawTexture): number[] {
  const freq = new Map<number, number>();
  for (const v of tex.chr) if (v) freq.set(v, (freq.get(v) ?? 0) + 1);
  const used = [...freq.keys()].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of used) {
    const last = groups[groups.length - 1];
    if (last && v - last[last.length - 1] <= 3) last.push(v); else groups.push([v]);
  }
  return groups.map(g => g.reduce((best, v) => (freq.get(v)! > freq.get(best)! ? v : best)));
}

interface TexInfo { tex: DrawTexture; groups: number[] }
const texCache = new WeakMap<RomAssets, TexInfo | null>();
const REQUIRED_GLYPHS = ['E', 'M', 'A', 'P', 'T'] as const;

/** Fonte `bigDraw` pronta (E, M, A recortadas do Modo 7 original pela T18; P e T próprios) — `null` enquanto a T18
 *  não publicar o mapa (roda em paralelo; `web/src/render/text/maps/bigDraw.ts` ainda é `null` nesta árvore). */
export function bigDrawReady(a: RomAssets): boolean {
  const f = buildRomFont('bigDraw', a);
  return !!f && REQUIRED_GLYPHS.every(ch => f.glyphs.has(ch));
}

function empateTexture(a: RomAssets): TexInfo | null {
  if (texCache.has(a)) return texCache.get(a) ?? null;
  const f = buildRomFont('bigDraw', a);
  const ready = !!f && REQUIRED_GLYPHS.every(ch => f.glyphs.has(ch));
  let info: TexInfo | null = null;
  if (ready && f) { const tex = buildDrawTexture(layoutText(f, S.draw.title)); info = { tex, groups: colorGroups(tex) }; }
  texCache.set(a, info);
  return info;
}

/** Registradores do Modo 7 (spec §2.4/ANI) para a textura do EMPATE, com escala `letters().scale` (1 = tamanho normal;
 *  quanto menor, mais zoom "para fora" = a palavra fica pequena) e centrada na tela (128, 112). */
function mode7Layer(tex: DrawTexture, scale: number): Mode7Layer | null {
  if (scale <= 0.001) return null;
  const k = Math.max(1, Math.round(256 / scale));
  return { chr: tex.chr, map: tex.map, a: k, b: 0, c: 0, d: k, cx: 512, cy: 512, hofs: 512 - 128, vofs: 512 - 112, outside: 'transparent' };
}

/** Rasteriza `m` num ImageData 256×224 com alfa real (0 fora do plano/tile 0), pra poder compor por cima do resto da
 *  cena com `drawImage` — o `renderPpu` compartilhado (plano 5) preenche tudo com o fundo, sem alfa, então não serve
 *  aqui: essa tela precisa do BG2 (disco) e do OBJ (bomberitas) visíveis POR BAIXO das letras do Modo 7. */
function rasterMode7(m: Mode7Layer, colorAt: (i: number) => readonly [number, number, number]): ImageData {
  const W = 256, H = 224;
  const img = new ImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    const sy = y + m.vofs - m.cy;
    for (let x = 0; x < W; x++) {
      const sx = x + m.hofs - m.cx;
      const u = ((m.a * sx + m.b * sy) >> 8) + m.cx, v = ((m.c * sx + m.d * sy) >> 8) + m.cy;
      if (u < 0 || u >= 1024 || v < 0 || v >= 1024) continue;
      const idx = m7Pixel({ chr: m.chr, map: m.map }, u, v);
      if (!idx) continue;
      const [r, g, b] = colorAt(idx);
      const o = (y * W + x) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return img;
}

let m7Canvas: HTMLCanvasElement | null = null;

/** "EMPATE" achatado (fallback e ROM sem a fonte `bigDraw` ainda): mesma chamada nos dois casos — o `drawText` da T4
 *  já cai para o canvas quando o estilo não tem mapa (§6.14). */
export function drawTitleFlat(ctx: CanvasRenderingContext2D, bank: SpriteBank, letters: Letters): void {
  drawText(ctx, bank, 'bigDraw', S.draw.title, 128, 78, { align: 'center', scale: 2 * letters.scale, tone: CYCLE_TONE[letters.color] });
}

const charCache = new WeakMap<RomAssets, Map<string, Img>>();
/** Quadro `g` (54 = fase Modo 7, 52 = depois de S=148) do personagem `char`, com a paleta do slot `slot` (0..4). */
function charFrameImg(a: RomAssets, char: number, slot: number, g: number): Img {
  let m = charCache.get(a); if (!m) { m = new Map(); charCache.set(a, m); }
  const key = `${char}:${slot}:${g}`;
  let img = m.get(key);
  if (!img) {
    const px = a.character(char).frame(g);
    const pal = a.character(char).palettes[slot % 5];
    const data = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < 1024; i++) {
      const v = px[i];
      if (!v) continue;
      const [r, g2, b] = bgr555ToRgba(pal[v] ?? 0);
      data.set([r, g2, b, 255], i * 4);
    }
    img = pixToCanvas({ w: 32, h: 32, data });
    m.set(key, img);
  }
  return img;
}

/** Fundo + disco aproximados no canvas com as cores reais da CGRAM de `draw2`, usados só enquanto não há um mapa de
 *  BG2 de verdade (ver `drawEmpateRom`). */
function drawSkyAndDiscFallback(ctx: CanvasRenderingContext2D, cgram: Uint16Array): void {
  ctx.fillStyle = rgbCss(bgr555ToRgba(cgram[0] ?? 0));
  ctx.fillRect(0, 0, 256, 224);
  const edge = rgbCss(bgr555ToRgba(cgram[48] ?? 0)), mid = rgbCss(bgr555ToRgba(cgram[56] ?? 0)), hi = rgbCss(bgr555ToRgba(cgram[63] ?? 0));
  const grad = ctx.createRadialGradient(128, 160, 4, 128, 160, 112);
  grad.addColorStop(0, hi); grad.addColorStop(0.55, mid); grad.addColorStop(1, edge);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(128, 160, 110, 40, 0, 0, Math.PI * 2); ctx.fill();
}

function forEachActive(input: DrawSceneInput, f: (slot: number, char: number) => void): void {
  input.active.forEach((on, i) => { if (on && i < CHAR_X.length) f(i, input.chars[i] ?? i); });
}

/** OAM real (posições de `draw1.oam`/`draw2.oam`) dos ativos no quadro `g`, com a paleta de cada um injetada em
 *  `cgram` (linhas OBJ 128+16·slot) — sobrescreve só o espaço OBJ (128..255); os índices 0..127 (Modo 7/BG) ficam
 *  intactos para colorir as letras depois. */
function buildCharOam(a: RomAssets, input: DrawSceneInput, g: 52 | 54, cgram: Uint16Array): ObjEntry[] {
  const entries: ObjEntry[] = [];
  forEachActive(input, (slot, char) => {
    const px = a.character(char).frame(g);
    const pal = a.character(char).palettes[slot % 5];
    for (let k = 0; k < 16; k++) cgram[128 + slot * 16 + k] = pal[k];
    entries.push({ x: CHAR_X[slot], y: CHAR_Y, size: 32, pal: slot, prio: 2, hflip: false, vflip: false, src: { px } });
  });
  return entries;
}

const ppuCanvas = new PpuCanvas();
const emptyGeometry = (): SceneMaps => ({});

/** `draw2` não segue o layout padrão de VRAM das outras cenas (T19): `BG12NBA = $44` põe os tiles do BG2 em
 *  $8000–$B7FF (448 tiles), não em $0000 como `sceneGfx`/`gfxFromVram` assumem — conferido: nada é escrito em
 *  $0000–$7FFF nesta cena. `bg3Tiles`/`objTiles` não importam aqui (o BG3 não é usado e os OBJ são montados à parte
 *  por `buildCharOam`), então só troca `bgTiles`. */
const DRAW2_BG2_TILE_ADDR = 0x8000, DRAW2_BG2_TILE_COUNT = 448;
function draw2Gfx(a: RomAssets): SceneGfx {
  const base = sceneGfx(a, 'draw2');
  const { vram } = sceneVramCgram(a, 'draw2');
  return { ...base, bgTiles: tilesFrom(vram, DRAW2_BG2_TILE_ADDR, DRAW2_BG2_TILE_COUNT, 4) };
}

/** Desenho da cena com ROM: fundo/disco/personagens pelo `sceneFrame`/`renderPpu` da T5 (mapa de `MAP_SOURCES.draw2`,
 *  T19, com os tiles corrigidos de `draw2Gfx`); sem `MAP_SOURCES.draw2` (por exemplo, testes com uma geometria
 *  própria), cai num fallback de canvas com as cores e as posições reais dos 5 ativos. Por cima, o Modo 7 de
 *  "EMPATE" (ou o texto achatado, enquanto a fonte `bigDraw` não estiver pronta). */
export function drawEmpateRom(ctx: CanvasRenderingContext2D, bank: SpriteBank, a: RomAssets, input: DrawSceneInput, letters: Letters, g: 52 | 54): void {
  const gfx = draw2Gfx(a);
  const cgram = Uint16Array.from(gfx.cgram);   // cópia: não mexe no cache memoizado de sceneGfx
  const oam = buildCharOam(a, input, g, cgram);
  const maps = sceneMaps(a, 'draw2', emptyGeometry);
  if (maps.bg2) ppuCanvas.draw(ctx, sceneFrame({ ...gfx, cgram }, maps, { oam, backdrop: cgram[0] }));
  else {
    drawSkyAndDiscFallback(ctx, cgram);
    forEachActive(input, (slot, char) => ctx.drawImage(charFrameImg(a, char, slot, g), CHAR_X[slot], CHAR_Y));
  }
  const info = empateTexture(a);
  if (!info) { drawTitleFlat(ctx, bank, letters); return; }
  const m7 = mode7Layer(info.tex, letters.scale);
  if (!m7) return;
  // Cada grupo (letra/rampa) troca de cor com uma fase própria (grupo k mostra CYCLE_RGB[(color + k) % 3]), como no
  // original (§6.11: "os índices da cor principal das letras", no plural — cada letra tem o seu).
  const phase = new Map(info.groups.map((idx, k) => [idx, k]));
  const colorAt = (i: number): readonly [number, number, number] => {
    const k = phase.get(i);
    return k === undefined ? bgr555ToRgba(cgram[i] ?? 0) : CYCLE_RGB[(letters.color + k) % 3];
  };
  m7Canvas ??= document.createElement('canvas');
  m7Canvas.width = 256; m7Canvas.height = 224;
  m7Canvas.getContext('2d')!.putImageData(rasterMode7(m7, colorAt), 0, 0);
  ctx.drawImage(m7Canvas, 0, 0);
}

/** Fallback sem ROM (§6.14): fundo `#0a0f3a`, disco (elipse clara em y ≈ 160), `bank.bomber(char, 2, 0)` dos 5 ativos
 *  e "EMPATE" achatado. */
export function drawEmpateFallback(ctx: CanvasRenderingContext2D, bank: SpriteBank, input: DrawSceneInput, letters: Letters): void {
  ctx.fillStyle = '#0a0f3a';
  ctx.fillRect(0, 0, 256, 224);
  ctx.fillStyle = '#4a5a99';
  ctx.beginPath(); ctx.ellipse(128, 160, 110, 40, 0, 0, Math.PI * 2); ctx.fill();
  forEachActive(input, (slot, char) => ctx.drawImage(bank.bomber(char, 2, 0), CHAR_X[slot] + 8, CHAR_Y + 6));
  drawTitleFlat(ctx, bank, letters);
}
