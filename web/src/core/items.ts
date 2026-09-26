// items.ts (T10)
import type { GameEvent, Player, RoundState } from './types';
export function applyItem(_s: RoundState, _p: Player, _id: number, _ev: GameEvent[]): void {}
export function pickup(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function dropCategory(_s: RoundState, _p: Player, _k: number, _ev: GameEvent[]): void {}
export function placeDropped(_s: RoundState, _id: number): number { return -1; }
export function loseItems(_s: RoundState, _p: Player, _n: number, _ev: GameEvent[]): void {}
export function leakOne(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
