// actions.ts (T9)
import type { GameEvent, Player, RoundState } from './types';
export function tickAct(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function playerActions(_s: RoundState, _p: Player, _btn: number, _pressed: number, _released: number, _ev: GameEvent[]): void {}
export function startPPunch(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function applyPush(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
