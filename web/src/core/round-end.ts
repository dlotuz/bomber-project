// round-end.ts (T14)
import type { GameEvent, RoundState } from './types';
export function groupsStanding(_s: RoundState): number { return 2; }
export function checkRoundEnd(_s: RoundState, _ev: GameEvent[]): void {}
export function tickEndPhases(_s: RoundState, _ev: GameEvent[]): void {}
