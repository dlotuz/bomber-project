import type { Rules, RoundState } from './types';
import { createRound } from './round';

export interface MatchState { rules: Rules; stage: number; seed: number; roundNo: number; crowns: number[]; over: boolean }

export function createMatch(rules: Rules, stage: number, seed: number): MatchState {
  const r: Rules = { ...rules, teams: [...rules.teams], active: [...rules.active] };
  return { rules: r, stage, seed: seed >>> 0, roundNo: 0, crowns: [0, 0, 0, 0, 0], over: false };
}

export function startRound(m: MatchState): RoundState {
  m.roundNo++;
  return createRound(m.stage, m.rules, (m.seed + Math.imul(m.roundNo, 0x9e3779b1)) >>> 0);
}

export function finishRound(m: MatchState, r: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  if (r.phase !== 'result' || r.counted) {
    const champions = [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
    return { winners: [], matchOver: m.over, champions };
  }
  r.counted = true;
  for (const w of r.winners) m.crowns[w]++;
  const champions = [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
  m.over = champions.length > 0;
  return { winners: [...r.winners], matchOver: m.over, champions };
}
