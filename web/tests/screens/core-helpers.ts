import { step, type MatchState, type RoundState } from '../../src/game/core-api';

export const IDLE: readonly number[] = [0, 0, 0, 0, 0];
/** Tira de jogo todos os presentes menos `winner` (a regra de fim da §3.12 decide 2 ticks depois). */
export function forceWin(r: RoundState, winner: number): void {
  r.players.forEach((p, i) => { if (p.present && i !== winner) p.state = 'out'; });
}
export function forceAllDead(r: RoundState): void { r.players.forEach(p => { if (p.present) p.state = 'out'; }); }
/** Põe o relógio em `sec` com `sub = 1`: o próximo tick de relógio passa para `sec − 1`. */
export function forceClock(r: RoundState, sec: number): void { r.clock.sec = sec; r.clock.sub = 1; }
export function runUntil(r: RoundState, pred: (r: RoundState) => boolean, max = 4000, pads: readonly number[] = IDLE): number {
  let n = 0;
  while (!pred(r) && n < max) { step(r, [...pads]); n++; }
  if (!pred(r)) throw new Error(`runUntil: condição não atingida em ${max} passos`);
  return n;
}
export const skipIntro = (r: RoundState): number => runUntil(r, x => x.phase !== 'intro');
export function setCrowns(m: MatchState, slot: number, n: number): void { (m.crowns as number[])[slot] = n; }
