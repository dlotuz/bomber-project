import { BASE_SPEED_SUB, CORNER_SUB, FUSE_FRAMES } from './constants';
import { BTN, CELL, DIR, DISEASE, DX, DY, type GameEvent, type Player, type RoundState } from './types';
import { cellX, cellY, centerX, centerY, idx } from './grid';
import { blocksPlayer, bombAt, blocksBomb } from './query';
import { launch } from './bombs';

export function speedSub(p: Player): number {
  if (p.disease === DISEASE.SLOW) return 4;
  if (p.disease === DISEASE.FAST) return BASE_SPEED_SUB + 7;
  return BASE_SPEED_SUB + (p.speed - 1);
}

export function flameRange(p: Player): number {
  return p.disease === DISEASE.LOW_FIRE ? 1 : p.fire + 2;
}

export function movePlayer(s: RoundState, p: Player, dir: number, ev: GameEvent[]): void {
  if (dir === DIR.NONE) return;
  p.facing = dir;
  const spd = speedSub(p);
  const gx = cellX(p.x), gy = cellY(p.y);
  const dx = DX[dir], dy = DY[dir];
  if (dx !== 0) {
    const off = p.y - centerY(gy);
    if (off !== 0) {
      if (Math.abs(off) > CORNER_SUB || blocksPlayer(s, gx + dx, gy, p.slot)) return;
      p.y -= Math.sign(off) * Math.min(Math.abs(off), spd);
      return;
    }
    const cx = centerX(gx);
    let nx = p.x + dx * spd;
    if (blocksPlayer(s, gx + dx, gy, p.slot)) {
      nx = dx > 0 ? Math.max(p.x, Math.min(nx, cx)) : Math.min(p.x, Math.max(nx, cx));
      if (nx === p.x) onBlocked(s, p, gx + dx, gy, dir, ev);
    }
    p.x = nx;
  } else {
    const off = p.x - centerX(gx);
    if (off !== 0) {
      if (Math.abs(off) > CORNER_SUB || blocksPlayer(s, gx, gy + dy, p.slot)) return;
      p.x -= Math.sign(off) * Math.min(Math.abs(off), spd);
      return;
    }
    const cy = centerY(gy);
    let ny = p.y + dy * spd;
    if (blocksPlayer(s, gx, gy + dy, p.slot)) {
      ny = dy > 0 ? Math.max(p.y, Math.min(ny, cy)) : Math.min(p.y, Math.max(ny, cy));
      if (ny === p.y) onBlocked(s, p, gx, gy + dy, dir, ev);
    }
    p.y = ny;
  }
}

/** Gancho para o chute (Task 6). */
function onBlocked(s: RoundState, p: Player, tx: number, ty: number, dir: number, ev: GameEvent[]): void {
  if (!p.kick) return;
  const b = bombAt(s, tx, ty);
  if (!b || b.slide !== DIR.NONE) return;
  if (blocksBomb(s, tx + DX[dir], ty + DY[dir])) return;
  b.slide = dir;
  b.passers = [];
  ev.push({ type: 'bomb_kicked', slot: p.slot });
}

export function steerPlayer(s: RoundState, p: Player, buttons: number, ev: GameEvent[]): void {
  const dirs: number[] = [];
  if (buttons & BTN.UP) dirs.push(DIR.UP);
  if (buttons & BTN.DOWN) dirs.push(DIR.DOWN);
  if (buttons & BTN.LEFT) dirs.push(DIR.LEFT);
  if (buttons & BTN.RIGHT) dirs.push(DIR.RIGHT);
  for (const d of dirs) {
    const x = p.x, y = p.y;
    movePlayer(s, p, d, ev);
    if (p.x !== x || p.y !== y) return;
  }
}

export function placeBomb(s: RoundState, p: Player, gx: number, gy: number, ev: GameEvent[]): void {
  if (s.bombs.filter(b => b.owner === p.slot).length >= p.maxBombs) return;
  if (s.arena.cells[idx(gx, gy)] !== CELL.EMPTY || bombAt(s, gx, gy)) return;
  const passers = s.players
    .filter(q => q.active && q.alive && q.dying === 0 && cellX(q.x) === gx && cellY(q.y) === gy)
    .map(q => q.slot);
  s.bombs.push({
    id: s.nextBombId++, owner: p.slot, x: centerX(gx), y: centerY(gy), fuse: FUSE_FRAMES,
    range: flameRange(p), pierce: p.pierce, passers, slide: DIR.NONE, flight: null, carried: false,
  });
  ev.push({ type: 'bomb_placed', slot: p.slot, gx, gy });
}

export function playerActions(s: RoundState, p: Player, buttons: number, ev: GameEvent[]): void {
  const pressed = buttons & ~p.prevButtons;
  const released = p.prevButtons & ~buttons;
  const gx = cellX(p.x), gy = cellY(p.y);

  if (p.carrying >= 0) {
    if (released & BTN.A) {
      const b = s.bombs.find(x => x.id === p.carrying);
      p.carrying = -1;
      if (b) {
        b.x = centerX(gx); b.y = centerY(gy);
        launch(b, p.facing);
        ev.push({ type: 'bomb_thrown', slot: p.slot });
      }
    }
    return;
  }

  if (pressed & BTN.A) {
    const under = bombAt(s, gx, gy);
    if (under && p.glove) {
      under.carried = true; under.slide = DIR.NONE; p.carrying = under.id;
      return;
    }
    placeBomb(s, p, gx, gy, ev);
  } else if (p.disease === DISEASE.DIARRHEA) {
    placeBomb(s, p, gx, gy, ev);
  }

  if ((pressed & BTN.Y) && p.punch) {
    const b = bombAt(s, gx + DX[p.facing], gy + DY[p.facing]);
    if (b) { launch(b, p.facing); ev.push({ type: 'bomb_punched', slot: p.slot }); }
  }
}
