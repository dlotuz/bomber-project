import type { GameEvent, RoundResult, RoundState } from './types';
import { CELEBRATE_TICKS, TIME_UP_TICKS, VICTORY_SFX_AT, WIN_DELAY } from './constants';
import { setAct, standing } from './state';
import { dropHeld } from './flyers';
import { landNow, releaseGrab } from './grab';

export function groupsStanding(s: RoundState): number {
  const st = s.players.filter(standing);
  return s.rules.mode === 'team' ? new Set(st.map(p => p.team)).size : st.length;
}

const winnerSlot = (s: RoundState): number | null => s.players.find(standing)?.slot ?? null;

function finish(s: RoundState, ev: GameEvent[], result: RoundResult): void {
  s.phase = 'over'; s.phaseT0 = s.tick; s.result = result;
  ev.push({ type: 'round_over', result });
}

export function checkRoundEnd(s: RoundState, _ev: GameEvent[]): void {
  if (s.phase !== 'play') return;
  if (s.endAt === 0) { if (groupsStanding(s) <= 1) s.endAt = s.tick + WIN_DELAY; return; }
  if (s.tick !== s.endAt || groupsStanding(s) !== 1) return;
  s.phase = 'won'; s.phaseT0 = s.tick;
  for (const p of s.players) {
    if (!standing(p)) continue;
    if (p.carry >= 0) dropHeld(s, p);
    if (p.grab >= 0) releaseGrab(s, p);
    landNow(s, p);
    p.push.left = 0;
    setAct(s, p, 'victory', 0);
  }
}

export function tickEndPhases(s: RoundState, ev: GameEvent[]): void {
  const dying = s.players.some(p => p.present && p.state === 'dying');
  if (s.phase === 'play') {
    if (s.endAt && s.tick >= s.endAt && groupsStanding(s) === 0 && !dying) finish(s, ev, { kind: 'draw', winner: null, reason: 'dead' });
    return;
  }
  if (s.phase === 'won') {
    if (s.celebT0 < 0) { if (dying) return; s.celebT0 = s.tick; }
    if (s.tick === s.celebT0 + VICTORY_SFX_AT) ev.push({ type: 'victory_sfx', slot: winnerSlot(s) ?? 0 });
    if (s.tick >= s.celebT0 + CELEBRATE_TICKS) finish(s, ev, { kind: 'win', winner: winnerSlot(s), reason: 'last' });
    return;
  }
  if (s.phase === 'timeUp' && s.tick >= s.phaseT0 + TIME_UP_TICKS) finish(s, ev, { kind: 'draw', winner: null, reason: 'time' });
}
