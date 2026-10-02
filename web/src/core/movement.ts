import { BTN, type Bomb, type GameEvent, type Player, type RoundState } from './types';
import { GRID_W, FACE_OF_DIR, cellAt } from './units';
import { A20, DIAM, DIR_VEC, DPAD, PAR, SUBPOS, TBL, speedVec } from './tables/movement';
import { setAct, setFace } from './state';
import { speedLevel } from './disease';
import { STAGES } from './stages';
import { MOUNTS } from './mounts';
import { FOOTSTEP_EVERY } from './constants';
import { redirectRoller, rollerAt } from './kick';

/** Vizinhos N NE E SE S SW W NW, deslocamentos cumulativos em casas (NB do movesim, em unidades de casa). */
const NB = [-GRID_W, 1, GRID_W, GRID_W, -1, -1, -GRID_W, -GRID_W];

export function nibble(btn: number): number {
  return (btn & BTN.RIGHT ? 1 : 0) | (btn & BTN.LEFT ? 2 : 0) | (btn & BTN.DOWN ? 4 : 0) | (btn & BTN.UP ? 8 : 0);
}

/** Atravessa bomba: item $0B ou montaria tipo 1. */
export const passesBomb = (p: Player): boolean => p.passBomb || !!MOUNTS.current.passes?.(p, 0xc900);

/** blocked() do movesim com atravessa-soft/atravessa-bomba/montaria: [bloqueia ($82), é bomba ($86)]. */
export function blockedFor(p: Player, v: number): [boolean, boolean] {
  const lo = v & 0xefc0;
  if (lo === 0) return [false, false];
  if (lo === 0xc900) return passesBomb(p) ? [false, false] : [true, true];
  if (lo === 0xcc80) return p.passSoft || MOUNTS.current.passes?.(p, v) ? [false, false] : [true, false];
  return [(v & 0x8000) !== 0, false];
}

/** cell_of do movesim: ((py−$18) & $F0) e ((px+8) & $1F0), em casas. */
const cellOfPx = (xp: number, yp: number): number => (((yp - 24) & 0xf0) >> 4) * GRID_W + (((xp + 8) & 0x1f0) >> 4);
const parity = (xp: number, yp: number): number => PAR[((((yp + 8) & 0x10) | (((xp + 8) & 0x10) >> 1)) >> 3) & 3];

function neigh(s: RoundState, p: Player, cell: number): [number, number] {
  let b82 = 0, b86 = 0, c = cell;
  for (let i = 0; i < 8; i++) {
    c += NB[i];
    const [bl, bo] = blockedFor(p, s.grid[c] ?? 0);
    if (bl) b82 |= 1 << i;
    if (bo) b86 |= 1 << i;
  }
  return [b82, b86];
}

/** Um tick de movimento, idêntico a movesim.step. Devolve a direção (0..7, 8 = parado). `speed` (1/256 px por tick)
 *  substitui a velocidade do nível (investida do tipo 4). Se esbarrou numa bomba rolando, ela vai em `hit.roller`. */
