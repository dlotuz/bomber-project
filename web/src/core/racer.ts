// racer.ts (T5)
import type { Player } from './types';
import { rnd, type Rng16 } from './rng';
export const RACER_PRIZES = 17;
export function applyRacerPrize(_p: Player, _prize: number): void {}
export function drawRacerPrize(rng: Rng16): number { return rnd(rng, RACER_PRIZES); }
