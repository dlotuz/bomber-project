import { CODE, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { KICK_DIRBIT, KICK_MASK } from './tables/movement';
import { KICK_STEP } from './tables/flights';
import { KICK_STEPS } from './constants';
import { SUB, cellAt, cellCenter, faceStep, subX, subY } from './units';
import { isEggCode, isItemCode, playerCell, standing } from './state';
import { bombAt } from './bombs';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';

/** Chute automático ($C2:4307): depois do movimento, olhando para uma bomba parada vizinha. */
export function tryKick(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  if (!(p.kick || MOUNTS.current.kicks?.(p))) return false;
  const here = playerCell(p);
  if (here < 0 || !(KICK_MASK[subY(p.y) * 16 + subX(p.x)] & KICK_DIRBIT[p.face >> 1])) return false;
  const n = faceStep(here, p.face);
  if (s.grid[n] !== CODE.BOMB) return false;
  const b = bombAt(s, n);
  if (!b || b.fuse <= 1) return false;
  b.state = 'kicked'; b.dir = p.face; b.step = 0; b.kickedBy = p.slot; b.turn = -1;
  s.grid[n] = CODE.FLOOR;
  ev.push({ type: 'bomb_kicked', slot: p.slot });
  return true;
}

function park(s: RoundState, b: Bomb, cell: number): void {
  b.state = 'idle'; b.step = 0; b.cell = cell; b.turn = -1;
  [b.x, b.y] = cellCenter(cell);
  s.grid[cell] = CODE.BOMB;
}

/** Um tick do deslize ($C1:34D0/$C1:35E1). */
export function slideStep(s: RoundState, b: Bomb, _ev: GameEvent[]): void {
  if (b.step === 0) {
    const next = faceStep(b.cell, b.dir);
    const v = s.grid[next] ?? CODE.HARD;
    const blocked = (v & 0x8400) !== 0 || isEggCode(v)
      || s.bombs.some(o => o !== b && o.cell === next && (o.state === 'idle' || o.state === 'kicked'))
      || s.players.some(q => standing(q) && playerCell(q) === next);
    const verdict = blocked ? 'stop' : STAGES[s.stage]?.kickedBombEnter?.(s, b, next) ?? 'go';
    if (verdict === 'stop') { park(s, b, b.cell); return; }
    if (typeof verdict === 'object') b.turn = verdict.turn;
    if (isItemCode(v)) s.grid[next] = CODE.FLOOR;         // item esmagado
    if (v === CODE.FLAME) b.chainAt = s.tick + 1;
  }
  const [dx, dy] = KICK_STEP[b.dir >> 1][b.step];
  b.x += dx * SUB; b.y += dy * SUB;
  if (++b.step === KICK_STEPS) {
    b.step = 0;
    b.cell = faceStep(b.cell, b.dir);
    [b.x, b.y] = cellCenter(b.cell);
    if (b.turn >= 0) { b.dir = b.turn as 0 | 2 | 4 | 6; b.turn = -1; }
  }
}

/** Botão X: para as bombas chutadas por `p` na casa do centro delas. */
export function stopKick(s: RoundState, p: Player): void {
  for (const b of s.bombs) if (b.state === 'kicked' && b.kickedBy === p.slot) park(s, b, cellAt(b.x, b.y));
}
