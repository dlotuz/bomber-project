import { tilesFrom, sceneVramCgram, renderPpu, type RomAssets, type SceneId, type Tiles, type PpuFrame, type ObjEntry } from '../../app/rom-api';
import { MAP_SOURCES } from './map-sources';

export interface SceneGfx { bgTiles: Tiles; bg3Tiles: Tiles; objTiles: Tiles; cgram: Uint16Array }
export interface SceneMaps { bg1?: Uint16Array; bg2?: Uint16Array; bg3?: Uint16Array }
export type MapBuilder = (a: RomAssets) => SceneMaps;
export interface BoxParts { tl: number; tr: number; bl: number; br: number; top: number; bottom: number; left: number; right: number; fill?: number }

/** Layout de VRAM das cenas [CAT §1]: BG 4bpp em $0000, BG3 2bpp em $5000 (palavra), OBJ 4bpp em $6000. */
export function gfxFromVram(vram: Uint8Array, cgram: Uint16Array): SceneGfx {
  return { bgTiles: tilesFrom(vram, 0x0000, 1024, 4), bg3Tiles: tilesFrom(vram, 0xa000, 256, 2), objTiles: tilesFrom(vram, 0xc000, 512, 4), cgram };
}
const cache = new WeakMap<RomAssets, Map<SceneId, SceneGfx>>();
export function sceneGfx(a: RomAssets, id: SceneId): SceneGfx {
  let m = cache.get(a); if (!m) { m = new Map(); cache.set(a, m); }
  let g = m.get(id);
  if (!g) { const s = sceneVramCgram(a, id); g = gfxFromVram(s.vram, s.cgram); m.set(id, g); }
  return g;
}

export const newMap = (): Uint16Array => new Uint16Array(32 * 32);
export const tileWord = (tile: number, pal: number, prio = 0, h = false, v = false): number =>
  ((v ? 1 : 0) << 15) | ((h ? 1 : 0) << 14) | ((prio & 1) << 13) | ((pal & 7) << 10) | (tile & 0x3ff);
export const put = (m: Uint16Array, col: number, lin: number, w: number): void => { m[(lin & 31) * 32 + (col & 31)] = w; };
export function fill(m: Uint16Array, col: number, lin: number, w: number, h: number, word: number): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(m, col + i, lin + j, word);
}
export function pattern(m: Uint16Array, col: number, lin: number, w: number, h: number, words: readonly (readonly number[])[]): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(m, col + i, lin + j, words[j % words.length][i % words[0].length]);
}
export function box(m: Uint16Array, c0: number, l0: number, c1: number, l1: number, p: BoxParts): void {
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
    const top = l === l0, bot = l === l1, lef = c === c0, rig = c === c1;
    const w = top && lef ? p.tl : top && rig ? p.tr : bot && lef ? p.bl : bot && rig ? p.br
      : top ? p.top : bot ? p.bottom : lef ? p.left : rig ? p.right : p.fill;
    if (w !== undefined) put(m, c, l, w);
  }
}
export function sceneMaps(a: RomAssets, id: SceneId, geometry: MapBuilder): SceneMaps {
  return (MAP_SOURCES[id] ?? geometry)(a);
}

export interface FrameOpts { bg1?: [number, number]; bg2?: [number, number]; bg3?: [number, number]; oam?: ObjEntry[]; backdrop?: number }
export function sceneFrame(g: SceneGfx, maps: SceneMaps, o: FrameOpts = {}): PpuFrame {
  const layer = (map: Uint16Array | undefined, tiles: Tiles, tile16: boolean, sc: [number, number] = [0, 0]) =>
    (map ? { map, mapW: 32 as const, tiles, tile16, hofs: sc[0], vofs: sc[1] } : undefined);
  const main = (maps.bg1 ? 1 : 0) | (maps.bg2 ? 2 : 0) | (maps.bg3 ? 4 : 0) | 16;
  return {
    cgram: g.cgram, bg1: layer(maps.bg1, g.bgTiles, true, o.bg1), bg2: layer(maps.bg2, g.bgTiles, true, o.bg2),
    bg3: layer(maps.bg3, g.bg3Tiles, false, o.bg3), bands: [{ y0: 0, y1: 224, bg1Tile16: true, main, sub: 0, math: 'none' }],
    objTiles: g.objTiles, oam: o.oam ?? [], backdrop: o.backdrop,
  };
}
export function obj(x: number, y: number, tile: number, pal: number, o: { big?: boolean; prio?: 0 | 1 | 2 | 3; h?: boolean; v?: boolean } = {}): ObjEntry {
  return { x, y, size: o.big ? 32 : 16, pal, prio: o.prio ?? 2, hflip: !!o.h, vflip: !!o.v, src: { tile } };
}

