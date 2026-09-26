// setup.ts (T5)
import type { RoundState, Rules } from './types';
import type { Rng16 } from './rng';
import { emptyRound } from './state';
export interface RoundOptions {
  racerPrize?: { slot: number; prize: number } | null;
  spawnOrder?: readonly number[];
  chars?: readonly number[];
}
export function createRound(stage: number, rules: Rules, rng: Rng16, _opts: RoundOptions = {}): RoundState {
  return emptyRound(stage, rules, rng);
}
