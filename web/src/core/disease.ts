// disease.ts (T11)
import type { GameEvent, Player, RoundState } from './types';
export function applyDiseaseInput(_s: RoundState, _p: Player, btn: number): number { return btn; }
export function speedLevel(_s: RoundState, p: Player): number { return p.speedLv; }
export function tickDisease(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function inContact(_a: Player, _b: Player): boolean { return false; }
export function contagion(_s: RoundState, _ev: GameEvent[]): void {}
export function rollSkull(_s: RoundState): number { return 0x21; }
export function cureAndThrow(_s: RoundState, _p: Player, _ev: GameEvent[]): void {}
export function invisibleVisible(_p: Player): boolean { return true; }
