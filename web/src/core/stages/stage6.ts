import type { StageModule } from '../hooks';
import { CODE, type Player, type RoundState } from '../types';
import { centerX, centerY, colAt, colOf, faceStep, linAt, linOf } from '../units';
import type { Stage6State } from './state';
import { A6_REPAINT } from './tables';
import { armIndex, floorWord, onGround, playerCell, rnd255, setAct, stageEvent } from './kit';
import { stage6Ai } from '../ai/stages/stage6';

export const A6_FLOOR = 0x1c06;

export const st6 = (s: RoundState): Stage6State =>
  (s.stageState ??= { counter: 64, v: [0, 0, 0, 0], center: -1, snap: [-1, -1, -1, -1, -1], snapAxis: [0, 0, 0, 0, 0] }) as Stage6State;

/** $C1:550B: repinta uma casa de chama com v e conta $1EAA. */
export function repaint(s: RoundState, a: Stage6State, cell: number, v: number): void {
  if (s.grid[cell] & 0x2000) return;                              // $C1:406F
  s.floor[cell] = A6_REPAINT[v];
  if (--a.counter === 0) {
    s.floor[cell] = 0x1c0c;
    a.counter = 64 + (rnd255(s) & 63);
  } else if ((a.counter & 7) === 2) {
    s.floor[cell] = 0x1c08;
  }
}

function flushCenter(s: RoundState, a: Stage6State): void {
  if (a.center >= 0) { repaint(s, a, a.center, a.v[3]); a.center = -1; }
}

const w = (s: RoundState, cell: number): number => (s.grid[cell] === CODE.FLOOR ? floorWord(s, cell, A6_FLOOR) : -1);

function startPush(s: RoundState, a: Stage6State, p: Player, cell: number): void {
  const dest = faceStep(cell, p.face);
  if (s.grid[dest] & 0x8000) return;
  const horiz = p.face === 2 || p.face === 6;
  let target: number, dist: number;
  if (horiz) { p.y = centerY(linOf(cell)); target = centerX(colOf(dest)); dist = target - p.x; }
  else { p.x = centerX(colOf(cell)); target = centerY(linOf(dest)); dist = target - p.y; }
  const sgn = Math.sign(dist);
  const ticks = Math.ceil(Math.abs(dist) / 512);
  p.push = { vx: horiz ? sgn * 512 : 0, vy: horiz ? 0 : sgn * 512, left: ticks };
  setAct(s, p, 'pushed', ticks);
  a.snap[p.slot] = target;
  a.snapAxis[p.slot] = horiz ? 0 : 1;
}

/** Arena 6: explosões repintam o piso ($C1:3DD9); pisos com efeito ($C2:1676, $C2:2F5F, $C1:39CF). */
export const stage6: StageModule = {
  init(s) {
    s.stageState = { counter: 64 + (rnd255(s) & 63), v: [0, 0, 0, 0], center: -1, snap: [-1, -1, -1, -1, -1], snapAxis: [0, 0, 0, 0, 0] };
  },
  onFlameCell(s, cell, armDir) {
    const a = st6(s);
    const k = armIndex(armDir);
    if (k === 4) {                                                // nova explosão: 4 sorteios antes de qualquer casa
      flushCenter(s, a);
      for (let i = 0; i < 4; i++) a.v[i] = (rnd255(s) & 15) || 1;
      a.center = cell;
      return;
    }
    if (a.v[k]) repaint(s, a, cell, a.v[k]);
  },
  tick(s) {
    const a = st6(s);
    flushCenter(s, a);
    a.v = [0, 0, 0, 0];
    for (const p of s.players) {
      const t = a.snap[p.slot];
      if (t < 0 || p.push.left > 0) continue;
      a.snap[p.slot] = -1;
      // O fim do empurrão ($C2:1F08) alinha no centro da casa ATUAL. Se ele parou antes do destino (bomba à frente,
      // $C2:1E7B; `applyPush` já o pôs no centro da casa de onde não saiu), o alvo é outra casa: não puxa para lá.
      const horiz = a.snapAxis[p.slot] === 0;
      if (horiz ? colAt(t) !== colAt(p.x) : linAt(t) !== linAt(p.y)) continue;
      if (horiz) p.x = t; else p.y = t;
    }
  },
  onStand(s, p, cell, ev) {
    if (!onGround(p)) return;
    const word = w(s, cell);
    if (word === 0x1c0c) {
      if (p.effect.kind === 0) stageEvent(ev, 'a6_reverse', { slot: p.slot });
      p.effect = { kind: 0x0a, left: 0x40 };
    } else if (word === 0x1c0a) {
      startPush(s, st6(s), p, cell);
    }
  },
  speedLevel(s, p, lv) {
    const c = playerCell(p);
    return c >= 0 && w(s, c) === 0x1c08 ? 7 : lv;
  },
  kickedBombEnter(s, _b, cell) { return w(s, cell) === 0x1c08 ? 'stop' : 'go'; },
  get ai() { return stage6Ai; },
};
