import { CELL, ITEM, type Bomb, type RoundState } from './types';
import { cellX, cellY, idx, inPlayfield } from './grid';

export function bombAt(s: RoundState, gx: number, gy: number): Bomb | undefined {
  return s.bombs.find(b => !b.carried && !b.flight && cellX(b.x) === gx && cellY(b.y) === gy);
}

export function playerAt(s: RoundState, gx: number, gy: number): boolean {
  return s.players.some(p => p.active && p.alive && p.dying === 0 && cellX(p.x) === gx && cellY(p.y) === gy);
}

export function blocksPlayer(s: RoundState, gx: number, gy: number, slot: number): boolean {
  if (!inPlayfield(gx, gy)) return true;
  if (s.arena.cells[idx(gx, gy)] !== CELL.EMPTY) return true;
  const b = bombAt(s, gx, gy);
  return !!b && !b.passers.includes(slot);
}

export function blocksBomb(s: RoundState, gx: number, gy: number): boolean {
  if (!inPlayfield(gx, gy)) return true;
  const i = idx(gx, gy);
  if (s.arena.cells[i] !== CELL.EMPTY) return true;
  if (s.arena.items[i] !== ITEM.NONE) return true;
  if (bombAt(s, gx, gy)) return true;
  return playerAt(s, gx, gy);
}
