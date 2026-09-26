import { defaultRules, type GameEvent, type Player, type RoundState, type Rules } from '../../src/core/types';
import { emptyRound } from '../../src/core/state';
import { makeRng } from '../../src/core/rng';
import { step } from '../../src/core/step';
import { cellOf, centerX, centerY } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';
import { MOUNTS } from '../../src/core/mounts';
import type { MountModule, StageModule } from '../../src/core/hooks';

export const C = cellOf;

export function rules(p: Partial<Rules> = {}): Rules {
  return { ...defaultRules(), ...p };
}

/** Arena de teste: paredes + pilares (col ímpar × lin par), sem soft; fase `play` no tick 100.
 *  Os `players` primeiros slots ficam presentes nos spawns (1 px fora do centro, como na ROM). */
export function arena(opts: { stage?: number; players?: number; rules?: Partial<Rules>; seed?: number } = {}): RoundState {
  const n = opts.players ?? 2;
  const r = rules({ active: [0, 1, 2, 3, 4].map(i => i < n), ...opts.rules });
  const s = emptyRound(opts.stage ?? 1, r, makeRng(opts.seed ?? 0x12));
  s.phase = 'play'; s.tick = 100; s.phaseT0 = 100;
  return s;
}

/** Põe o jogador `slot` no centro da casa (col, lin), deslocado (dx, dy) px. */
export function put(s: RoundState, slot: number, col: number, lin: number, dx = 0, dy = 0): Player {
  const p = s.players[slot];
  p.present = true; p.state = 'alive';
  p.x = centerX(col) + dx * 256; p.y = centerY(lin) + dy * 256;
  return p;
}

export function setCell(s: RoundState, col: number, lin: number, code: number): void { s.grid[cellOf(col, lin)] = code; }
export function codeAt(s: RoundState, col: number, lin: number): number { return s.grid[cellOf(col, lin)]; }

type Inputs = readonly number[] | ((s: RoundState) => readonly number[]);

/** Roda `n` passos; devolve todos os eventos. */
export function run(s: RoundState, n: number, inputs: Inputs = [0, 0, 0, 0, 0]): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...step(s, typeof inputs === 'function' ? inputs(s) : inputs));
  return out;
}

/** Roda até `pred` ficar verdadeiro (no máximo `max` passos). Devolve o tick em que ficou, ou −1. */
export function runUntil(s: RoundState, pred: (s: RoundState, ev: GameEvent[]) => boolean, max = 20000, inputs: Inputs = [0, 0, 0, 0, 0]): number {
  for (let i = 0; i < max; i++) {
    const ev = step(s, typeof inputs === 'function' ? inputs(s) : inputs);
    if (pred(s, ev)) return s.tick;
  }
  return -1;
}

/** Roda `fn` com o módulo `mod` na arena `k` e restaura o módulo anterior no fim (mesmo com erro). */
export function withStage<T>(k: number, mod: StageModule, fn: () => T): T {
  const old = STAGES[k];
  STAGES[k] = mod;
  try { return fn(); } finally { STAGES[k] = old; }
}

/** Roda `fn` com o módulo de montarias `mod` e restaura o anterior no fim (mesmo com erro). */
export function withMount<T>(mod: MountModule, fn: () => T): T {
  const old = MOUNTS.current;
  MOUNTS.current = mod;
  try { return fn(); } finally { MOUNTS.current = old; }
}
