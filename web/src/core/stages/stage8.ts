import type { StageModule } from '../hooks';
import { CODE, type GameEvent, type RoundState } from '../types';
import { cellOf } from '../units';
import type { Reel, Stage8State } from './state';
import { A8_PRESET, A8_PRIZE } from './tables';
import { flameOver, playerCell, rnd255, stageEvent, standing } from './kit';
import { startPrize, tickFalls, tickPrize } from './stage8-prizes';
import { stage8Ai } from '../ai/stages/stage8';

// ---- mantidos exatamente como no esqueleto da T1 (a T10, a T11 e a IA dependem deles) ----
/** Pads (4,7), (8,7), (12,7) = A8_PADS (conferido com a ROM no teste da T9). */
export const PADS = [cellOf(4, 7), cellOf(8, 7), cellOf(12, 7)];
export const REEL_MASK = [4, 2, 1];
export const PAD_IDLE = 0x1c6e;
export const PAD_LIT = 0x1c4e;
export const sym = (r: Reel): number => (r.pos >> 3) & 3;
export function newStage8(): Stage8State {
  const reel = (): Reel => ({ pos: 0, calls: 0, delay: 1, delayCnt: 0, braking: false });
  return { started: false, phase: 'idle', reels: [reel(), reel(), reel()], turn: 0, stopped: 0, lastStopped: 0,
    click: false, jackpotUsed: false, prize: null, falls: [], lastRoutine: 0 };
}
export const st8 = (s: RoundState): Stage8State => (s.stageState ??= newStage8()) as Stage8State;
// ---- fim do trecho do esqueleto ----

/** Um passo do rolo i ($C3:1A10…1A82). Devolve true se o rolo estava alinhado nesta chamada. */
export function stepReel(a: Stage8State, i: number): boolean {
  const r = a.reels[i];
  let aligned = false;
  if (++r.delayCnt >= r.delay) {
    r.delayCnt = 0;
    if ((r.pos & 6) === 0) {
      aligned = true;
      if (r.delay >= 4) {
        if (!(a.stopped & REEL_MASK[i])) a.lastStopped = REEL_MASK[i];
        a.stopped |= REEL_MASK[i];
      } else r.pos = (r.pos + 2) & 31;
    } else r.pos = (r.pos + 2) & 31;
  }
  if (++r.calls >= 384 && (r.calls & 7) === 0) r.delay++;
  return aligned;
}

function setPads(s: RoundState, word: number): void {
  for (const c of PADS) if (s.grid[c] !== CODE.PRESSURE) s.floor[c] = word;
}

/** Liga a máquina pelo pad i ($C3:12DA…132D). */
export function startMachine(s: RoundState, a: Stage8State, i: number, ev: GameEvent[]): void {
  a.reels[i].calls = 0;
  const pair = A8_PRESET[rnd255(s) & 3];
  const others = [0, 1, 2].filter(k => k !== i);
  a.reels[others[0]].calls = pair[0];
  a.reels[others[1]].calls = pair[1];
  for (const r of a.reels) { r.delay = 1; r.braking = false; }
  setPads(s, PAD_LIT);
  a.stopped = 0; a.lastStopped = 0; a.click = false; a.turn = 0; a.phase = 'spin';
  stageEvent(ev, 'a8_start', { cell: PADS[i] });
}

function brake(s: RoundState, a: Stage8State, i: number, ev: GameEvent[]): void {
  const r = a.reels[i];
  if (r.braking || !s.players.some(p => standing(p) && playerCell(p) === PADS[i])) return;
  r.braking = true;
  if (s.grid[PADS[i]] !== CODE.PRESSURE) s.floor[PADS[i]] = PAD_IDLE;
  stageEvent(ev, 'a8_brake', { cell: PADS[i] });
  if (r.calls < 384) { r.calls = 384; r.delay = 3; }
}

/** Arena 8: caça-níquel de 3 rolos ($C3:11C7). */
export const stage8: StageModule = {
  init(s) {
    s.stageState = newStage8();
    for (const c of PADS) { if (s.grid[c] === CODE.FLOOR || s.grid[c] === CODE.PAD) s.grid[c] = CODE.PAD; s.floor[c] = PAD_IDLE; }
  },
  onFlameCell(s, cell, armDir) { if (PADS.includes(cell) && s.grid[cell] === CODE.PAD) flameOver(s, cell, armDir); },
  tick(s, ev) {
    const a = st8(s);
    tickFalls(s, a, ev);
    if (!a.started) {
      a.started = true;
      for (const r of a.reels) r.pos = (rnd255(s) & 3) * 8;
      setPads(s, PAD_IDLE);
    }
    for (const c of PADS) if (s.grid[c] === CODE.FLOOR) s.grid[c] = CODE.PAD;
    if (a.phase === 'idle') {
      for (let i = 0; i < 3; i++) {
        if (s.grid[PADS[i]] === CODE.FLAME && s.cellT0[PADS[i]] < s.tick) { startMachine(s, a, i, ev); break; }
      }
      return;
    }
    if (a.phase === 'prize') {
      if (tickPrize(s, a, ev)) { a.prize = null; a.phase = 'idle'; }
      return;
    }
    const i = a.turn;
    a.turn = (i + 1) % 3;
    brake(s, a, i, ev);
    if (stepReel(a, i)) a.click = true;
    if (i !== 2) return;
    if (a.click) { stageEvent(ev, 'a8_click'); a.click = false; }
    if ((a.stopped & 7) !== 7) return;
    a.stopped = 0;
    const routine = A8_PRIZE[sym(a.reels[0]) * 16 + sym(a.reels[1]) * 4 + sym(a.reels[2])];
    a.lastRoutine = routine;
    setPads(s, PAD_IDLE);
    if (routine === 0x14f7) { a.phase = 'idle'; stageEvent(ev, 'a8_nothing'); return; }
    a.phase = 'prize';
    startPrize(s, a, routine, ev);
  },
  get ai() { return stage8Ai; },
};
