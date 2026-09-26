import { FLAME_PIECE, FLAME_TICKS, clockText, type GameEvent, type RoundState } from '../core';
import type { FlamePart } from './art/flames';

export interface ViewState { roundKey: RoundState | null; walk: number[]; lastPos: [number, number][] }

export function createView(): ViewState {
  return { roundKey: null, walk: [0, 0, 0, 0, 0], lastPos: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]] };
}

/** Atualiza a visão depois de um tick do núcleo. A chama vem da grade; aqui só o ritmo de caminhada. */
export function updateView(v: ViewState, round: RoundState, _events: GameEvent[]): void {
  if (v.roundKey !== round) { v.roundKey = round; v.walk = [0, 0, 0, 0, 0]; v.lastPos = round.players.map(p => [p.x, p.y] as [number, number]); }
  round.players.forEach((p, i) => {
    const [lx, ly] = v.lastPos[i];
    v.walk[i] = p.x !== lx || p.y !== ly ? v.walk[i] + 1 : 0;
    v.lastPos[i] = [p.x, p.y];
  });
}

const WALK_SEQ = [1, 0, 2, 0];
export function walkFrame(counter: number): number { return counter === 0 ? 0 : WALK_SEQ[(counter >> 3) & 3]; }

/** Afinamento da arte de fallback pela idade da chama (0..24). */
export function flameShrink(age: number): number {
  if (age < 2) return 2;
  if (age < 4) return 1;
  const left = FLAME_TICKS - 1 - age;
  if (left <= 3) return 2;
  if (left <= 7) return 1;
  return 0;
}

const PART: Record<number, FlamePart> = {
  [FLAME_PIECE.CENTER]: 'center', [FLAME_PIECE.ARM_UP]: 'v', [FLAME_PIECE.ARM_DOWN]: 'v', [FLAME_PIECE.ARM_LEFT]: 'h',
  [FLAME_PIECE.ARM_RIGHT]: 'h', [FLAME_PIECE.TIP_UP]: 'up', [FLAME_PIECE.TIP_DOWN]: 'down', [FLAME_PIECE.TIP_LEFT]: 'left',
  [FLAME_PIECE.TIP_RIGHT]: 'right',
};
export const flamePart = (piece: number): FlamePart => PART[piece] ?? 'center';

export function formatClock(clock: { sec: number; sub: number }): string { return clockText(clock); }

/** `age` = ticks desde o acerto: pisca de 4 em 4 até o 21 e depois some (§3.10). */
export function dyingVisible(age: number): boolean {
  if (age > 21) return false;
  return ((age >> 2) & 1) === 0;
}
