// match.ts (T14)
import type { RoundState, Rules } from './types';
import { makeRng, type Rng16 } from './rng';
import { createRound } from './setup';
export interface MatchState {
  rules: Rules; stage: number; rng: Rng16; roundNo: number; crowns: number[]; over: boolean;
  racerPrize: { slot: number; prize: number } | null; spawnSeed: number; chars: number[];
}
export function createMatch(rules: Rules, stage: number, seed: number | Rng16 = 0x12, chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const rng = typeof seed === 'number' ? makeRng(seed) : { seed: seed.seed };
  return { rules: { ...rules, teams: [...rules.teams], active: [...rules.active] }, stage, rng, roundNo: 0,
    crowns: [0, 0, 0, 0, 0], over: false, racerPrize: null, spawnSeed: rng.seed, chars: [...chars] };
}
export function startRound(m: MatchState): RoundState { m.roundNo++; return createRound(m.stage, m.rules, { seed: m.rng.seed }); }
export function finishRound(_m: MatchState, _s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  return { winners: [], matchOver: false, champions: [] };
}
export function setRacerPrize(m: MatchState, slot: number, prize: number): void { m.racerPrize = { slot, prize }; }
export function clearRacerPrize(m: MatchState): void { m.racerPrize = null; }
