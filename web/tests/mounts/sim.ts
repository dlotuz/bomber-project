import { createMatch, startRound, finishRound, step, defaultRules, type Rules } from '../../src/core';
import { createAi, aiInputs } from '../../src/core/ai';
import type { RoundState, GameEvent } from '../../src/core/types';
import { activeCount } from '../../src/core/mounts/eggs';
import { rider } from '../../src/core/mounts/types';

export interface SimResult { s: RoundState; events: GameEvent[]; maxActive: number; ticks: number }

/** $1ED4 sem o +1 transitório do choco (a própria ROM chega a 3 enquanto alguém monta com outro ovo em jogo): é o que
 *  o teto de 2 limita — ovos + montarias + reservas nunca passam de 2 fora do choco. */
export function settledActive(s: RoundState): number {
  return activeCount(s) - s.players.filter(p => rider(p)?.phase === 'mounting').length;
}

/** Rodada só de CPU (5 jogadores, nível Normal) até `over` ou maxTicks. */
export function cpuRound(stage: number, seed: number, maxTicks = 60 * 60 * 4): SimResult {
  const m = createMatch({ ...defaultRules(), cpuLevel: 1 }, stage, seed);   // createMatch(rules, stage, seed) do plano 6
  const s = startRound(m);
  const ai = createAi();
  const events: GameEvent[] = [];
  let maxActive = 0, t = 0;
  for (; t < maxTicks && s.phase !== 'over'; t++) {
    events.push(...step(s, aiInputs(s, ai, [true, true, true, true, true], 1)));
    maxActive = Math.max(maxActive, settledActive(s));
  }
  return { s, events, maxActive, ticks: t };
}
export function rulesWith(active: boolean[]): Rules { return { ...defaultRules(), active }; }
export { createMatch, finishRound, startRound, step };
