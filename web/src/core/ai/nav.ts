// Navegação da IA: Dijkstra no tempo a partir da posição real, refúgios, fuga e direção a mandar.
import { BTN, CODE, type Player, type RoundState } from '../types';
import { CELLS, SUB, centerX, centerY, colOf, faceStep, inField, linOf, px } from '../units';
import { playerCell, standing } from '../state';
import { blockedFor, moveStep } from '../movement';
import { speedLevel } from '../disease';
import { SPEED_BY_LEVEL } from '../tables/movement';
import { MOUNTS } from '../mounts';
import { SAFE, blockedUntil, type Hazard } from './danger';
import type { AiLevel } from './level';

/** Uma casa em 1/256 px (16 px). */
const CELL_SUB = 16 * SUB;
/** Do centro até entrar na casa vizinha: 9 px para a direita/baixo e mais de 7 px para a esquerda/cima (a casa vai de
 *  −7 a +8 px do centro; `colAt`/`linAt` arredondam para baixo). Conferido com moveStep: 9 e 8 ticks no nível 1. */
const EDGE_FWD = 9 * SUB;
const EDGE_BACK = 7 * SUB + 1;
const FACES = [0, 2, 4, 6] as const;
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];

/** 1/256 px por tick com o nível efetivo (doenças, arena). */
export function speedOf(s: RoundState, p: Player): number {
  return SPEED_BY_LEVEL[speedLevel(s, p)] ?? SPEED_BY_LEVEL[1];
}

/** Ticks para andar uma casa inteira (centro a centro). */
export function ticksPerCell(s: RoundState, p: Player): number {
  return Math.ceil(CELL_SUB / speedOf(s, p));
}

/** Desvio do jogador em relação ao centro da sua casa, em 1/256 px. */
export function offsetOf(p: Player): { ox: number; oy: number } {
  const c = playerCell(p);
  return { ox: p.x - centerX(colOf(c)), oy: p.y - centerY(linOf(c)) };
}

/** A menos de um passo do centro nos dois eixos (com velocidades que não dividem 16 px o jogador passa do centro). */
export function centered(s: RoundState, p: Player): boolean {
  const spd = speedOf(s, p), { ox, oy } = offsetOf(p);
  return Math.abs(ox) < spd && Math.abs(oy) < spd;
}

/** O jogador pode pisar na casa `i` (queimando conta: fica livre em `blockedUntil`)? `blocked`: bloqueios extras
 *  (bomba hipotética, bomba deslizando, casas a evitar da arena). */
export function passable(s: RoundState, p: Player, i: number, blocked: ReadonlySet<number>): boolean {
  if (!inField(colOf(i), linOf(i)) || blocked.has(i)) return false;
  const v = s.grid[i];
  return v === CODE.BURNING || !blockedFor(p, v)[0];
}

/** Ticks até entrar na casa vizinha na face `face` e até chegar ao centro dela, com desvio `along` rumo à face.
 *  A assistência de canto alinha o eixo perpendicular sem custo (conferido: 9/8 ticks para qualquer desvio). */
function stepTicks(face: number, along: number, spd: number): { enter: number; arrive: number } {
  const edge = face === 2 || face === 4 ? EDGE_FWD : EDGE_BACK;
  return { enter: Math.max(1, Math.ceil((edge - along) / spd)), arrive: Math.max(1, Math.ceil((CELL_SUB - along) / spd)) };
}

const alongOf = (face: number, ox: number, oy: number): number =>
  face === 2 ? ox : face === 6 ? -ox : face === 4 ? oy : -oy;

/** A janela mortal da casa `i` (alargada pela folga) cruza os offsets [from, to]? */
export function hits(hz: Hazard, i: number, from: number, to: number, margin: number): boolean {
  if (from > to || hz.at[i] === SAFE) return false;
  return to >= hz.at[i] - margin && (hz.end[i] === SAFE || from < hz.end[i] + margin);
}

/** `time`: offset em que chega ao centro; `go`: offset em que começa a andar rumo à casa (vindo de `prev`). */
export interface Search { prev: Int32Array; dist: Int32Array; time: Int32Array; go: Int32Array }

function heapPush(h: number[], v: number): void {
  h.push(v);
  for (let i = h.length - 1; i > 0;) {
    const j = (i - 1) >> 1;
    if (h[j] <= h[i]) break;
    const t = h[i]; h[i] = h[j]; h[j] = t; i = j;
  }
}

function heapPop(h: number[]): number {
  const top = h[0], last = h.pop()!;
  if (h.length) {
    h[0] = last;
    for (let i = 0; ;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l] < h[m]) m = l;
      if (r < h.length && h[r] < h[m]) m = r;
      if (m === i) break;
      const t = h[i]; h[i] = h[m]; h[m] = t; i = m;
    }
  }
  return top;
}

