// Cenário de teste ?cenario=chute: a montaria do chute (tipo A) e a bomba de espinho chutada.
//  - P1 (humano) começa montado na A, arena sem blocos, tempo sem limite.
//  - P2 (canto de baixo, à direita) fica parado SEGURANDO X o tempo todo: as bombas dele, na linha 9, estão
//    "trancadas" contra o chute de quem anda a pé — montado na A você chuta assim mesmo, e o X dele não as para.
//  - P3 (canto de cima, à direita) fica parado sem apertar nada: as bombas dele, na linha 3 (uma comum e uma de
//    espinho), servem para chutar e PARAR COM X (só montado na A dá para parar a bomba de outro).
//  - As bombas têm pavio de 10 s e voltam ao lugar 1,5 s depois de explodirem.
import { BTN, CODE, FUSE, cellCenter, cellOf, standing, playerCell, type Bomb, type RoundState } from '../core';

export type DevScenario = 'chute';

interface Spot { owner: number; col: number; lin: number; type: 0 | 1 | 2 }
const SPOTS: readonly Spot[] = [
  { owner: 2, col: 6, lin: 3, type: 0 }, { owner: 2, col: 10, lin: 3, type: 2 },
  { owner: 1, col: 6, lin: 9, type: 0 }, { owner: 1, col: 10, lin: 9, type: 2 },
];
/** Pavio das bombas do cenário (10 s) e espera para repor (1,5 s). */
export const SCENARIO_FUSE = 600, SCENARIO_RESPAWN = 90;

interface Memo { ids: number[]; gone: number[] }
const memo = new WeakMap<RoundState, Memo>();

function place(s: RoundState, sp: Spot): Bomb | null {
  const cell = cellOf(sp.col, sp.lin);
  if (s.grid[cell] !== CODE.FLOOR || s.players.some(p => standing(p) && playerCell(p) === cell)) return null;
  const [x, y] = cellCenter(cell);
  const id = s.nextId++;   // o mesmo contador do núcleo (newId)
  const b: Bomb = { id, owner: sp.owner, bad: false, cell, x, y, fuse: Math.max(SCENARIO_FUSE, FUSE), fire: 0, type: sp.type,
    state: 'idle', dir: 4, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: s.tick, level: 0 };
  s.grid[cell] = CODE.BOMB;
  s.bombs.push(b);
  return b;
}

/** A cada tick da rodada (antes do `step`): repõe as bombas e troca as entradas dos bonecos de teste (P2 segura X,
 *  P3 não faz nada). */
export function scenarioTick(s: RoundState, pads: number[], sc: DevScenario): void {
  if (sc !== 'chute') return;
  pads[1] = BTN.X;
  pads[2] = 0;
  if (s.phase !== 'play') return;
  let m = memo.get(s);
  if (!m) { m = { ids: SPOTS.map(() => -1), gone: SPOTS.map(() => -SCENARIO_RESPAWN) }; memo.set(s, m); }
  SPOTS.forEach((sp, i) => {
    if (m.ids[i] >= 0 && s.bombs.some(b => b.id === m.ids[i])) return;
    if (m.ids[i] >= 0) { m.ids[i] = -1; m.gone[i] = s.tick; }
    if (s.tick - m.gone[i] < SCENARIO_RESPAWN) return;
    const b = place(s, sp);
    if (b) m.ids[i] = b.id;
  });
}
