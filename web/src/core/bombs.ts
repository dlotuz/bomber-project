// bombs.ts (T6) — addBomb, bombAt, bombById, removeBomb e refundBomb já são reais (T8, T13 e T15 dependem deles)
import { CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { BAD_COOLDOWN, FUSE } from './constants';
import { cellCenter } from './units';
import { newId } from './state';
export function fuseOf(_p: Player): number { return FUSE; }
export function bombFireOf(p: Player): number { return p.fire; }
export function canPlaceBomb(p: Player): boolean { return p.bombsFree > 0; }
export function bombAt(s: RoundState, cell: number): Bomb | undefined { return s.bombs.find(b => b.state === 'idle' && b.cell === cell); }
export function bombById(s: RoundState, id: number): Bomb | undefined { return s.bombs.find(b => b.id === id); }
/** Cria uma bomba; parada (padrão) ocupa a grade. */
export function addBomb(s: RoundState, owner: number, cell: number, init: Partial<Bomb> = {}): Bomb {
  const [x, y] = cellCenter(cell);
  const b: Bomb = { id: newId(s), owner, bad: false, cell, x, y, fuse: FUSE, fire: 0, type: 0, state: 'idle',
    dir: 4, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: s.tick, ...init };
  if (b.state === 'idle') s.grid[cell] = CODE.BOMB;
  s.bombs.push(b);
  return b;
}
/** Devolve a bomba ao dono (ou inicia a cadência do Bad Bomber: +48 ticks). */
export function refundBomb(s: RoundState, b: Bomb): void {
  if (b.bad) {
    const bb = s.bad.find(q => q.slot === b.owner);
    if (bb && bb.live === b.id) { bb.live = -1; bb.readyAt = s.tick + BAD_COOLDOWN; }
    return;
  }
  const p = s.players[b.owner];
  if (p) p.bombsFree = Math.min(p.bombsCap, p.bombsFree + 1);
}
/** Tira a bomba do jogo sem explodir (pressão, pouso em bloco queimando). */
export function removeBomb(s: RoundState, b: Bomb, refund: boolean): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  if (b.state === 'idle' && s.grid[b.cell] === CODE.BOMB) s.grid[b.cell] = CODE.FLOOR;
  if (refund) refundBomb(s, b);
}
export function placeBomb(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function explodeBomb(_s: RoundState, _b: Bomb, _ev: GameEvent[]): void {}
export function detonateRemote(_s: RoundState, _p: Player, _ev: GameEvent[]): boolean { return false; }
export function revealCell(_s: RoundState, _cell: number, _ev: GameEvent[]): void {}
export function tickBombs(_s: RoundState, _ev: GameEvent[]): void {}
export function tickCells(_s: RoundState, _ev: GameEvent[]): void {}
