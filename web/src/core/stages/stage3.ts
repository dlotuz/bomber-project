import type { StageModule } from '../hooks';
import { CODE, type GameEvent, type RoundState } from '../types';
import { cellAt, cellOf } from '../units';
import type { Orb, Stage3State } from './state';
import { A3_ORBS, A3_TURN } from './tables';
import { burnSoft, px, restoreFloor, rnd255, stageEvent, standing, stun } from './kit';
import { stage3Ai } from '../ai/stages/stage3';
import { bombOccupies } from '../bombs';

/** Passo em casas por direção: 0 cima, 1 direita, 2 baixo, 3 esquerda ($C3:09F8). */
export const ORB_STEP = [-17, 1, 17, -1];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/** Vizinha com chama → direção de saída, na ordem checada pela ROM ($C3:0A00). */
const TRIGGER: readonly [number, 0 | 1 | 2 | 3][] = [[17, 0], [-1, 1], [-17, 2], [1, 3]];

function newOrb(col: number, lin: number): Orb {
  return { x: 16 * col - 1, y: 16 * (lin + 2) - 1, cell: cellOf(col, lin), rolling: false, dir: 0, stepLeft: 0,
    cellsLeft: 0, fails: 0, turnSet: 0, softArmed: true, alive: true, flamedAt: -1 };
}
export const st3 = (s: RoundState): Stage3State =>
  (s.stageState ??= { orbs: A3_ORBS.map(([c, l]) => newOrb(c, l)) }) as Stage3State;

/** Direção de disparo se a bola parada foi pega por chama (null = não dispara). */
export function triggerDir(s: RoundState, o: Orb): 0 | 1 | 2 | 3 | null {
  const hit = TRIGGER.find(([d]) => ((s.grid[o.cell + d] ?? 0) & 0x1000) !== 0);
  return hit ? hit[1] : null;
}

function touch(s: RoundState, o: Orb, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (!standing(p) || p.act === 'stunned' || p.act === 'shocked' || p.inv !== 0) continue;
    if (Math.abs(px(p.x) - o.x) < 8 && Math.abs(px(p.y) - o.y) < 8) {
      stun(s, p, ev);
      p.inv = 64;
      stageEvent(ev, 'a3_hit', { slot: p.slot });
    }
  }
}

function stop(s: RoundState, o: Orb): void {
  o.rolling = false;
  if (s.grid[o.cell] === CODE.PRESSURE) o.alive = false; else s.grid[o.cell] = CODE.ORB;
}

/** $C3:08CA: tenta sair na direção atual, virando pela tabela até 4 falhas. */
function evaluate(s: RoundState, o: Orb): void {
  for (;;) {
    const dest = o.cell + ORB_STEP[o.dir];
    const g = s.grid[dest] ?? CODE.HARD;
    let blocked = true;
    // bomba deslizando: a grade dela é piso até parar — sem isto a bola rolava para a casa e parava por cima da bomba
    if ((g & 0x30) === 0x30 || (g & 0xefc0) === CODE.BOMB || bombOccupies(s, dest)) { /* bloqueia */ }
    else if ((g & 0xefc0) === CODE.SOFT) { if (o.softArmed) { o.softArmed = false; burnSoft(s, dest); } }
    else if (g & 0xc000) { /* bloqueia */ }
    else blocked = false;
    if (!blocked) { restoreFloor(s, dest); o.rolling = true; o.stepLeft = 16; return; }
    o.dir = ((o.dir + A3_TURN[o.turnSet][o.fails]) & 3) as 0 | 1 | 2 | 3;
    if (++o.fails >= 4) { stop(s, o); return; }
  }
}

function arrive(s: RoundState, o: Orb): void {
  o.cell = cellAt(o.x * 256, o.y * 256);
  if (s.grid[o.cell] === CODE.PRESSURE) { o.alive = false; return; }
  o.fails = 0;
  o.softArmed = true;
  if (--o.cellsLeft === 0) { o.rolling = false; return; }   // regrava ORB no próximo tick parado
  evaluate(s, o);
}

function orbTick(s: RoundState, o: Orb, ev: GameEvent[]): void {
  touch(s, o, ev);
  if (o.rolling) {
    o.x += DX[o.dir]; o.y += DY[o.dir];
    if (--o.stepLeft === 0) arrive(s, o);
    return;
  }
  if (o.flamedAt >= 0 && o.flamedAt < s.tick) {
    o.flamedAt = -1;
    const d = triggerDir(s, o);
    if (d !== null) {
      restoreFloor(s, o.cell);
      o.turnSet = rnd255(s) & 3;
      o.fails = 0; o.dir = d; o.cellsLeft = 8; o.softArmed = false;
      stageEvent(ev, 'a3_roll', { cell: o.cell });
      evaluate(s, o);
      return;
    }
  }
  if (s.grid[o.cell] === CODE.PRESSURE) { o.alive = false; return; }
  s.grid[o.cell] = CODE.ORB;
}

/** Arena 3: 2 bolas que rolam quando a chama as pega ($C3:06EE). */
export const stage3: StageModule = {
  init(s) {
    s.stageState = { orbs: A3_ORBS.map(([c, l]) => newOrb(c, l)) };
    for (const o of st3(s).orbs) s.grid[o.cell] = CODE.ORB;
  },
  /** Bomba chutada não entra na casa da bola nem na casa para onde ela está rolando (as duas parariam juntas). */
  kickedBombEnter(s, _b, cell) {
    return st3(s).orbs.some(o => o.alive && (o.cell === cell || (o.rolling && o.cell + ORB_STEP[o.dir] === cell))) ? 'stop' : 'go';
  },
  onFlameCell(s, cell) {
    for (const o of st3(s).orbs) if (o.alive && !o.rolling && o.cell === cell && o.flamedAt < 0) o.flamedAt = s.tick;
  },
  tick(s, ev) { for (const o of st3(s).orbs) if (o.alive) orbTick(s, o, ev); },
  get ai() { return stage3Ai; },   // getter: evita ordem de init no ciclo de imports com a IA
};
