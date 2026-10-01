import { BURN, CODE, type GameEvent, type RoundState } from '../../core';
import { PLAYER_COLORS } from '../draw-game';
import { cellX, cellY, entX, entY } from './coords';
import { PART, between, clearFx, rand, spawn, type FxState } from './state';

export const DEBRIS_COLOR = 0x8a6a3a;
const SHAKE_ADD = 2.5, SHAKE_MAX = 6, SHAKE_DECAY = 0.85, SHAKE_MIN = 0.3;
const FLASH_STEP = 1 / 6;
const SPARK_COLORS = [0xfff2a0, 0xffc040, 0xff8a2a];
const hex = (s: string): number => Number.parseInt(s.slice(1), 16);

function explosion(fx: FxState, cell: number): void {
  const x = cellX(cell), y = cellY(cell);
  for (let k = 0; k < 18; k++) {
    const a = rand(fx) * Math.PI * 2, v = between(fx, 1.5, 3);
    spawn(fx, { kind: PART.SPARK, color: SPARK_COLORS[k % 3], life: Math.round(between(fx, 14, 24)),
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.08, size: between(fx, 1, 2) });
  }
  for (let k = 0; k < 6; k++) {
    spawn(fx, { kind: PART.SMOKE, color: 0x5a5a60, life: Math.round(between(fx, 36, 48)),
      x: x + between(fx, -6, 6), y: y + between(fx, -6, 6), vx: between(fx, -0.2, 0.2), vy: -0.3, size: 3, grow: 0.17 });
  }
  fx.shake = Math.min(SHAKE_MAX, fx.shake + SHAKE_ADD);
}

function debris(fx: FxState, cell: number, color: number): void {
  const x = cellX(cell), y = cellY(cell);
  for (let k = 0; k < 8; k++) {
    spawn(fx, { kind: PART.DEBRIS, color, life: 30, x: x + between(fx, -5, 5), y: y + between(fx, -5, 5),
      vx: between(fx, -1.4, 1.4), vy: between(fx, -3, -1.5), g: 0.2, size: between(fx, 2, 3), ground: y + 6 });
  }
}

function dust(fx: FxState, cell: number): void {
  const x = cellX(cell), y = cellY(cell) + 6;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    spawn(fx, { kind: PART.DUST, color: 0xd8c8a0, life: 16, x, y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 0.5, size: 2, grow: 0.1 });
  }
}

function burst(fx: FxState, round: RoundState, slot: number): void {
  const p = round.players[slot];
  const x = entX(p.x), y = entY(p.y) - 8 - p.z, color = hex(PLAYER_COLORS[slot]);
  for (let k = 0; k < 24; k++) {
    const a = rand(fx) * Math.PI * 2, v = between(fx, 0.8, 2.4);
    spawn(fx, { kind: PART.BURST, color, life: 30, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, g: 0.05, size: between(fx, 1.5, 2.5) });
  }
  fx.flash = 1;
}

/** Um tick de 60 Hz dos efeitos (spec §3.3): física, eventos → partículas/flash/tremor, decaimentos. */
export function fxUpdate(fx: FxState, round: RoundState, events: readonly GameEvent[], colorAt: (cell: number) => number = () => DEBRIS_COLOR): void {
  if (fx.round !== round) { clearFx(fx); fx.round = round; fx.prevGrid = Int32Array.from(round.grid); }
  for (let i = 0; i < fx.life.length; i++) {
    if (fx.age[i] >= fx.life[i]) continue;
    fx.age[i]++;
    fx.x[i] += fx.vx[i]; fx.y[i] += fx.vy[i]; fx.vy[i] += fx.g[i]; fx.size[i] += fx.grow[i];
    if (fx.y[i] > fx.ground[i]) { fx.y[i] = fx.ground[i]; fx.vy[i] *= -0.4; fx.vx[i] *= 0.6; }
  }
  fx.flash = fx.flash > FLASH_STEP + 1e-9 ? fx.flash - FLASH_STEP : 0;   // antes dos eventos: um acerto novo começa em 1
  const prev = fx.prevGrid!;
  if (round.phase !== 'timeUp' && round.phase !== 'over') {
    for (const e of events) {
      if (e.type === 'explosion') explosion(fx, e.cell);
      else if (e.type === 'player_hit') burst(fx, round, e.slot);
      else if (e.type === 'bomb_landed') dust(fx, e.cell);
    }
    for (let c = 0; c < round.grid.length; c++) {
      if (round.grid[c] === CODE.BURNING && prev[c] !== CODE.BURNING && round.cellAux[c] === BURN.SOFT) debris(fx, c, colorAt(c));
    }
  }
  prev.set(round.grid);
  fx.shake *= SHAKE_DECAY;
  if (fx.shake < SHAKE_MIN) fx.shake = 0;
  fx.dx = fx.shake ? (rand(fx) * 2 - 1) * fx.shake : 0;
  fx.dy = fx.shake ? (rand(fx) * 2 - 1) * fx.shake : 0;
}
