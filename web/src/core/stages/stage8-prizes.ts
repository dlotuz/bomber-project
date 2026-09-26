import type { GameEvent, RoundState } from '../types';
import type { Stage8State } from './state';
export function startPrize(_s: RoundState, _a: Stage8State, _routine: number, _ev: GameEvent[]): void {}
/** true = o prêmio terminou (a máquina volta a parada no tick seguinte). */
export function tickPrize(_s: RoundState, _a: Stage8State, _ev: GameEvent[]): boolean { return true; }
export function tickFalls(_s: RoundState, _a: Stage8State, _ev: GameEvent[]): void {}