export function moveStep(s: RoundState, p: Player, btn: number, level: number, speed?: number,
  hit?: { roller?: Bomb }): number {
  let X = p.x, Y = p.y;
  const xp = X >> 8, yp = Y >> 8;
  const din = DPAD[nibble(btn)];
  if (din === 8) { p.x = X & ~0xff; p.y = Y & ~0xff; return 8; }
  const cell0 = cellOfPx(xp, yp);
  let [b82] = neigh(s, p, cell0);
  let xs = (xp - 8) & 15, ys = (yp - 8) & 15;
  const code = SUBPOS[ys * 16 + xs] & 15;
  const p84 = parity(xp, yp);
  const t = TBL[p84 & 3];
  const v = t[code * 8 + din];
  let d = v & 15;
  if (v & 0xf0 && (1 << (v >> 4)) & b82) {
    d = 8;
    if (p84) d = t[0x68 + (din & 7)] & 15;
  }
  let [vx, vy] = d >= 9 ? [0, 0] : speed === undefined ? speedVec(level, d) : [DIR_VEC[d][0] * speed, DIR_VEC[d][1] * speed];
  const txp = (X + vx) >> 8, typ = (Y + vy) >> 8;
  const tcell = cellOfPx(txp, typ);
  // Entrar em casa com bomba zera o tick. Desvio do movesim.py: o `!p.passBomb` é nosso, porque o movesim não modela
  // o atravessa-bomba (+$4C), que no jogo deixa andar através de bombas (impossível se esta regra valesse sempre).
  if (tcell !== cell0 && !passesBomb(p)) {
    if (((s.grid[tcell] ?? 0) & 0xefc0) === 0xc900) return d;
    // Bomba rolando: a casa do centro dela tem o bit $4000 na ocupação ($C1:37C4), e $C2:3287 zera o tick do mesmo jeito
    // ($C2:3566). Medido (ajstop2/rvar.py, cross0.py): quem vem pelo lado espera em x = 55 e a bomba passa; antes, ele
    // entrava na casa e a bomba parava sob ele. Atravessa-bomba e tipo 1 entram (e aí ela para sob eles, $C1:36AC).
    const r = rollerAt(s, tcell);
    if (r) { if (hit) hit.roller = r; return d; }
  }
  let b86: number;
  [b82, b86] = neigh(s, p, tcell);
  ys = (typ - 8) & 15; xs = (txp - 8) & 15;
  let pxv = 0, pyv = 0;
  if (b82 & 0x01) pyv = A20[ys];
  if (pyv === 0 && b82 & 0x10) pyv = A20[8 + ys];
  if (b82 & 0x04) pxv = A20[8 + xs];
  if (pxv === 0 && b82 & 0x40) pxv = A20[xs];
  if (b86 & 0x01 && A20[ys]) { if (vy < 0) vy = 0; pyv = 0; }
  if (b86 & 0x04 && A20[8 + xs]) { if (vx >= 0) vx = 0; pxv = 0; }
  if (b86 & 0x10 && A20[8 + ys]) { if (vy >= 0) vy = 0; pyv = 0; }
  if (b86 & 0x40 && A20[xs]) { if (vx < 0) vx = 0; pxv = 0; }
  if (parity(txp, typ) === 0 && pxv === 0 && pyv === 0) [pxv, pyv] = DIAM[ys * 16 + xs];
  vx += pxv >= 0 ? (pxv & 0xff) << 8 : -((-pxv) << 8);
  vy += pyv >= 0 ? (pyv & 0xff) << 8 : -((-pyv) << 8);
  X += vx; Y += vy;
  if (vx === 0 && vy === 0) { X &= ~0xff; Y &= ~0xff; }
  p.x = X; p.y = Y;
  return d;
}

/** Movimento de um tick com nível efetivo, face, ação de andar, passos e ganchos de arena. */
export function movePlayer(s: RoundState, p: Player, btn: number, ev: GameEvent[]): void {
  const before = cellAt(p.x, p.y);
  const din = DPAD[nibble(btn)];
  const hit: { roller?: Bomb } = {};
  const d = moveStep(s, p, btn, speedLevel(s, p), undefined, hit);
  p.moveDir = d;
  const moving = din !== 8;
  if (moving) setFace(s, p, FACE_OF_DIR[d !== 8 ? d : din]);
  if (hit.roller) redirectRoller(s, p, hit.roller, ev);   // com Chute, esbarrar desvia a bomba para a face ($C2:32FF)
  setAct(s, p, p.carry >= 0 || p.grab >= 0 ? (moving ? 'carryWalk' : 'carryIdle') : moving ? 'walk' : 'idle');
  if (moving) { if (++p.walkT % FOOTSTEP_EVERY === 0) ev.push({ type: 'footstep', slot: p.slot }); } else p.walkT = 0;
  const now = cellAt(p.x, p.y);
  const st = STAGES[s.stage];
  if (now !== before && now >= 0) st?.onEnterCell?.(s, p, now, ev);
  if (now >= 0) st?.onStand?.(s, p, now, ev);
}
