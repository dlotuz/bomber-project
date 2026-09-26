import { CODE, type GameEvent, type RoundState } from './types';
import { PRESSURE_BORDER_AT, PRESSURE_EVERY, PRESSURE_FIRST, fallTicks } from './constants';
import { cellOf, linOf } from './units';
import { removeBomb } from './bombs';
import { clearBadBombers } from './bad-bomber';

let SPIRAL: number[] | null = null;

/** Espiral horária a partir de (2,1), anel a anel (fórmula equivalente a $C1:724E). */
export function pressureSpiral(): readonly number[] {
  if (SPIRAL) return SPIRAL;
  const out: number[] = [];
  for (let k = 0; k < 6; k++) {
    const x0 = 2 + k, x1 = 14 - k, y0 = 1 + k, y1 = 11 - k;
    if (x0 > x1 || y0 > y1) break;
    for (let x = x0; x <= x1; x++) out.push(cellOf(x, y0));
    for (let y = y0 + 1; y <= y1; y++) out.push(cellOf(x1, y));
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(cellOf(x, y1));
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(cellOf(x0, y));
  }
  return (SPIRAL = out);
}

export function triggerPressure(s: RoundState, ev: GameEvent[]): void {
  if (s.pressure.trigger >= 0) return;
  s.pressure.trigger = s.tick;
  ev.push({ type: 'hurry' });
  clearBadBombers(s, ev);
}

function land(s: RoundState, cell: number): void {
  for (const b of s.bombs.filter(x => x.cell === cell && (x.state === 'idle' || x.state === 'kicked'))) removeBomb(s, b, true);
  s.grid[cell] = CODE.PRESSURE; s.cellT0[cell] = s.tick; s.cellAux[cell] = 0;
  s.hidden = s.hidden.filter(([c]) => c !== cell);
}

export function tickPressure(s: RoundState, ev: GameEvent[]): void {
  const pr = s.pressure;
  if (pr.trigger < 0) return;
  const e = s.tick - pr.trigger;
  if (e === PRESSURE_BORDER_AT) {
    for (let col = 2; col <= 14; col++) for (const c of [cellOf(col, 0), cellOf(col, 12)]) {
      s.grid[c] = CODE.PRESSURE; s.cellT0[c] = s.tick; s.cellAux[c] = 0;
    }
  }
  if (e >= PRESSURE_FIRST && (e - PRESSURE_FIRST) % PRESSURE_EVERY === 0 && pr.next < pr.total) {
    const c = pressureSpiral()[pr.next++];
    const v = s.grid[c];
    if (v !== CODE.HARD && v !== CODE.PRESSURE) {
      if (v === CODE.FLOOR) s.grid[c] = CODE.FALLING;
      pr.falling.push({ cell: c, t0: s.tick, land: s.tick + fallTicks(linOf(c)) });
      ev.push({ type: 'pressure_step', cell: c });
    }
  }
  for (const f of [...pr.falling]) if (f.land === s.tick) { land(s, f.cell); pr.falling.splice(pr.falling.indexOf(f), 1); }
}
