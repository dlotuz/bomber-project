// bombs.ts (T6) — pavio, explosões, chamas e queima (decisões 9–13 da spec)
import { BURN, CODE, DISEASE, FLAME_PIECE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { BAD_COOLDOWN, BURN_TICKS, CHAIN_DELAY, FLAME_TICKS, FUSE, FUSE_LONG, FUSE_SHORT, rangeOf } from './constants';
import { CELLS, cellAt, cellCenter, colOf, faceStep, inGrid, linOf } from './units';
import { isItemCode, itemCode, newId, playerCell } from './state';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { slideStep } from './kick';

const ARM = [FLAME_PIECE.ARM_UP, 0, FLAME_PIECE.ARM_RIGHT, 0, FLAME_PIECE.ARM_DOWN, 0, FLAME_PIECE.ARM_LEFT];
const TIP = [FLAME_PIECE.TIP_UP, 0, FLAME_PIECE.TIP_RIGHT, 0, FLAME_PIECE.TIP_DOWN, 0, FLAME_PIECE.TIP_LEFT];

export function fuseOf(p: Player): number {
  return p.disease === DISEASE.SHORT_FUSE ? FUSE_SHORT : p.disease === DISEASE.LONG_FUSE ? FUSE_LONG : FUSE;
}
export function bombFireOf(p: Player): number {
  return p.disease === DISEASE.LOW_FIRE ? 10 : p.fullFire ? 7 : p.fire;
}
export function canPlaceBomb(p: Player): boolean {
  if (p.bombsFree <= 0 || p.disease === DISEASE.CONSTIPATION) return false;
  return p.disease !== DISEASE.LOW_FIRE || p.bombsFree === p.bombsCap;
}

export function bombAt(s: RoundState, cell: number): Bomb | undefined { return s.bombs.find(b => b.state === 'idle' && b.cell === cell); }
/** Casa `c` ocupada por bomba: parada nela, ou chutada com a casa de origem, a do centro ou (em movimento) a próxima
 *  igual a `c`. Toda bomba nova na grade (pouso, colocação, soltura da luva, parada do chute) passa por aqui, para que
 *  a grade `BOMB` corresponda sempre a exatamente uma bomba parada. `except` = a própria bomba. */
export function bombOccupies(s: RoundState, c: number, except?: Bomb): boolean {
  return s.bombs.some(b => b !== except && (b.state === 'idle' ? b.cell === c
    : b.state === 'kicked' && (b.cell === c || cellAt(b.x, b.y) === c || (b.step > 0 && faceStep(b.cell, b.dir) === c))));
}
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

export function placeBomb(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!canPlaceBomb(p)) return false;
  const cell = playerCell(p);
  if (cell < 0 || s.grid[cell] !== CODE.FLOOR) return false;
  if (bombOccupies(s, cell)) return false;
  addBomb(s, p.slot, cell, { fuse: fuseOf(p), fire: bombFireOf(p), type: MOUNTS.current.bombType?.(p) ?? p.bombType });
  p.bombsFree--;
  ev.push({ type: 'bomb_placed', slot: p.slot, cell });
  return true;
}

export function setFlame(s: RoundState, cell: number, piece: number): void {
  s.grid[cell] = CODE.FLAME; s.cellT0[cell] = s.tick; s.cellAux[cell] = piece;
}
export function burnCell(s: RoundState, cell: number, kind: number): void {
  s.grid[cell] = CODE.BURNING; s.cellT0[cell] = s.tick; s.cellAux[cell] = kind;
}

export function explodeBomb(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const i = s.bombs.indexOf(b);
  if (i < 0) return;
  s.bombs.splice(i, 1);
  refundBomb(s, b);
  const st = STAGES[s.stage];
  const c0 = b.cell;
  const v0 = s.grid[c0];
  if (v0 === CODE.BOMB || v0 === CODE.FLOOR || v0 === CODE.FLAME) setFlame(s, c0, FLAME_PIECE.CENTER);
  else st?.onFlameCell?.(s, c0, -1, ev);
  ev.push({ type: 'explosion', cell: c0, owner: b.owner });
  const range = rangeOf(b.fire);
  for (const face of [0, 2, 4, 6]) {
    let c = c0, last = -1;
    for (let k = 1; k <= range; k++) {
      c = faceStep(c, face);
      if (!inGrid(colOf(c), linOf(c))) break;
      const v = s.grid[c];
      if (v === CODE.HARD || v === CODE.PRESSURE || v === CODE.BURNING) break;
      if (v === CODE.SOFT) { burnCell(s, c, BURN.SOFT); if (b.type === 2) continue; break; }
      if (isItemCode(v)) { burnCell(s, c, BURN.ITEM); break; }
      if (v === CODE.BOMB) {
        const o = bombAt(s, c);
        if (o && (o.chainAt === 0 || o.chainAt > s.tick + CHAIN_DELAY)) o.chainAt = s.tick + CHAIN_DELAY;
        break;
      }
      if (v === CODE.FLOOR || v === CODE.FLAME) { setFlame(s, c, ARM[face]); last = c; continue; }
      st?.onFlameCell?.(s, c, face, ev);         // código especial passável: a arena decide; o braço segue
    }
    if (last >= 0) s.cellAux[last] = TIP[face];
  }
}

export function detonateRemote(s: RoundState, p: Player, _ev: GameEvent[]): boolean {
  const b = s.bombs
    .filter(x => x.owner === p.slot && !x.bad && x.type === 1 && (x.state === 'idle' || x.state === 'kicked') && x.chainAt === 0)
    .sort((a, c) => a.id - c.id)[0];
  if (!b) return false;
  b.chainAt = s.tick;
  return true;
}

export function revealCell(s: RoundState, cell: number, ev: GameEvent[]): void {
  s.grid[cell] = CODE.FLOOR; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
  const k = s.hidden.findIndex(([c]) => c === cell);
  if (k < 0) return;
  const item = s.hidden[k][1];
  s.hidden.splice(k, 1);
  if (item >= 0x30 && item <= 0x3f) MOUNTS.current.revealEgg(s, cell, ev);
  else s.grid[cell] = itemCode(item);
}

export function tickBombs(s: RoundState, ev: GameEvent[]): void {
  if (s.phase === 'won') return;
  const st = STAGES[s.stage];
  for (const b of [...s.bombs]) {
    if (!s.bombs.includes(b)) continue;
    if (b.born === s.tick || b.state === 'held' || b.state === 'air') continue;
    if (b.chainAt && s.tick >= b.chainAt) { explodeBomb(s, b, ev); continue; }
    if (b.state === 'kicked') {
      slideStep(s, b, ev);
      if (s.grid[b.cell] === CODE.FLAME && !b.chainAt) b.chainAt = s.tick + 1;
    }
    if (b.type === 1) continue;
    if (b.fuse === 0) { explodeBomb(s, b, ev); continue; }
    b.fuse = Math.max(0, b.fuse - (st?.fuseStep?.(s, b) ?? 1));
  }
}

export function tickCells(s: RoundState, ev: GameEvent[]): void {
  for (let c = 0; c < CELLS; c++) {
    const v = s.grid[c];
    if (v === CODE.FLAME && s.tick - s.cellT0[c] >= FLAME_TICKS) { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    else if (v === CODE.BURNING && s.tick - s.cellT0[c] >= BURN_TICKS) {
      if (s.cellAux[c] === BURN.SOFT) revealCell(s, c, ev);
      else { s.grid[c] = CODE.FLOOR; s.cellAux[c] = 0; }
    }
  }
}
