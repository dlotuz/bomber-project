import type { RoundState } from '../types';

export interface AiLevel { react: number; mistake: number; hunt: boolean; margin: number; open: boolean; alert: number; trap: boolean; wary: boolean }

/** Fraco, Normal, Forte (índice = rules.cpuLevel). Mesmos valores do legado. */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4, open: false, alert: 20, trap: false, wary: false },
  { react: 8, mistake: 5, hunt: true, margin: 8, open: true, alert: 2, trap: false, wary: true },
  { react: 2, mistake: 0, hunt: true, margin: 4, open: true, alert: 0, trap: true, wary: false },
];

export interface AiState { round: RoundState | null; brains: unknown[]; bombsSig: number }

export function createAi(): AiState { return { round: null, brains: [], bombsSig: 0 }; }

/** 0..99 derivado só de (tick, slot, sal): a IA não consome o RNG do jogo. */
export function aiRoll(tick: number, slot: number, salt: number): number {
  let h = Math.imul(tick + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}

export function aiInputs(_s: RoundState, _ai: AiState, _cpu: readonly boolean[], _levelIdx: number): number[] {
  return [0, 0, 0, 0, 0];
}
