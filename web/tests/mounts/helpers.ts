import { arena } from '../core/kit';
import { step } from '../../src/core/step';
import { BTN, type RoundState, type Player, type GameEvent } from '../../src/core/types';
import type { MountRider } from '../../src/core/mounts/types';

export { BTN };
export const cx = (col: number): number => 16 * col - 1;           // px
export const cy = (lin: number): number => 16 * (lin + 2) - 1;     // px
export const X = (p: Player): number => p.x / 256;
export const Y = (p: Player): number => p.y / 256;

export interface MkOpts { stage?: number; players?: number[]; seed?: number }

/** Rodada em `play` (tick 100), sem soft e sem itens escondidos; só os slots de `players` presentes (padrão P1 e P2). */
export function mkRound(o: MkOpts = {}): RoundState {
  const players = o.players ?? [0, 1];
  const s = arena({ stage: o.stage ?? 1, seed: o.seed ?? 0x12, rules: { active: [0, 1, 2, 3, 4].map(i => players.includes(i)) } });
  s.hidden = [];
  return s;
}

export function placePx(s: RoundState, slot: number, xPx: number, yPx: number): Player {
  const p = s.players[slot];
  p.x = xPx * 256; p.y = yPx * 256; p.moveDir = 8;
  return p;
}

/** Coloca o jogador já montado (fase riding) na menor vaga livre. */
export function ride(s: RoundState, slot: number, type: number, extra: Partial<MountRider> = {}): MountRider {
  const used = new Set(s.players.map(q => (q.mount as MountRider | null)?.slot ?? 0));
  const r: MountRider = { type, slot: used.has(1) ? 2 : 1, phase: 'riding', t0: s.tick, reserves: [], trail: [], cooldown: 0, remount: false, ...extra };
  s.players[slot].mount = r;
  return r;
}

export function btns(map: Partial<Record<number, number>> = {}): number[] {
  return [0, 1, 2, 3, 4].map(i => map[i] ?? 0);
}

/** n passos com os mesmos botões; devolve todos os eventos. */
export function run(s: RoundState, n: number, map: Partial<Record<number, number>> = {}): GameEvent[] {
  const all: GameEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...step(s, btns(map)));
  return all;
}

/** Passa 1 tick por vez até pred() ser verdadeiro; devolve k (1 = o 1º passo) ou −1. */
export function firstTick(s: RoundState, maxK: number, pred: () => boolean, map: Partial<Record<number, number>> = {}): number {
  for (let k = 1; k <= maxK; k++) { run(s, 1, map); if (pred()) return k; }
  return -1;
}

/** Chama recém-criada numa casa (decisão 11 do plano 6: cellT0 = tick, cellAux = peça). */
export function flameAt(s: RoundState, cell: number): void {
  s.grid[cell] = 0x1000; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
}

/** Casas das bombas (paradas ou deslizando). */
export function bombCells(s: RoundState): number[] {
  return s.bombs.map(b => b.cell);
}
