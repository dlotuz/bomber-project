// hit.ts (T12)
import type { GameEvent, Player, RoundState } from './types';
export function isImmune(_s: RoundState, _p: Player): boolean { return false; }
export function tickInv(_p: Player): void {}
export function checkHit(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function hitPlayer(_s: RoundState, _p: Player, _cause: 'flame' | 'pressure', _ev: GameEvent[]): void {}
export function tickDeath(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function stunPlayer(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
