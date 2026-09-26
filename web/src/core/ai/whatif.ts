// "E se?": cópias rasas da rodada para a IA testar uma ação (soco, P, luva, chute, X, B) antes de fazê-la.
import type { RoundState } from '../types';
import { playerCell } from '../state';
import { SAFE, hazards } from './danger';
import { escape, hits, walkBlocked } from './nav';
import type { AiLevel } from './level';

/** Cópia da rodada em que grade, bombas, voadores e jogadores podem ser alterados sem mexer na original. */
export function fork(s: RoundState): RoundState {
  return {
    ...s, grid: s.grid.slice(), cellT0: s.cellT0, bombs: s.bombs.map(b => ({ ...b })),
    flyers: s.flyers.map(f => ({ ...f })), players: s.players.map(p => ({ ...p })),
  };
}

/** Na rodada `sim`, o jogador `slot`, travado por `delay` ticks, ainda tem fuga garantida (busca estrita)? */
export function survives(sim: RoundState, slot: number, level: AiLevel, delay: number): boolean {
  const q = sim.players[slot];
  const here = playerCell(q);
  if (here < 0) return false;
  const hz = hazards(sim, slot);
  if (hits(hz, here, 1, delay, level.margin)) return false;
  if (hz.at[here] === SAFE) return true;
  return escape(sim, q, hz, walkBlocked(sim, q), level, true, delay) !== null;
}
