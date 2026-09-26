// movement.ts (T4)
import { BTN, type GameEvent, type Player, type RoundState } from './types';
export function nibble(btn: number): number {
  return (btn & BTN.RIGHT ? 1 : 0) | (btn & BTN.LEFT ? 2 : 0) | (btn & BTN.DOWN ? 4 : 0) | (btn & BTN.UP ? 8 : 0);
}
export function blockedFor(_p: Player, _v: number): [boolean, boolean] { return [false, false]; }
export function moveStep(_s: RoundState, _p: Player, _btn: number, _level: number): number { return 8; }
export function movePlayer(_s: RoundState, _p: Player, _btn: number, _ev: GameEvent[]): void {}
