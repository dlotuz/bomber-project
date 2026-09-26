import type { GameEvent, RoundState } from './types';
import { CLOCK_FROZEN_FROM, TIME_MINUTES } from './constants';
import { triggerPressure } from './pressure';
import { groupsStanding } from './round-end';

export function initClock(timeIdx: number): { sec: number; sub: number } {
  return { sec: (TIME_MINUTES[timeIdx] ?? 3) * 60 + 1, sub: 1 };
}
export function pressureTriggerSec(timeIdx: number): number { return timeIdx === 0 ? 41 : 61; }
export function clockText(c: { sec: number }): string { return `${Math.floor(c.sec / 60)}:${String(c.sec % 60).padStart(2, '0')}`; }

export function tickClock(s: RoundState, ev: GameEvent[]): void {
  const c = s.clock;
  if (c.sec >= CLOCK_FROZEN_FROM || c.sec <= 0) return;     // 0:00 fica parado (nunca −1:−1)
  if (--c.sub > 0) return;
  c.sec--; c.sub = 60;
  if (s.phase !== 'play') return;
  if (c.sec === pressureTriggerSec(s.rules.timeIdx)) triggerPressure(s, ev);
  if (c.sec === 0 && groupsStanding(s) >= 2) { s.phase = 'timeUp'; s.phaseT0 = s.tick; ev.push({ type: 'time_up' }); }
}
