// bad-bomber.ts (T15)
import type { GameEvent, Player, RoundState } from './types';
export function becomeBad(_s: RoundState, p: Player): void { p.state = 'out'; }
export function tickBadBombers(_s: RoundState, _inputs: readonly number[], _ev: GameEvent[]): void {}
export function clearBadBombers(_s: RoundState, _ev: GameEvent[]): void {}
