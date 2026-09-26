import type { RoundState } from '../../core';
import type { RomAssets } from '../../rom/types';
import { renderPpu, type PpuFrame, type ScanBand } from '../ppu';
import { romLayers, type RomBattleLayer } from '../battle-layers';
import '../layers-index';
import { FrameBuilder } from './builder';
import { romTables } from './tables';
import { readScene } from './adapt';
import { fieldWords } from './field';
import { headOverrides, headTiles, hudWords } from './hud';
import { sceneryCgram, sceneryTiles } from './scenery';
import { drawSprites } from './sprites';
import { MAP_W, newMemo, type RomClock, type RomMemo } from './scene';

/** D1: o que a tela da partida passa além da rodada. */
export interface RomBattleVis { crowns: readonly number[] }

export interface BuildOpts {
  sprites?: boolean;                               // padrão true
  hudHeads?: boolean;                              // padrão true; false = tiles de rosto da ROM (golden)
  blink?: boolean;                                 // padrão true; false = cor 79 da ROM (golden)
  layers?: readonly RomBattleLayer[];              // padrão romLayers
  tileCopies?: readonly (readonly [number, number])[];   // quadro de animação fixo (golden)
  palAnim?: boolean;                               // padrão true; false = CGRAM da ROM sem ciclo de paleta (golden)
}

export const HUD_HOFS = 8;
export const HUD_VOFS = -33;
export const FIELD_HOFS = 8;
export const FIELD_VOFS = -25;
export const HUD_MAP_ROW = 28;
const BG1 = 1, BG2 = 2, OBJ = 16;
const NO_CROWNS: readonly number[] = [0, 0, 0, 0, 0];

const memos = new WeakMap<RoundState, RomMemo>();
export function romMemo(s: RoundState): RomMemo {
  let m = memos.get(s);
  if (!m) { m = newMemo(); memos.set(s, m); }
  return m;
}

/** D6: TIME UP congela tudo (também no `over` seguinte); vitória congela só o script das bombas. */
export function battleClock(s: RoundState, memo: RomMemo, frame: number): RomClock {
  if (s.phase === 'timeUp') memo.freezeAll ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeAll = null;
  if (s.phase === 'won') memo.freezeBombs ??= s.phaseT0;
  else if (s.phase !== 'over') memo.freezeBombs = null;
  const tick = memo.freezeAll ?? s.tick;
  return { tick, bombTick: memo.freezeAll ?? memo.freezeBombs ?? s.tick, frame };
}

export function buildBattleFrame(s: RoundState, vis: RomBattleVis, a: RomAssets, frame: number, opts: BuildOpts = {}): PpuFrame {
  const ar = a.arena(s.stage);
  const tb = romTables(a);
  const memo = romMemo(s);
  const clock = battleClock(s, memo, frame);
  const heads = opts.hudHeads === false ? [] : headOverrides(s.players.map(p => (p.present ? headTiles(a.character(p.char), p.slot) : null)));
  const headKey = opts.hudHeads === false ? 'rom' : s.players.map(p => (p.present ? p.char : '-')).join(',');
  const tiles = sceneryTiles(ar, clock.tick, heads, headKey, opts.tileCopies);
  const cgram = sceneryCgram(opts.palAnim === false ? { ...ar, palAnim: [] } : ar, clock.tick, frame, opts.blink !== false);
  const scene = readScene(s, clock.tick, memo);
  const bg2 = fieldWords(s, ar, scene, tb, clock, t => a.bombScript(t));
  const bg1 = Uint16Array.from(ar.bg1.subarray(0, 1024));
  bg1.set(hudWords(ar.hudMap, s.clock.sec, s.players.map(p => p.present), vis.crowns ?? NO_CROWNS, tb.crownWord), HUD_MAP_ROW * MAP_W);
  const b = new FrameBuilder(bg1, bg2, cgram);
  if (opts.sprites !== false) drawSprites(b, { s, a, tb, scene, clock, memo, tiles });
  for (const l of opts.layers ?? romLayers) l.draw(s, b, a, frame);
  const math = ar.colorMath;
  const bands: ScanBand[] = [
    { y0: 0, y1: 24, bg1Tile16: false, bg1: [HUD_HOFS, HUD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS], main: BG1 | OBJ, sub: 0, math: 'none' },
    { y0: 24, y1: 224, bg1Tile16: true, bg1: [b.hofs1, FIELD_VOFS], bg2: [FIELD_HOFS, FIELD_VOFS],
      main: BG1 | BG2 | OBJ, sub: math === 'none' ? 0 : BG2, math },
  ];
  return {
    cgram: b.cg,
    bg1: { map: b.bg1, mapW: 32, tiles, tile16: true, hofs: b.hofs1, vofs: FIELD_VOFS },
    bg2: { map: b.bg2, mapW: 32, tiles, tile16: true, hofs: FIELD_HOFS, vofs: FIELD_VOFS },
    bands,
    objTiles: ar.objCommon,
    oam: b.oam(),
  };
}

const images = new WeakMap<CanvasRenderingContext2D, ImageData>();
let warned = false;

export function drawRomBattle(ctx: CanvasRenderingContext2D, round: RoundState, vis: RomBattleVis, assets: RomAssets, frame: number): boolean {
  let f: PpuFrame;
  try {
    f = buildBattleFrame(round, vis, assets, frame);
  } catch (e) {
    if (!warned) { console.warn('Crown Blast: gráficos da ROM indisponíveis nesta partida; usando a arte própria.', e); warned = true; }
    return false;
  }
  let img = images.get(ctx);
  if (!img) { img = ctx.createImageData(256, 224); images.set(ctx, img); }
  renderPpu(f, img);
  ctx.putImageData(img, 0, 0);
  return true;
}
