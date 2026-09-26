// Bad Bomber controlado pela CPU (§9.7): anda pela moldura até alinhar com um adversário de pé a 2–5 casas para dentro
// e arremessa (A, borda) quando a bomba anterior já explodiu e passou a cadência.
import { BTN, type RoundState } from '../types';
import { SUB, cellAt, colOf, faceStep, linOf } from '../units';
import { playerCell, standing } from '../state';
import { aimThrow } from '../flyers';
import { aiRoll, type AiLevel } from './level';

const X_MIN = 15, X_MAX = 239, Y_MIN = 32, Y_MAX = 224, GAP = 16;
const W = X_MAX - X_MIN, H = Y_MAX - Y_MIN, PERIM = 2 * (W + H);

/** Posição na moldura → 0..PERIM−1, em sentido horário a partir do canto de cima à esquerda. */
function along(x: number, y: number): number {
  if (y === Y_MIN) return x - X_MIN;
  if (x === X_MAX) return W + (y - Y_MIN);
  if (y === Y_MAX) return W + H + (X_MAX - x);
  return (2 * W + H + (Y_MAX - y)) % PERIM;
}

/** Botão para andar 1 px na moldura no sentido horário (ou anti-horário). */
function walk(x: number, y: number, clockwise: boolean): number {
  if (clockwise) {
    if (y === Y_MIN && x < X_MAX) return BTN.RIGHT;
    if (x === X_MAX && y < Y_MAX) return BTN.DOWN;
    if (y === Y_MAX && x > X_MIN) return BTN.LEFT;
    return BTN.UP;
  }
  if (y === Y_MIN && x > X_MIN) return BTN.LEFT;
  if (x === X_MIN && y < Y_MAX) return BTN.DOWN;
  if (y === Y_MAX && x < X_MAX) return BTN.RIGHT;
  return BTN.UP;
}

/** Casas da moldura: linha de cima/baixo e coluna da esquerda/direita (cellAt de Y 32/224 e X 15/239). */
const TOP = 0, BOTTOM = 12, LEFT = 1, RIGHT = 15;

/** Pontos da moldura (fora dos 16 px dos cantos) de onde o arremesso pega a casa `cell` a 2–5 casas para dentro. */
function spots(cell: number): { x: number; y: number }[] {
  const col = colOf(cell), lin = linOf(cell), out: { x: number; y: number }[] = [];
  // centro da casa, preso fora dos cantos (lin 1 → Y 48, ainda na mesma linha)
  const cx = Math.min(X_MAX - GAP, Math.max(X_MIN + GAP, 16 * col - 1));
  const cy = Math.min(Y_MAX - GAP, Math.max(Y_MIN + GAP, 16 * (lin + 2) - 1));
  const lane = (d: number): boolean => d >= 2 && d <= 5;
  if (lane(lin - TOP)) out.push({ x: cx, y: Y_MIN });
  if (lane(BOTTOM - lin)) out.push({ x: cx, y: Y_MAX });
  if (lane(col - LEFT)) out.push({ x: X_MIN, y: cy });
  if (lane(RIGHT - col)) out.push({ x: X_MAX, y: cy });
  return out;
}

/** Entradas do Bad Bomber do slot `slot` (CPU) neste tick. */
export function badInputs(s: RoundState, slot: number, level: AiLevel, seed = 0): number {
  const b = s.bad.find(x => x.slot === slot);
  const me = s.players[slot];
  if (!b || b.phase !== 'patrol') return 0;
  const foe = (q: typeof me): boolean =>
    q.slot !== slot && standing(q) && !(s.rules.mode === 'team' && q.team === me.team);
  const here = along(b.x, b.y);
  let best: { x: number; y: number } | null = null, bestD = PERIM;
  for (const q of s.players) {
    if (!foe(q)) continue;
    for (const o of spots(playerCell(q))) {
      const d = (along(o.x, o.y) - here + PERIM) % PERIM, dist = Math.min(d, PERIM - d);
      if (dist < bestD) { best = o; bestD = dist; }
    }
  }
  if (!best) return 0;
  if (bestD > 0) return walk(b.x, b.y, (along(best.x, best.y) - here + PERIM) % PERIM <= PERIM / 2);
  // alinhado: arremessa se a mira pega mesmo um adversário (e não um colega no caminho)
  if (b.live >= 0 || s.tick < b.readyAt || me.prevBtn & BTN.A) return 0;
  if (aiRoll(s.tick, slot, 9, seed) < level.mistake) return 0;               // hesitou
  const cell = cellAt(b.x * SUB, b.y * SUB);
  const face = b.x === X_MIN ? 2 : b.x === X_MAX ? 6 : b.y === Y_MIN ? 4 : 0;
  const n = aimThrow(s, cell, face, slot);
  let c = cell;
  for (let k = 0; k < n; k++) c = faceStep(c, face);
  return s.players.some(q => foe(q) && playerCell(q) === c) ? BTN.A : 0;
}
