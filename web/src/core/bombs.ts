import { CELL, DIR, DX, DY, ITEM, type Bomb, type GameEvent, type RoundState } from './types';
import { FLAME_FRAMES, FLY_CELLS, MOVE_BOMB_SUB, T } from './constants';
import { cellX, cellY, centerX, centerY, idx, inPlayfield } from './grid';
import { bombAt, blocksBomb } from './query';

export function launch(b: Bomb, dir: number): void {
  b.flight = { dx: DX[dir], dy: DY[dir], cellsLeft: FLY_CELLS, progress: 0 };
  b.slide = DIR.NONE; b.carried = false; b.passers = [];
}

function stepSlide(s: RoundState, b: Bomb): void {
  if (b.x % T === 0 && b.y % T === 0) {
    if (blocksBomb(s, cellX(b.x) + DX[b.slide], cellY(b.y) + DY[b.slide])) { b.slide = DIR.NONE; return; }
  }
  b.x += DX[b.slide] * MOVE_BOMB_SUB;
  b.y += DY[b.slide] * MOVE_BOMB_SUB;
}

function stepFlight(s: RoundState, b: Bomb): void {
  const f = b.flight!;
  b.x += f.dx * MOVE_BOMB_SUB; b.y += f.dy * MOVE_BOMB_SUB; f.progress += MOVE_BOMB_SUB;
  if (f.progress < T) return;
  f.progress = 0; f.cellsLeft--;
  let gx = cellX(b.x), gy = cellY(b.y);
  if (gx < 1) gx = 13; else if (gx > 13) gx = 1;
  if (gy < 1) gy = 11; else if (gy > 11) gy = 1;
  b.x = centerX(gx); b.y = centerY(gy);
  if (f.cellsLeft > 0) return;
  if (blocksBomb(s, gx, gy)) f.cellsLeft = 1; else b.flight = null;
}

export function explode(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const k = s.bombs.indexOf(b);
  if (k < 0) return;
  s.bombs.splice(k, 1);
  const gx = cellX(b.x), gy = cellY(b.y);
  ev.push({ type: 'explosion', gx, gy });
  s.arena.flame[idx(gx, gy)] = FLAME_FRAMES;
  for (let d = 1; d <= 4; d++) {
    for (let r = 1; r <= b.range; r++) {
      const x = gx + DX[d] * r, y = gy + DY[d] * r;
      if (!inPlayfield(x, y)) break;
      const i = idx(x, y);
      const c = s.arena.cells[i];
      if (c === CELL.HARD) break;
      if (c === CELL.SOFT) {
        if (s.arena.burning[i] === 0) { s.arena.burning[i] = FLAME_FRAMES; ev.push({ type: 'block_destroyed', gx: x, gy: y }); }
        if (!b.pierce) break;
        continue;
      }
      s.arena.flame[i] = FLAME_FRAMES;
      if (s.arena.items[i] !== ITEM.NONE) { s.arena.items[i] = ITEM.NONE; break; }
      const other = bombAt(s, x, y);
      if (other) { explode(s, other, ev); break; }
    }
  }
}

export function updateBombs(s: RoundState, ev: GameEvent[]): void {
  const due: Bomb[] = [];
  for (const b of s.bombs) {
    if (b.carried) continue;
    if (b.flight) { stepFlight(s, b); continue; }
    if (b.slide !== DIR.NONE) stepSlide(s, b);
    b.fuse--;
    if (b.fuse <= 0 || s.arena.flame[idx(cellX(b.x), cellY(b.y))] > 0) due.push(b);
  }
  for (const b of due) explode(s, b, ev);
  for (const b of s.bombs) {
    b.passers = b.passers.filter(slot => {
      const q = s.players[slot];
      return q.alive && cellX(q.x) === cellX(b.x) && cellY(q.y) === cellY(b.y);
    });
  }
}
