// Porta única do plano 10 para o núcleo (plano 6). Se um nome do núcleo mudar, só este arquivo muda.
import * as core from '../core';
import type { MatchState, RoundState, RoundResult, GameEvent, Rules } from '../core';

export { BTN, startRound, step, finishRound, createAi, aiInputs, defaultRules, rnd, drawRacerPrize } from '../core';
export type { MatchState, RoundState, GameEvent, Rules, RoundResult, Rng16, AiState, Phase } from '../core';

export interface RacerPrize { slot: number; prize: number }          // prize = índice na tabela $C2:08F4 (0..16)
export interface MatchCarry { seed: number | null; racerPrize: RacerPrize | null }
export type RacerPrizeKey = 'bomb+1' | 'pierce' | 'fire+1' | 'fullFire' | 'speed+1' | 'remote+glove' | 'glove' | 'kick'
  | 'none' | 'passBomb' | 'passSoft' | 'speed-1' | 'punch' | 'heart' | 'p';

export const RACER_PRIZE_COUNT: number = core.RACER_PRIZES;   // 17
/** Tabela `$C2:08F4` por índice (decisão 18 do plano 6; efeitos em `core/racer.ts` `applyRacerPrize`). */
const RACER_KEYS: readonly RacerPrizeKey[] = ['bomb+1', 'pierce', 'fire+1', 'fullFire', 'speed+1', 'remote+glove', 'glove',
  'glove', 'kick', 'none', 'none', 'passBomb', 'passSoft', 'speed-1', 'punch', 'heart', 'p'];
export function racerPrizeKey(i: number): RacerPrizeKey { return RACER_KEYS[i]; }

export function newMatch(rules: Rules, stage: number, seed: number, prize: RacerPrize | null,
  chars: readonly number[] = [0, 1, 2, 3, 4]): MatchState {
  const m = core.createMatch(rules, stage, seed, chars);
  if (prize) core.setRacerPrize(m, prize.slot, prize.prize);
  return m;
}
export const finishRoundInfo = (m: MatchState, s: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } =>
  core.finishRound(m, s);
/** Ticks desde o início da fase atual. */
export const phaseElapsed = (r: RoundState): number => r.tick - r.phaseT0;
export const crownsOf = (m: MatchState): readonly number[] => m.crowns;
/** Coroas para vencer (1..5). */
export const matchGoal = (m: MatchState): number => m.rules.matches;
/** Estado de 16 bits do RNG da partida. */
export const matchRngState = (m: MatchState): number => m.rng.seed;
export const isDraw = (r: RoundResult): boolean => r.kind === 'draw';
export const drawReason = (r: RoundResult): 'time' | 'dead' | null =>
  (r.kind !== 'draw' ? null : r.reason === 'time' ? 'time' : 'dead');
const teamOf = (m: MatchState, slot: number): number[] =>
  m.rules.active.flatMap((on, i) => (on && m.rules.teams[i] === m.rules.teams[slot] ? [i] : []));
/** [] no empate; no modo equipes, todos os ativos do time vencedor. */
export function roundWinnerSlots(m: MatchState, r: RoundResult): number[] {
  if (r.kind !== 'win' || r.winner === null) return [];
  return m.rules.mode === 'team' ? teamOf(m, r.winner) : [r.winner];
}
export const isMatchOver = (m: MatchState): boolean => m.crowns.some(c => c >= m.rules.matches);
export function championSlots(m: MatchState): number[] {
  const first = m.crowns.findIndex(c => c >= m.rules.matches);
  if (first < 0) return [];
  return m.rules.mode === 'team' ? teamOf(m, first) : [first];
}
export const eventType = (e: GameEvent): string => e.type;
