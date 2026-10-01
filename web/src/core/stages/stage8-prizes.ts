import { type GameEvent, type RoundState } from '../types';
import { cellAt } from '../units';
import type { Fall, PrizeRun, Stage8State } from './state';
import {
  A8_BOMB_FALL, A8_COLS, A8_COLS_ALL, A8_EGGS, A8_EGGS_ALL, A8_FALL_DY, A8_FALL_PICK, A8_L149F, A8_L14A9, A8_L14B6, A8_L14BE,
  A8_L14C1, A8_L14C5, A8_L14CE, A8_RAIN,
} from './tables';
import { eggsInPlay, landBomb, landItem, rnd, rnd255, stageEvent, startJackpotPressure } from './kit';

export const FALL_START_Y = 64;           // $C1:68A9: Y = $50 − 16

/** Colunas de queda pelo último rolo a parar ($C3:188E). */
export const colsFor = (a: Stage8State): readonly number[] =>
  a.lastStopped & 4 ? A8_COLS[0] : a.lastStopped & 2 ? A8_COLS[1] : A8_COLS[2];

const pick = (s: RoundState, list: readonly number[], n: number): number[] =>
  Array.from({ length: n }, () => list[rnd(s.rng, list.length)]);

function drop(s: RoundState, a: Stage8State, kind: Fall['kind'], id: number, x: number, ev: GameEvent[],
  table: readonly number[] = A8_FALL_PICK, mask = 15): void {
  a.falls.push({ kind, id, x, y: FALL_START_Y, script: table[rnd255(s) & mask], i: 0, born: s.tick });
  stageEvent(ev, 'a8_drop');
}

function dropQueued(s: RoundState, a: Stage8State, P: PrizeRun, id: number, cols: readonly number[], ev: GameEvent[]): void {
  drop(s, a, 'item', id, cols[P.colIdx++ % cols.length], ev);
}

/** $C3:18C3 / $C3:18F3: até 2 ovos, se houver vaga (teto 2, 🟡). */
function eggs(s: RoundState, a: Stage8State, cols: readonly number[], ev: GameEvent[]): void {
  for (let k = 0; k < 2; k++) {
    const falling = a.falls.filter(f => f.kind === 'item' && f.id >= 0x30 && f.id <= 0x3f).length;
    if (eggsInPlay(s, falling) >= 2) return;
    const type = s.rules.allMounts ? A8_EGGS_ALL[rnd(s.rng, 26)] : A8_EGGS[rnd(s.rng, 14)];   // $C3:196F
    drop(s, a, 'item', type, cols[rnd255(s) & 3], ev);
  }
}

export function startPrize(s: RoundState, a: Stage8State, routine: number, ev: GameEvent[]): void {
  const P: PrizeRun = { routine, queue: [], next: 0, batch: 3, wait: 48, colIdx: 0, after: 'idle', bombPhase: 0, rain: null };
  a.prize = P;
  stageEvent(ev, 'a8_prize');
  switch (routine) {
    case 0x14d6: P.queue = pick(s, A8_L149F, 1); P.batch = 1; break;
    case 0x14f9: P.queue = pick(s, A8_L14A9, 3); break;
    case 0x1526: P.queue = pick(s, A8_L14A9, 3); P.after = 'bomb'; break;
    case 0x15bf:
      P.queue = pick(s, A8_L14A9, 12);
      if (!a.jackpotUsed) { a.jackpotUsed = true; startJackpotPressure(s); }
      break;
    case 0x1611: P.queue = pick(s, A8_L14B6, 3); eggs(s, a, colsFor(a), ev); break;
    case 0x163a: eggs(s, a, colsFor(a), ev); P.queue = [...A8_L14BE]; break;
    case 0x1662: P.queue = pick(s, A8_L14C1, 6); break;
    case 0x1682: P.queue = [...A8_L14C5]; break;
    case 0x16a2: P.queue = pick(s, A8_L14CE, 18); eggs(s, a, colsFor(a), ev); break;
    case 0x17ad: eggs(s, a, A8_COLS_ALL, ev); P.rain = { wave: 0, itemIdx: 0 }; break;
  }
}

/** true = acabou (a máquina volta a parada). */
export function tickPrize(s: RoundState, a: Stage8State, ev: GameEvent[]): boolean {
  const P = a.prize;
  if (!P) return true;
  if (P.rain) {
    if (--P.wait > 0) return false;
    const n = rnd(s.rng, 3) + 3;
    const item = A8_RAIN[P.rain.itemIdx];
    for (let k = 0; k < n; k++) dropQueued(s, a, P, item, A8_COLS_ALL, ev);
    P.wait = 64;
    P.rain.itemIdx = (P.rain.itemIdx + 1) & 7;
    return ++P.rain.wave >= 16;
  }
  if (P.bombPhase) {
    if (--P.wait > 0) return false;
    if (P.bombPhase === 1) { P.bombPhase = 2; P.wait = 64; return false; }
    drop(s, a, 'bomb', 0, colsFor(a)[rnd255(s) & 3], ev, A8_BOMB_FALL, 7);
    return true;
  }
  if (--P.wait > 0) return false;
  for (let k = 0; k < P.batch; k++) {
    if (P.next >= P.queue.length) {
      if (P.after === 'bomb') { P.bombPhase = 1; P.wait = 64; return false; }
      return true;
    }
    dropQueued(s, a, P, P.queue[P.next++], colsFor(a), ev);
  }
  P.wait = 64;
  return false;
}

/** Quedas: 11 ticks de script a partir do tick seguinte à criação; depois aterrissam. */
export function tickFalls(s: RoundState, a: Stage8State, ev: GameEvent[]): void {
  for (const f of [...a.falls]) {
    if (f.born === s.tick) continue;
    const dy = A8_FALL_DY[f.script];
    f.y += dy[f.i++];
    if (f.i < dy.length) continue;
    a.falls.splice(a.falls.indexOf(f), 1);
    const cell = cellAt(f.x * 256, f.y * 256);
    if (f.kind === 'item') landItem(s, f.id, cell); else landBomb(s, cell, ev);
  }
}
