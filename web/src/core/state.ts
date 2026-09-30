import { CODE, type Player, type PlayerAct, type RoundState, type Rules } from './types';
import { makeRng, type Rng16 } from './rng';
import { CELLS, GRID_H, GRID_W, SPAWNS, cellAt, cellOf, spawnX, spawnY } from './units';
import { PRESSURE_STEPS_NORMAL, PRESSURE_STEPS_SD } from './constants';
import { initClock } from './clock';

export function createPlayer(slot: number, present: boolean, team = 0, char = slot): Player {
  const [col, lin] = SPAWNS[slot];
  return {
    slot, present, char, team,
    x: spawnX(col), y: spawnY(lin), moveDir: 8, face: 4, lastDir: 0,
    speedLv: 1, bombsCap: 1, bombsFree: 1, fire: 0, fullFire: false,
    bombType: 0, glove: false, punch: false, kick: false, pItem: false,
    passSoft: false, passBomb: false, heart: false, costume: -1,
    disease: 0, diseaseT: 0, contactLock: 0, inv: 0, effect: { kind: 0, left: 0 },
    act: 'idle', actT0: 0, actLeft: 0, carry: -1, throwQueued: false,
    grab: -1, heldBy: -1, flying: false, escape: 0, z: 0,
    push: { vx: 0, vy: 0, left: 0 }, walkT: 0,
    state: present ? 'alive' : 'out', hitT0: -1, prevBtn: 0, mount: null,
  };
}

/** Pilar da grade padrão: col ímpar × lin par dentro do campo, ex.: (3,2). */
export const isPillar = (col: number, lin: number): boolean =>
  col >= 3 && col <= 13 && lin >= 2 && lin <= 10 && col % 2 === 1 && lin % 2 === 0;
export const isWall = (col: number, lin: number): boolean => col <= 1 || col >= 15 || lin === 0 || lin === 12;

/** Rodada sem blocos (paredes + pilares), fase intro. Base para createRound e para os testes. */
export function emptyRound(stage: number, rules: Rules, rng: Rng16 = makeRng()): RoundState {
  const grid = new Array<number>(CELLS).fill(CODE.FLOOR);
  for (let lin = 0; lin < GRID_H; lin++) for (let col = 0; col < GRID_W; col++) {
    if (isWall(col, lin) || isPillar(col, lin)) grid[cellOf(col, lin)] = CODE.HARD;
  }
  return {
    tick: 0, phase: 'intro', phaseT0: 0, stage, rules, rng, clock: initClock(rules.timeIdx),
    grid, cellT0: new Array<number>(CELLS).fill(0), cellAux: new Array<number>(CELLS).fill(0),
    floor: new Array<number>(CELLS).fill(0), hidden: [],
    players: [0, 1, 2, 3, 4].map(i => createPlayer(i, rules.active[i] ?? false, rules.teams[i] ?? 0)),
    bombs: [], flyers: [],
    pressure: { trigger: -1, next: 0, total: rules.suddenDeath ? PRESSURE_STEPS_SD : PRESSURE_STEPS_NORMAL, falling: [] },
    bad: [], stageState: null, mountState: null, diseaseOnce24: false, result: null,
    nextId: 1, lastHit: -1, endAt: 0, celebT0: -1, counted: false,
  };
}

export const isItemCode = (v: number): boolean => (v & 0xff00) === 0x0900;
export const isEggCode = (v: number): boolean => v >= 0x0970 && v <= 0x097f;
/** Palavra da grade para o item `id`: 0940+id; caveira ($20..$2F) 0980+id. */
export const itemCode = (id: number): number => (id >= 0x20 && id < 0x30 ? CODE.SKULL + id : CODE.ITEM + id);
export const itemOfCode = (v: number): number => { const lo = v & 0xff; return lo >= 0x80 ? lo - 0x80 : lo - 0x40; };

/** Troca a ação; reinicia actT0 só quando muda (como $C1:7657). `left` > 0 trava a ação. */
export function setAct(s: RoundState, p: Player, act: PlayerAct, left = 0): void {
  if (p.act !== act) { p.act = act; p.actT0 = s.tick; }
  p.actLeft = left;
}
export function setFace(s: RoundState, p: Player, face: 0 | 2 | 4 | 6): void {
  if (p.face !== face) { p.face = face; p.actT0 = s.tick; }
}
export const standing = (p: Player): boolean => p.present && p.state === 'alive';
export const playerCell = (p: Player): number => cellAt(p.x, p.y);
export const newId = (s: RoundState): number => s.nextId++;
