// clock.ts (T13)
import type { GameEvent, RoundState } from './types';
import { TIME_MINUTES } from './constants';
export function initClock(timeIdx: number): { sec: number; sub: number } {
  return { sec: (TIME_MINUTES[timeIdx] ?? 3) * 60 + 1, sub: 1 };
}
export function pressureTriggerSec(timeIdx: number): number { return timeIdx === 0 ? 41 : 61; }
export function clockText(c: { sec: number }): string { return `${Math.floor(c.sec / 60)}:${String(c.sec % 60).padStart(2, '0')}`; }
export function tickClock(_s: RoundState, _ev: GameEvent[]): void {}
