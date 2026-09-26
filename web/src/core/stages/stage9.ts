import type { StageModule } from '../hooks';
import { BTN, type GameEvent, type Player, type RoundState } from '../types';
import { cellOf, centerX, centerY, colOf, linOf } from '../units';
import type { Jump, Seesaw, Stage9State } from './state';
import { A9_SAWS } from './tables';
import { playerCell, px, setAct, stageEvent, standing, wrapPx } from './kit';
import { stage9Ai } from '../ai/stages/stage9';

export const JUMP_DY = [0, 0, 0, -6, -10, -13, -15, -16, -16, -16, -15, -13, -10, -6];
export const HOP_DX = [3, 3, 3, 3, 2, 2, 0, 0];
export const HOP_DY = [-4, -6, -6, -6, -4, 0, 0, 0];
const WORDS: Record<'0' | '1' | 't', number[]> = { 0: [0x08ec, 0x48e2, 0x48e0], 1: [0x08e0, 0x08e2, 0x08e4], t: [0x08e6, 0x08e8, 0x08ea] };
const LOCK = 9999;

/** Ponta de cima: estado 0 → B, estado 1 → A. */
export const upEnd = (w: Seesaw): number => (w.state === 0 ? w.b : w.a);
export const sawWords = (w: Seesaw, tick: number): number[] => (tick < w.transUntil ? WORDS.t : WORDS[w.state === 0 ? '0' : '1']);

const newState = (): Stage9State => ({ saws: A9_SAWS.map(([st, c, l]) => ({ a: cellOf(c, l), b: cellOf(c + 2, l), state: st as 0 | 1, transUntil: 0 })), jumps: [] });
export const st9 = (s: RoundState): Stage9State => (s.stageState ??= newState()) as Stage9State;

const airborne = (a: Stage9State, slot: number): boolean => a.jumps.some(j => j.slot === slot);
const free = (s: RoundState, cell: number): boolean => cell >= 0 && (s.grid[cell] & 0x8000) === 0;

function launch(s: RoundState, a: Stage9State, p: Player, ev: GameEvent[]): void {
  const h = p.prevBtn & (BTN.LEFT | BTN.RIGHT);
  const dx: -1 | 0 | 1 = h === BTN.LEFT ? -1 : h === BTN.RIGHT ? 1 : 0;
  const c = playerCell(p);
  p.x = centerX(colOf(c)); p.y = centerY(linOf(c));
  p.push = { vx: 0, vy: 0, left: 0 };
  a.jumps.push({ slot: p.slot, t: -1, dx, baseY: p.y, born: s.tick, hop: -1 });
  setAct(s, p, 'launched', LOCK);
  stageEvent(ev, 'a9_launch', { slot: p.slot });
}

function toggle(s: RoundState, a: Stage9State, w: Seesaw, ev: GameEvent[]): void {
  w.state = w.state === 0 ? 1 : 0;
  w.transUntil = s.tick + 2;
  const up = upEnd(w);
  for (const p of s.players) if (standing(p) && !airborne(a, p.slot) && playerCell(p) === up) launch(s, a, p, ev);
}

function land(s: RoundState, a: Stage9State, j: Jump, p: Player, ev: GameEvent[]): void {
  const c = playerCell(p);
  if (!free(s, c) && j.dx !== 0) { j.hop = 0; return; }             // quica até achar casa livre
  a.jumps.splice(a.jumps.indexOf(j), 1);
  if (c >= 0) p.x = centerX(colOf(c));
  setAct(s, p, 'idle', 0);
  const w = a.saws.find(x => x.a === c || x.b === c);
  if (w) toggle(s, a, w, ev);                                       // pousar em qualquer ponta vira
}

/** Arena 9: gangorras ($C2:1C58, parâmetros $C3:9524). */
export const stage9: StageModule = {
  init(s) { s.stageState = newState(); },
  onEnterCell(s, p, cell, ev) {
    const a = st9(s);
    if (airborne(a, p.slot)) return;
    const w = a.saws.find(x => upEnd(x) === cell);
    if (w) toggle(s, a, w, ev);
  },
  tick(s, ev) {
    const a = st9(s);
    for (const j of [...a.jumps]) {
      if (j.born === s.tick) continue;
      const p = s.players[j.slot];
      if (!standing(p)) { a.jumps.splice(a.jumps.indexOf(j), 1); continue; }
      if (j.hop < 0) {
        j.t++;
        if (j.t >= 3 && j.dx) p.x = wrapPx(px(p.x) + 8 * j.dx) * 256;
        if (j.t < 14) { p.y = j.baseY + JUMP_DY[j.t] * 256; continue; }
        p.y = j.baseY;
        land(s, a, j, p, ev);
      } else {
        p.x = wrapPx(px(p.x) + HOP_DX[j.hop] * j.dx) * 256;
        p.y = j.baseY + HOP_DY[j.hop] * 256;
        if (++j.hop < 8) continue;
        land(s, a, j, p, ev);
      }
    }
  },
  get ai() { return stage9Ai; },
};
