// kick.ts (T7)
import type { Bomb, GameEvent, Player, RoundState } from './types';
export function tryKick(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function slideStep(_s: RoundState, _b: Bomb, _ev: GameEvent[]): void {}
export function stopKick(_s: RoundState, _p: Player): void {}
