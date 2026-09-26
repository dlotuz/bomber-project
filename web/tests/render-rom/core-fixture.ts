import { BTN, createMatch, defaultRules, startRound, step, type GameEvent, type RoundState } from '../../src/core';

export { BTN };
export const NO_INPUT: readonly number[] = [0, 0, 0, 0, 0];

/** Rodada da fase `stage`: 5 jogadores, personagens 0..4, regras padrão (3:00), semente do boot ($0012). */
export function newRound(stage: number): RoundState {
  return startRound(createMatch(defaultRules(), stage, 0x12, [0, 1, 2, 3, 4]));
}

export function stepN(s: RoundState, n: number, inputs: readonly number[] = NO_INPUT): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...step(s, inputs));
  return ev;
}

/** Avança a intro (62 ticks) sem entradas. */
export function toPlay(s: RoundState, max = 200): void {
  for (let i = 0; i < max && s.phase === 'intro'; i++) step(s, NO_INPUT);
  if (s.phase !== 'play') throw new Error(`rodada em ${s.phase}, esperado play`);
}
