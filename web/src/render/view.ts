import { FLAME_FRAMES, type GameEvent, type RoundState } from '../core';
import type { FlamePart } from './art/flames';

export interface ExplosionFx { gx: number; gy: number; arms: [number, number, number, number]; age: number }

export interface ViewState {
  roundKey: RoundState | null;
  explosions: ExplosionFx[];
  walk: number[];
  lastPos: [number, number][];
}

export function createView(): ViewState {
  return { roundKey: null, explosions: [], walk: [0, 0, 0, 0, 0], lastPos: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
}

/** Atualiza a visão depois de um tick do core (ou de um tick parado, com `events` vazio). */
export function updateView(v: ViewState, round: RoundState, events: GameEvent[]): void {
  if (v.roundKey !== round) {
    v.roundKey = round;
    v.explosions = [];
    v.walk = [0, 0, 0, 0, 0];
    v.lastPos = round.players.map(p => [p.x, p.y] as [number, number]);
  }
  for (const e of v.explosions) e.age++;
  v.explosions = v.explosions.filter(e => e.age < FLAME_FRAMES);
  for (const e of events) if (e.type === 'explosion') v.explosions.push({ gx: e.gx, gy: e.gy, arms: e.arms, age: 0 });
  round.players.forEach((p, i) => {
    const [lx, ly] = v.lastPos[i];
    v.walk[i] = p.x !== lx || p.y !== ly ? v.walk[i] + 1 : 0;
    v.lastPos[i] = [p.x, p.y];
  });
}

const WALK_SEQ = [1, 0, 2, 0];

export function walkFrame(counter: number): number {
  return counter === 0 ? 0 : WALK_SEQ[(counter >> 3) & 3];
}

export function flameShrink(age: number): number {
  if (age < 2) return 2;
  if (age < 4) return 1;
  const left = FLAME_FRAMES - age;
  if (left <= 3) return 2;
  if (left <= 7) return 1;
  return 0;
}

export interface FlameCell { gx: number; gy: number; part: FlamePart }

const ARM_DIRS: [number, number, FlamePart, FlamePart][] = [
  [0, -1, 'v', 'up'], [0, 1, 'v', 'down'], [-1, 0, 'h', 'left'], [1, 0, 'h', 'right'],
];

export function flameCells(e: ExplosionFx): FlameCell[] {
  const out: FlameCell[] = [{ gx: e.gx, gy: e.gy, part: 'center' }];
  e.arms.forEach((len, d) => {
    const [dx, dy, mid, tip] = ARM_DIRS[d];
    for (let r = 1; r <= len; r++) out.push({ gx: e.gx + dx * r, gy: e.gy + dy * r, part: r === len ? tip : mid });
  });
  return out;
}

export function formatClock(frames: number): string {
  if (frames < 0) return '--:--';
  const secs = Math.ceil(frames / 60);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/** Pisca durante a animação de morte e some nos últimos 20 frames. */
export function dyingVisible(dying: number): boolean {
  if (dying <= 0) return true;
  if (dying < 20) return false;
  return ((dying >> 2) & 1) === 0;
}

export function roundOverText(winners: number[], mode: 'ffa' | 'team', teams: number[]): string {
  if (winners.length === 0) return 'EMPATE!';
  if (mode === 'team') return teams[winners[0]] === 0 ? 'TIME VERMELHO VENCEU!' : 'TIME BRANCO VENCEU!';
  return `P${winners[0] + 1} VENCEU!`;
}