/**
 * Menor tempo de chegada a cada casa (Dijkstra), a partir da posição real do jogador, passando só por casas que não
 * explodem enquanto ele está nelas. Pode esperar parado numa casa segura até a chama da próxima apagar (ou o bloco
 * queimando sumir). `delay`: ticks parado antes de começar (ex.: o tick de soltar a bomba). `stop(c, t)`: chamado quando
 * o tempo de `c` fica definitivo; true encerra a busca.
 */
export function search(s: RoundState, p: Player, hz: Hazard, blocked: ReadonlySet<number>, margin: number, delay: number,
  stop?: (c: number, t: number) => boolean): Search {
  const prev = new Int32Array(CELLS).fill(-1);
  const dist = new Int32Array(CELLS).fill(-1);
  const time = new Int32Array(CELLS).fill(-1);
  const go = new Int32Array(CELLS).fill(-1);
  const done = new Uint8Array(CELLS);
  const bu = blockedUntil(s);
  const spd = speedOf(s, p);
  const tpc = Math.ceil(CELL_SUB / spd), inFwd = Math.ceil(EDGE_FWD / spd), inBack = Math.ceil(EDGE_BACK / spd);
  const leave = Math.max(inFwd, inBack);
  const start = playerCell(p);
  if (start < 0) return { prev, dist, time, go };
  const { ox, oy } = offsetOf(p);
  dist[start] = 0;
  time[start] = delay + Math.ceil((Math.abs(ox) + Math.abs(oy)) / spd);
  const heap: number[] = [];
  heapPush(heap, time[start] * 256 + start);
  while (heap.length) {
    const c = heapPop(heap) & 255;
    if (done[c]) continue;
    done[c] = 1;
    if (stop && stop(c, time[c])) break;
    for (const face of FACES) {
      const i = faceStep(c, face);
      if (done[i] || !passable(s, p, i, blocked)) continue;
      let enter: number, arrive: number, dep: number, from: number;
      if (c === start) {
        const k = stepTicks(face, alongOf(face, ox, oy), spd);
        enter = k.enter; arrive = k.arrive; dep = delay; from = 1;
      } else {
        enter = face === 2 || face === 4 ? inFwd : inBack; arrive = tpc; dep = time[c]; from = time[c];
      }
      if (bu[i] > 0) dep = Math.max(dep, bu[i] - enter);                // bloco queimando some antes de entrar
      if (hits(hz, i, dep + enter, dep + arrive + leave, margin)) {
        if (hz.end[i] === SAFE) continue;                                // pressão / remota: nunca mais passa
        dep = Math.max(dep, hz.end[i] + margin - enter);                 // espera a explosão passar
      }
      if (hits(hz, c, from, dep + enter - 1, margin)) continue;          // não dá para ficar em `c` até sair
      const arr = dep + arrive;
      if (time[i] >= 0 && arr >= time[i]) continue;
      time[i] = arr; go[i] = dep; prev[i] = c; dist[i] = dist[c] + 1;
      heapPush(heap, arr * 256 + i);
    }
  }
  return { prev, dist, time, go };
}

export interface Route { path: number[]; go: number[] }

export function route(sr: Search, target: number): Route {
  const path: number[] = [], go: number[] = [];
  for (let c = target; c >= 0 && sr.prev[c] >= 0; c = sr.prev[c]) { path.unshift(c); go.unshift(sr.go[c]); }
  return { path, go };
}

/** Vizinhas andáveis (saídas) de uma casa. */
export function exits(s: RoundState, p: Player, i: number, blocked: ReadonlySet<number>): number {
  let k = 0;
  for (const face of FACES) {
    const n = faceStep(i, face);
    if (s.grid[n] !== CODE.BURNING && passable(s, p, n, blocked)) k++;
  }
  return k;
}

/** Refúgio: casa onde dá para ficar parado depois de chegar no offset `t` (nenhuma explosão prevista dali em diante). */
export function refuge(hz: Hazard, i: number, t: number, margin: number): boolean {
  return t >= 0 && (hz.at[i] === SAFE || (hz.end[i] !== SAFE && t >= hz.end[i] + margin));
}

/**
 * Rota até o refúgio mais próximo (em tempo; entre os igualmente próximos, com `open`, prefere os que não são beco).
 * Tenta com a folga do nível e, se `strict` for falso, de novo com folga 0; sem refúgio, vai para a casa alcançável
 * que explode por último. null = sem refúgio na busca estrita.
 */
