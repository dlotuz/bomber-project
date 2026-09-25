import { createRound, step } from '../../src/core/round';
import { defaultRules, CELL, type Rules, type RoundState, type Bomb, type GameEvent } from '../../src/core/types';
import { centerX, centerY } from '../../src/core/grid';

export function newRound(opts: Partial<Rules> & { stage?: number; seed?: number; clear?: boolean } = {}): RoundState {
  const { stage = 1, seed = 1, clear = false, ...r } = opts;
  const s = createRound(stage, { ...defaultRules(), randomSpawns: false, ...r }, seed);
  if (clear) clearSoft(s);
  while (s.phase === 'intro') step(s, [0, 0, 0, 0, 0]);
  return s;
}

export function run(s: RoundState, n: number, inputs: number[] = [0, 0, 0, 0, 0]): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...step(s, inputs));
  return ev;
}

export function input(slot: number, bits: number): number[] {
  const a = [0, 0, 0, 0, 0]; a[slot] = bits; return a;
}

export function clearSoft(s: RoundState): void {
  s.arena.cells = s.arena.cells.map(c => (c === CELL.SOFT ? CELL.EMPTY : c));
  s.arena.hidden.fill(0);
}

export function place(s: RoundState, slot: number, gx: number, gy: number): void {
  s.players[slot].x = centerX(gx); s.players[slot].y = centerY(gy);
}

export function addBomb(s: RoundState, gx: number, gy: number, fuse = 999, range = 2, owner = 4, passers: number[] = []): Bomb {
  const b: Bomb = { id: s.nextBombId++, owner, x: centerX(gx), y: centerY(gy), fuse, range, pierce: false,
    passers, slide: 0, flight: null, carried: false };
  s.bombs.push(b);
  return b;
}
