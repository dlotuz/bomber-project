// "E se?": cópias da rodada para a IA testar uma ação (soco, P, luva, chute, X, B) antes de fazê-la.
import type { RoundState } from '../types';
import { playerCell } from '../state';
import { SAFE, hazards } from './danger';
import { escape, hits, walkBlocked } from './nav';
import type { AiLevel } from './level';

/** Cópia da rodada em que tudo o que o passo do núcleo escreve (grade, tempos e peças das casas, bombas, voadores,
 *  jogadores com empurrão/efeito/montaria, pressão com as quedas, Bad Bombers, relógio, RNG e o estado das arenas e
 *  das montarias) pode ser alterado sem mexer na original. `rules` fica compartilhado (só leitura). */
export function fork(s: RoundState): RoundState {
  return {
    ...s,
    rng: { ...s.rng }, clock: { ...s.clock },
    grid: s.grid.slice(), cellT0: s.cellT0.slice(), cellAux: s.cellAux.slice(), floor: s.floor.slice(),
    hidden: s.hidden.map(h => [h[0], h[1]]),
    bombs: s.bombs.map(b => ({ ...b })),
    flyers: s.flyers.map(f => ({ ...f })),
    players: s.players.map(p => ({
      ...p, push: { ...p.push }, effect: { ...p.effect }, mount: p.mount === null ? null : structuredClone(p.mount),
    })),
    pressure: { ...s.pressure, falling: s.pressure.falling.map(f => ({ ...f })) },
    bad: s.bad.map(b => ({ ...b })),
    stageState: structuredClone(s.stageState), mountState: structuredClone(s.mountState),
    result: s.result && { ...s.result },
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