export function escape(s: RoundState, p: Player, hz: Hazard, blocked: ReadonlySet<number>, level: AiLevel,
  strict: boolean, delay: number): Route | null {
  const tpc = ticksPerCell(s, p);
  // fora da pressão, refúgio colado (a até 2 casas) num adversário vale como 1 casa mais longe: ele pode fechar a
  // saída com uma bomba (a maior causa de morte pela própria bomba nas simulações)
  const foes = s.pressure.trigger >= 0 ? [] : s.players
    .filter(q => q !== p && standing(q) && !(s.rules.mode === 'team' && q.team === p.team)).map(playerCell);
  const nearFoe = (i: number): boolean => foes.some(c => Math.abs(colOf(c) - colOf(i)) + Math.abs(linOf(c) - linOf(i)) <= 2);
  for (const margin of strict ? [level.margin] : [level.margin, 0]) {
    let bound = SAFE;
    const sr = search(s, p, hz, blocked, margin, delay, (c, t) => {
      if (t > bound) return true;
      if (bound === SAFE && refuge(hz, c, t, margin)) bound = Math.max(1, Math.ceil(t / tpc)) * tpc;
      return false;
    });
    let best = -1, bestScore = 0;
    for (let i = 0; i < CELLS; i++) {
      if (sr.time[i] < 0 || sr.time[i] > bound || !refuge(hz, i, sr.time[i], margin)) continue;
      const cellsAway = Math.ceil(sr.time[i] / tpc);
      const score = (cellsAway * 2 + (level.open && exits(s, p, i, blocked) < 2 ? 1 : 0) + (nearFoe(i) ? 2 : 0)) * 100_000
        + sr.time[i];
      if (best < 0 || score < bestScore) { best = i; bestScore = score; }
    }
    if (best >= 0) return route(sr, best);
  }
  if (strict) return null;
  const sr = search(s, p, hz, blocked, 0, delay);
  let best = -1;
  for (let i = 0; i < CELLS; i++) {
    if (sr.time[i] < 0) continue;
    if (best < 0 || hz.at[i] > hz.at[best] || (hz.at[i] === hz.at[best] && sr.time[i] < sr.time[best])) best = i;
  }
  return best >= 0 ? route(sr, best) : { path: [], go: [] };
}

/** `q` tem algum refúgio alcançável com este perigo (folga 0)? */
export function hasRefuge(s: RoundState, q: Player, hz: Hazard, blocked: ReadonlySet<number>): boolean {
  let found = false;
  search(s, q, hz, blocked, 0, 0, (c, t) => (found = refuge(hz, c, t, 0)));
  return found;
}

/** Face (0 cima, 2 direita, 4 baixo, 6 esquerda) da casa vizinha `next`; -1 se não for vizinha. */
export function faceTo(here: number, next: number): number {
  for (const face of FACES) if (faceStep(here, face) === next) return face;
  return -1;
}

/** Ticks até entrar em `next` (vizinha) partindo da posição atual. */
export function enterTicks(s: RoundState, p: Player, next: number): number {
  const face = faceTo(playerCell(p), next);
  const { ox, oy } = offsetOf(p);
  return stepTicks(face, alongOf(face, ox, oy), speedOf(s, p)).enter;
}

/**
 * Botões para ir à casa vizinha `next` (ou, com `next` = casa atual / -1, aproximar do centro e parar). A assistência
 * de canto alinha o eixo perpendicular sozinha; só na zona morta do pilar (desvio perpendicular de 1 a 3 px e a
 * direção não sai do lugar) manda antes a perpendicular rumo ao centro.
 */
export function steer(s: RoundState, p: Player, next: number): number {
  const here = playerCell(p);
  const spd = speedOf(s, p);
  const { ox, oy } = offsetOf(p);
  const face = next >= 0 && next !== here ? faceTo(here, next) : -1;
  if (face >= 0) {
    const btn = FACE_BTN[face];
    const horiz = face === 2 || face === 6;
    const perpPx = horiz ? px(p.y) - px(centerY(linOf(here))) : px(p.x) - px(centerX(colOf(here)));
    if (Math.abs(perpPx) >= 1 && Math.abs(perpPx) <= 3) {
      const probe = { ...p };
      moveStep(s, probe, btn, speedLevel(s, p));
      const stuck = (probe.x === p.x && probe.y === p.y) || (probe.x === (p.x & ~0xff) && probe.y === (p.y & ~0xff));
      const side = horiz ? (perpPx < 0 ? 4 : 0) : (perpPx < 0 ? 2 : 6);
      if (stuck && !kicksToward(s, p, here, side)) return FACE_BTN[side];
    }
    return btn;
  }
  // centraliza, mas sem virar para uma bomba vizinha com o Chute (o chute é automático: chutaria a bomba)
  const fx = ox < 0 ? 2 : 6, fy = oy < 0 ? 4 : 0;
  if (Math.abs(ox) >= spd && !kicksToward(s, p, here, fx)) return FACE_BTN[fx];
  if (Math.abs(oy) >= spd && !kicksToward(s, p, here, fy)) return FACE_BTN[fy];
  return 0;
}

/** Virar para a face `face` chutaria uma bomba vizinha? */
function kicksToward(s: RoundState, p: Player, here: number, face: number): boolean {
  return (p.kick || !!MOUNTS.current.kicks?.(p)) && s.grid[faceStep(here, face)] === CODE.BOMB;
}
