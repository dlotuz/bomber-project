import type { StageModule } from '../hooks';
import type { RoundState } from '../types';
import { cellOf } from '../units';
import type { Reel, Stage8State } from './state';

/** Pads (4,7), (8,7), (12,7) = A8_PADS (conferido com a ROM no teste da T9). */
export const PADS = [cellOf(4, 7), cellOf(8, 7), cellOf(12, 7)];
export const REEL_MASK = [4, 2, 1];
export const PAD_IDLE = 0x1c6e;
export const PAD_LIT = 0x1c4e;
export const sym = (r: Reel): number => (r.pos >> 3) & 3;
export function newStage8(): Stage8State {
  const reel = (): Reel => ({ pos: 0, calls: 0, delay: 1, delayCnt: 0, braking: false });
  return { started: false, phase: 'idle', reels: [reel(), reel(), reel()], turn: 0, stopped: 0, lastStopped: 0,
    click: false, jackpotUsed: false, prize: null, falls: [], lastRoutine: 0 };
}
export const st8 = (s: RoundState): Stage8State => (s.stageState ??= newStage8()) as Stage8State;
export const stage8: StageModule = {};
