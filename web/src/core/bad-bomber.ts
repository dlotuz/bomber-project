import { BTN, type BadBomberState, type GameEvent, type Player, type RoundState } from './types';
import { FUSE } from './constants';
import { SUB, cellAt, px } from './units';
import { setAct } from './state';
import { addBomb } from './bombs';
import { aimThrow, handFrom, launchBomb } from './flyers';

const X_MIN = 15, X_MAX = 239, Y_MIN = 32, Y_MAX = 224, CORNER_GAP = 16;

export function becomeBad(s: RoundState, p: Player): void {
  if (s.pressure.trigger >= 0) { p.state = 'out'; return; }
  p.state = 'bad';
  setAct(s, p, 'bad');
  const left = px(p.x) < 128;
  s.bad.push({
    slot: p.slot, x: left ? -16 : 271, y: Math.min(Y_MAX, Math.max(Y_MIN, px(p.y))),
    phase: 'enter', face: left ? 2 : 6, live: -1, readyAt: 0,
  });
}

export function clearBadBombers(s: RoundState, _ev: GameEvent[]): void {
  for (const b of s.bad) s.players[b.slot].state = 'out';
  s.bad = [];
}

function patrol(b: BadBomberState, btn: number): void {
  const vertical = b.x === X_MIN || b.x === X_MAX, horizontal = b.y === Y_MIN || b.y === Y_MAX;
  if (btn & BTN.UP && vertical && b.y > Y_MIN) { b.y--; b.face = 0; }
  else if (btn & BTN.DOWN && vertical && b.y < Y_MAX) { b.y++; b.face = 4; }
  else if (btn & BTN.LEFT && horizontal && b.x > X_MIN) { b.x--; b.face = 6; }
  else if (btn & BTN.RIGHT && horizontal && b.x < X_MAX) { b.x++; b.face = 2; }
}

function tryThrow(s: RoundState, b: BadBomberState, ev: GameEvent[]): void {
  if (b.live >= 0 || s.tick < b.readyAt) return;
  const vertical = b.x === X_MIN || b.x === X_MAX;
  const nearCorner = vertical
    ? b.y - Y_MIN < CORNER_GAP || Y_MAX - b.y < CORNER_GAP
    : b.x - X_MIN < CORNER_GAP || X_MAX - b.x < CORNER_GAP;
  if (nearCorner) return;
  const face = b.x === X_MIN ? 2 : b.x === X_MAX ? 6 : b.y === Y_MIN ? 4 : 0;
  const x = b.x * SUB, y = b.y * SUB;
  const cell = cellAt(x, y);
  const n = aimThrow(s, cell, face, b.slot);
  const bomb = addBomb(s, b.slot, cell, { state: 'air', fire: 1, bad: true, fuse: FUSE });
  const dir = (face >> 1) as 0 | 1 | 2 | 3;
  launchBomb(s, bomb, `throw${n}`, dir, handFrom(x, y, dir));
  b.live = bomb.id; b.face = face;
  ev.push({ type: 'throw', slot: b.slot });
}

export function tickBadBombers(s: RoundState, inputs: readonly number[], ev: GameEvent[]): void {
  for (const b of [...s.bad]) {
    const p = s.players[b.slot];
    const btn = inputs[b.slot] ?? 0;
    const pressed = btn & ~p.prevBtn;
    p.prevBtn = btn;
    if (b.phase === 'enter') {
      b.x += b.x < X_MIN ? 1 : -1;
      if (b.x === X_MIN || b.x === X_MAX) b.phase = 'patrol';
      continue;
    }
    patrol(b, btn);
    if (pressed & BTN.A) tryThrow(s, b, ev);
  }
}
