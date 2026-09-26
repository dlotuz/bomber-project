import type { ArenaAssets, PalAnim, TileAnimCmd, Tiles } from '../../rom/types';
import { itemBlinkColor, palFrameAt, tileStateAt, tileStateKey, tileTimeline, type PalCycle, type TileCmd, type TileTimeline } from '../anim/timeline';
import { OBJ_ITEM_PAL, type TileOverride } from './scene';

/** Formato do plano 5 (conferido na T1) → comandos normalizados. */
export function normTileCmds(cmds: readonly TileAnimCmd[]): TileCmd[] {
  return cmds.map((c): TileCmd => {
    switch (c.kind) {
      case 'dma': return { op: 'dma', dst: c.vram >> 4, src: ((c.src & 0xffff) - 0x8000) >> 5 };
      case 'wait': return { op: 'wait', n: c.frames };
      case 'loop': return { op: 'loop' };
      default: return { op: 'end' };
    }
  });
}

export function normPalAnims(p: readonly PalAnim[]): PalCycle[] {
  return p.map(x => ({ index: x.first, frames: x.frames, period: x.period }));
}

/** Copia o 16×16 `from` para `to` (tiles +0, +1, +16, +17), lendo do buffer original. */
export function copyTile16(dst: Uint8Array, base: Uint8Array, to: number, from: number): void {
  for (const k of [0, 1, 16, 17]) dst.set(base.subarray((from + k) * 64, (from + k + 1) * 64), (to + k) * 64);
}

const timelines = new WeakMap<ArenaAssets, TileTimeline | null>();
const tileCache = new WeakMap<ArenaAssets, { key: string; tiles: Tiles }>();

function timelineOf(ar: ArenaAssets): TileTimeline | null {
  if (!timelines.has(ar)) timelines.set(ar, ar.tileAnim ? tileTimeline(normTileCmds(ar.tileAnim)) : null);
  return timelines.get(ar) ?? null;
}

/**
 * Tiles de BG no tick: animação de tiles (ou `copies` fixas, só para o golden) + trocas 8×8 extras (rostos do HUD).
 * `extraKey` identifica `extra` no cache (ex.: personagens dos 5 slots).
 */
export function sceneryTiles(ar: ArenaAssets, tick: number, extra: readonly TileOverride[], extraKey: string,
  copies?: readonly (readonly [number, number])[]): Tiles {
  const tl = timelineOf(ar);
  const animKey = copies ? 'C' + copies.map(c => c.join(':')).join(';') : tl ? tileStateKey(tl, tick) : '-';
  const key = animKey + '|' + extraKey;
  const hit = tileCache.get(ar);
  if (hit && hit.key === key) return hit.tiles;
  const base = ar.bgTiles.px;
  const px = Uint8Array.from(base);
  const pairs = copies ?? (tl ? [...tileStateAt(tl, tick)] : []);
  for (const [to, from] of pairs) copyTile16(px, base, to, from);
  for (const o of extra) px.set(o.px.subarray(0, 64), o.tile * 64);
  const tiles: Tiles = { bpp: ar.bgTiles.bpp, count: ar.bgTiles.count, px };
  tileCache.set(ar, { key, tiles });
  return tiles;
}

export function sceneryCgram(ar: ArenaAssets, tick: number, frame: number, blink: boolean): Uint16Array {
  const cg = new Uint16Array(256);
  cg.set(ar.bgCgram.subarray(0, 128), 0);
  for (const p of normPalAnims(ar.palAnim)) cg.set(palFrameAt(p, tick).subarray(0, 16), p.index);
  if (blink) cg[79] = itemBlinkColor(frame);
  cg.set(ar.objCgram.subarray(0, 128), 128);
  cg.set(cg.slice(64, 80), 128 + 16 * OBJ_ITEM_PAL);
  return cg;
}
