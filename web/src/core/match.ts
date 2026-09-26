import type { RoundState, Rules } from './types';
import { BOOT_SEED, makeRng, permuteSpawns, type Rng16 } from './rng';
import { createRound } from './setup';

export interface MatchState {
  rules: Rules; stage: number; rng: Rng16; roundNo: number; crowns: number[]; over: boolean;
  racerPrize: { slot: number; prize: number } | null;
  spawnSeed: number;                 // semente do RNG separado das opções extras
  chars: number[];
}

export function createMatch(rules: Rules, stage: number, seed: number | Rng16 = BOOT_SEED, chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const rng = typeof seed === 'number' ? makeRng(seed) : { seed: seed.seed };
  return {
    rules: { ...rules, teams: [...rules.teams], active: [...rules.active] }, stage, rng, roundNo: 0,
    crowns: [0, 0, 0, 0, 0], over: false, racerPrize: null, spawnSeed: rng.seed, chars: [...chars],
  };
}

export function startRound(m: MatchState): RoundState {
  m.roundNo++;
  const spawnOrder = m.rules.randomSpawns ? permuteSpawns(m.spawnSeed + m.roundNo) : undefined;
  return createRound(m.stage, m.rules, { seed: m.rng.seed }, { racerPrize: m.racerPrize, spawnOrder, chars: m.chars });
}

export function finishRound(m: MatchState, s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  const champions = (): number[] => [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
  if (s.phase !== 'over' || s.counted || !s.result) return { winners: [], matchOver: m.over, champions: champions() };
  s.counted = true;
  m.rng = { seed: s.rng.seed };
  let winners: number[] = [];
  const w = s.result.winner;
  if (s.result.kind === 'win' && w !== null) {
    winners = m.rules.mode === 'team'
      ? [0, 1, 2, 3, 4].filter(i => m.rules.active[i] && m.rules.teams[i] === m.rules.teams[w])
      : [w];
  }
  for (const i of winners) m.crowns[i]++;
  const ch = champions();
  m.over = ch.length > 0;
  return { winners, matchOver: m.over, champions: ch };
}

export function setRacerPrize(m: MatchState, slot: number, prize: number): void { m.racerPrize = { slot, prize }; }
export function clearRacerPrize(m: MatchState): void { m.racerPrize = null; }