/** Só no navegador: um ImageData 256×224 reaproveitado, desenhado com putImageData. */
export class PpuCanvas {
  private img: ImageData | null = null;
  draw(ctx: CanvasRenderingContext2D, f: PpuFrame, dy = 0): void {
    this.img ??= new ImageData(256, 224);
    renderPpu(f, this.img);
    ctx.putImageData(this.img, 0, dy);
  }
}

// ---- Menus: quebra-cabeça no BG2 e moldura de corda no BG1 --------------------------------------------------------
// Números lidos nas capturas vsmode/ffa/players/rules (dump-capture) e conferidos contra os quadros; nenhum mapa copiado.

/** Cenas de menu com moldura de corda. */
export type MenuScene = 'vsmode' | 'ffa' | 'players' | 'rules';
/** Retângulo em px da tela, inclusivo (bbox da corda medida [MNT §B.2–B.4]). */
export interface MenuRect { x0: number; y0: number; x1: number; y1: number }
/** Corda de uma cena. A ROM aloca os tiles da corda na VRAM logo depois do texto (título e itens), então os números
 *  mudam por cena. `topRight` = borda de cima à direita do título; `titleEnds` = pontas da corda que encostam no título. */
export interface MenuRope extends BoxParts { topRight: number; titleEnds: [number, number] }
type MenuLayer = 'bg1' | 'bg2';

export const MENU_GEO = {
  /** Quebra-cabeça: 6×6 casas de 16×16 (a 2ª metade repete a 1ª deslocada 3 colunas), paleta 6, tiles $280–$2E0,
   *  alinhado em (0, 0) do mapa. Igual nas quatro cenas. */
  bgPattern: [
    [0x1a80, 0x1a82, 0x1a84, 0x1a86, 0x1a88, 0x1a8a],
    [0x1aa0, 0x1aa2, 0x1aa4, 0x1aa6, 0x1aa8, 0x1aaa],
    [0x1a8c, 0x1a8e, 0x1aac, 0x1aae, 0x1ac0, 0x1ae0],
    [0x1a86, 0x1a88, 0x1a8a, 0x1a80, 0x1a82, 0x1a84],
    [0x1aa6, 0x1aa8, 0x1aaa, 0x1aa0, 0x1aa2, 0x1aa4],
    [0x1aae, 0x1ac0, 0x1ae0, 0x1a8c, 0x1a8e, 0x1aac],
  ] as number[][],
  bgLayer: 'bg2' as MenuLayer,
  /** Corda (paleta 5; a borda horizontal é o tile $004, às vezes espelhado). Bolas nos cantos. */
  rope: {
    vsmode: { tl: 0x1402, top: 0x1404, topRight: 0x5404, tr: 0x142a, left: 0x142c, right: 0x142e, bl: 0x1484, bottom: 0x5404, br: 0x1486, titleEnds: [0x1406, 0x1428] },
    ffa: { tl: 0x1402, top: 0x1404, topRight: 0x5404, tr: 0x142a, left: 0x142c, right: 0x142e, bl: 0x1468, bottom: 0x5404, br: 0x146a, titleEnds: [0x1406, 0x1428] },
    players: { tl: 0x1402, top: 0x1404, topRight: 0x1404, tr: 0x142e, left: 0x1440, right: 0x1442, bl: 0x146a, bottom: 0x1404, br: 0x146c, titleEnds: [0x1406, 0x142c] },
    rules: { tl: 0x1402, top: 0x1404, topRight: 0x5404, tr: 0x142e, left: 0x1440, right: 0x1442, bl: 0x14aa, bottom: 0x5404, br: 0x14ac, titleEnds: [0x1406, 0x142c] },
  } as Record<MenuScene, MenuRope>,
  ropeLayer: 'bg1' as MenuLayer,
  /** [hofs, vofs] dos registradores (convenção do BgLayer). O fundo não rola nos menus. */
  scroll: { bg1: [0, 0] as [number, number], bg2: [0, 0] as [number, number] },
  /** Regras: o BG1 muda de VOFS por HDMA (linhas de 32 px no mapa viram 24 px na tela). [y0 da tela, vofs do BG1]. */
  rulesBg1Bands: [[0, -8], [79, 0], [103, 8], [127, 16], [151, 24], [175, 32], [199, 40]] as [number, number][],
  /** Mão parada [MNT §B.0]: OBJ 16×16, prioridade 3. */
  hand: { tile: 0x000, pal: 0 },
  titleHand: { tile: 0x0c8, pal: 0 },
};

