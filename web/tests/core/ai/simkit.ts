import { createAi, aiInputs, type AiState } from '../../../src/core/ai';
import { step } from '../../../src/core/step';
import type { GameEvent, RoundState } from '../../../src/core/types';

/** Roda `n` ticks com a IA nos slots `cpu`; os outros ficam parados. */
export function play(s: RoundState, cpu: boolean[], level: number, n: number, ai: AiState = createAi()): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n && s.phase !== 'over'; i++) ev.push(...step(s, aiInputs(s, ai, cpu, level)));
  return ev;
}