/** VOFS do BG1 da cena na linha `y` da tela. */
export function menuBg1Vofs(scene: MenuScene, y: number): number {
  if (scene !== 'rules') return MENU_GEO.scroll.bg1[1];
  let v = MENU_GEO.rulesBg1Bands[0][1];
  for (const [y0, vofs] of MENU_GEO.rulesBg1Bands) if (y >= y0) v = vofs;
  return v;
}

/** Fundo inteiro com o quebra-cabeça e a moldura de corda cobrindo `frame` (px da tela → casas pelo scroll).
 *  Com `title` (px x0–x1 do título, que fica na linha de cima da corda): as casas do título ficam vazias (o texto é
 *  nosso) e a corda termina nas pontas `titleEnds` dos dois lados; sem ele, a borda de cima vai inteira. */
export function menuMaps(frame: MenuRect, scene: MenuScene = 'vsmode', title?: { x0: number; x1: number }): SceneMaps {
  const maps: SceneMaps = {};
  const layer = (k: MenuLayer) => (maps[k] ??= newMap());
  pattern(layer(MENU_GEO.bgLayer), 0, 0, 32, 32, MENU_GEO.bgPattern);
  const h = MENU_GEO.scroll[MENU_GEO.ropeLayer][0];
  const vofs = (y: number) => (MENU_GEO.ropeLayer === 'bg1' ? menuBg1Vofs(scene, y) : MENU_GEO.scroll.bg2[1]);
  const c0 = Math.floor((frame.x0 + h) / 16), l0 = Math.floor((frame.y0 + vofs(frame.y0)) / 16);
  const c1 = Math.floor((frame.x1 + h) / 16), l1 = Math.floor((frame.y1 + vofs(frame.y1)) / 16);
  const r = MENU_GEO.rope[scene];
  const m = layer(MENU_GEO.ropeLayer);
  box(m, c0, l0, c1, l1, MENU_GEO.ropeLayer === MENU_GEO.bgLayer ? { ...r, fill: undefined } : r);
  let right = ((c0 + c1) >> 1) + 1;
  if (title) {
    const t0 = Math.floor((title.x0 + h) / 16), t1 = Math.floor((title.x1 + h) / 16);
    for (let c = t0; c <= t1; c++) put(m, c, l0, 0);
    put(m, t0 - 1, l0, r.titleEnds[0]);
    put(m, t1 + 1, l0, r.titleEnds[1]);
    right = t1 + 2;
  }
  for (let c = right; c < c1; c++) put(m, c, l0, r.topRight);
  return maps;
}

export function handCursor(x: number, y: number, title = false): ObjEntry {
  const g = title ? MENU_GEO.titleHand : MENU_GEO.hand;
  return obj(x, y, g.tile, g.pal, { prio: 3 });
}
