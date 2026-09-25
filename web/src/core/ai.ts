import { BTN, CELL, DIR, DISEASE, DX, DY, ITEM, type Player, type RoundState } from './types';
import { CORNER_SUB, FUSE_FRAMES, GRID_H, GRID_W, MOVE_BOMB_SUB, PRESSURE_INTERVAL, T } from './constants';
import { cellX, cellY, centerX, centerY, idx, inPlayfield } from './grid';
import { flameRange, speedSub } from './player';
import { blocksBomb } from './query';

/** Casa que nenhuma chama conhecida vai atingir. */
export const SAFE = 1_000_000;

export interface AiLevel {
  react: number;    // frames entre decisões
  mistake: number;  // % de decisões erradas (demora a fugir ou anda à toa)
  hunt: boolean;    // persegue outros jogadores (e não só blocos)
  margin: number;   // folga, em frames, exigida para considerar um caminho seguro
}

/** Fraco, Normal, Forte (índice = rules.cpuLevel). */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4 },
  { react: 8, mistake: 5, hunt: true, margin: 8 },
  { react: 2, mistake: 0, hunt: true, margin: 12 },
];

interface Brain { path: number[]; bomb: boolean; nextThink: number }

export interface AiState { round: RoundState | null; brains: Brain[] }

export function createAi(): AiState {
  return { round: null, brains: [] };
}

/** Número pseudoaleatório 0..99 derivado só do estado (frame, slot, sal): mantém a IA determinística sem guardar RNG.
 *  Usa um hash próprio em vez de `s.rng`: tirar números do RNG da rodada mudaria o sorteio de itens/spawns conforme a quantidade de CPUs. */
export function aiRoll(frame: number, slot: number, salt: number): number {
  let h = Math.imul(frame + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}

interface BombInfo { gx: number; gy: number; t: number; range: number; pierce: boolean; trail?: number[]; flying?: boolean }

/** Casas ocupadas por bombas paradas no chão (as que seguram o braço de uma explosão). */
function groundBombCells(s: RoundState): Set<number> {
  const out = new Set<number>();
  for (const b of s.bombs) if (!b.carried && !b.flight) out.add(idx(cellX(b.x), cellY(b.y)));
  return out;
}

/** Bomba chutada: repete `stepSlide` (bombs.ts) até o pavio acabar ou ela parar, e devolve a casa onde explode e
 *  as casas por onde passa. O pavio continua correndo durante o deslize. */
function slideEnd(s: RoundState, b: RoundState['bombs'][number]): { gx: number; gy: number; trail: number[] } {
  const dx = DX[b.slide], dy = DY[b.slide];
  let x = b.x, y = b.y;
  const trail = [idx(cellX(x), cellY(y))];
  for (let k = 0; k < b.fuse; k++) {
    if (x % T === 0 && y % T === 0 && blocksBomb(s, cellX(x) + dx, cellY(y) + dy)) break;
    x += dx * MOVE_BOMB_SUB; y += dy * MOVE_BOMB_SUB;
    const c = idx(cellX(x), cellY(y));
    if (c !== trail[trail.length - 1]) trail.push(c);
  }
  return { gx: cellX(x), gy: cellY(y), trail };
}

/** Casas atingidas pela explosão de uma bomba (mesmas regras do core: HARD para; SOFT queima e para; item para). */
function blastCells(s: RoundState, b: BombInfo, bombCells: ReadonlySet<number>): number[] {
  const out = [idx(b.gx, b.gy)];
  for (let d = 1; d <= 4; d++) {
    for (let r = 1; r <= b.range; r++) {
      const x = b.gx + DX[d] * r, y = b.gy + DY[d] * r;
      if (!inPlayfield(x, y)) break;
      const i = idx(x, y);
      const c = s.arena.cells[i];
      if (c === CELL.HARD) break;
      out.push(i);
      if (c === CELL.SOFT && !b.pierce) break;
      if (s.arena.items[i] !== ITEM.NONE) break;
      if (bombCells.has(i)) break;   // outra bomba segura o braço (ela explode junto: ver reação em cadeia)
    }
  }
  return out;
}

/**
 * Para cada casa, em quantos frames ela passa a ter chama (0 = já tem; SAFE = ninguém atinge).
 * Considera pavio, reação em cadeia, chamas atuais e os próximos blocos de pressão.
 * `extra`: bomba hipotética (para decidir se dá para fugir antes de colocá-la).
 */
export function dangerMap(s: RoundState, extra?: { gx: number; gy: number; range: number; pierce: boolean }): Int32Array {
  const n = GRID_W * GRID_H;
  const danger = new Int32Array(n).fill(SAFE);
  for (let i = 0; i < n; i++) if (s.arena.flame[i] > 0) danger[i] = 0;

  const bombs: BombInfo[] = [];
  for (const b of s.bombs) {
    if (b.carried) continue;               // carregada: pavio parado, ainda não ameaça ninguém
    if (b.flight) {
      // voando: pavio parado; prevê a casa de pouso (sem quiques) e soma o tempo de voo que falta
      const f = b.flight;
      let gx = cellX(b.x - f.dx * f.progress) + f.dx * f.cellsLeft;
      let gy = cellY(b.y - f.dy * f.progress) + f.dy * f.cellsLeft;
      if (gx < 1) gx += 13; else if (gx > 13) gx -= 13;
      if (gy < 1) gy += 11; else if (gy > 11) gy -= 11;
      const t = Math.max(0, b.fuse) + Math.ceil((f.cellsLeft * T - f.progress) / MOVE_BOMB_SUB);
      bombs.push({ gx, gy, t, range: b.range, pierce: b.pierce, flying: true });
      continue;
    }
    if (b.slide !== DIR.NONE) {
      // chutada: explode onde parar (ou onde estiver quando o pavio acabar); o trajeto todo fica marcado
      const e = slideEnd(s, b);
      bombs.push({ gx: e.gx, gy: e.gy, t: Math.max(0, b.fuse), range: b.range, pierce: b.pierce, trail: e.trail });
      continue;
    }
    bombs.push({ gx: cellX(b.x), gy: cellY(b.y), t: Math.max(0, b.fuse), range: b.range, pierce: b.pierce });
  }
  if (extra) bombs.push({ ...extra, t: FUSE_FRAMES });

  // casas que seguram o braço de uma explosão: bombas no chão (a chutada, onde vai parar) e a hipotética
  const cells = new Set<number>();
  for (const b of bombs) if (!b.flying) cells.add(idx(b.gx, b.gy));

  // reação em cadeia: uma bomba no alcance de outra explode junto com ela
  const blasts = bombs.map(b => blastCells(s, b, cells));
  for (let changed = true, guard = 0; changed && guard < bombs.length + 1; guard++) {
    changed = false;
    bombs.forEach((a, ia) => {
      bombs.forEach((b, ib) => {
        if (ia !== ib && b.t > a.t && blasts[ia].includes(idx(b.gx, b.gy))) { b.t = a.t; changed = true; }
      });
    });
  }
  bombs.forEach((b, k) => { for (const i of blasts[k].concat(b.trail ?? [])) danger[i] = Math.min(danger[i], b.t); });

  // blocos de pressão que estão para cair
  const pr = s.pressure;
  if (s.timeLeft >= 0 && s.timeLeft <= pr.startAt + PRESSURE_INTERVAL) {
    const every = pr.overtime ? 1 : PRESSURE_INTERVAL;
    let k = 0;
    for (let j = pr.next; j < pr.order.length && k < 12; j++) {
      const i = pr.order[j];
      if (s.arena.cells[i] === CELL.HARD) continue;
      danger[i] = Math.min(danger[i], Math.max(0, (k + 1) * every - pr.timer));
      k++;
    }
  }
  return danger;
}

/** Casa andável para a IA: vazia, sem bomba (a não ser a de partida) e sem chama agora.
 *  Aproximação: qualquer bomba fora da casa de partida bloqueia (o core libera `passers` assim que o jogador sai da casa da bomba, então na prática dá no mesmo). */
function walkable(s: RoundState, i: number, start: number, danger: Int32Array): boolean {
  if (s.arena.cells[i] !== CELL.EMPTY) return false;
  if (danger[i] === 0) return false;
  if (i === start) return true;
  return !s.bombs.some(b => !b.carried && !b.flight && idx(cellX(b.x), cellY(b.y)) === i);
}

/** "Centrado" na própria casa: a menos de um passo do centro nos dois eixos. Com velocidades que não dividem 128
 *  (11, 12, 15 sub/frame…) o jogador passa do centro exato; exigir igualdade faria a IA ir e voltar para sempre.
 *  Uma bomba solta aqui cai na mesma casa: |desvio| < passo ≤ 15 < 64. */
function centered(p: Player): boolean {
  const spd = speedSub(p);
  return Math.abs(p.x - centerX(cellX(p.x))) < spd && Math.abs(p.y - centerY(cellY(p.y))) < spd;
}

/** Frames para atravessar uma casa na velocidade atual do jogador. */
function framesPerCell(p: Player): number {
  return Math.ceil(T / speedSub(p));
}

interface Search { prev: Int32Array; dist: Int32Array }

/** BFS a partir de `start`, só por casas que continuam seguras na hora em que o jogador passa por elas. */
function search(s: RoundState, p: Player, start: number, danger: Int32Array, margin: number): Search {
  const n = GRID_W * GRID_H;
  const prev = new Int32Array(n).fill(-1);
  const dist = new Int32Array(n).fill(-1);
  const fpc = framesPerCell(p);
  dist[start] = 0;
  const queue = [start];
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h];
    const gx = c % GRID_W, gy = Math.floor(c / GRID_W);
    for (let d = 1; d <= 4; d++) {
      const x = gx + DX[d], y = gy + DY[d];
      if (!inPlayfield(x, y)) continue;
      const i = idx(x, y);
      if (dist[i] >= 0 || !walkable(s, i, start, danger)) continue;
      const arrive = (dist[c] + 1) * fpc;
      // não entra em casa que vai pegar fogo enquanto o jogador ainda estiver passando por ela
      if (danger[i] !== SAFE && danger[i] <= arrive + fpc + margin) continue;
      dist[i] = dist[c] + 1;
      prev[i] = c;
      queue.push(i);
    }
  }
  return { prev, dist };
}

function pathTo(sr: Search, target: number): number[] {
  const path: number[] = [];
  for (let c = target; sr.prev[c] >= 0; c = sr.prev[c]) path.unshift(c);
  return path;
}

/** Caminho até a casa segura mais próxima (vazio se já está segura ou se não há saída). */
function escapePath(s: RoundState, p: Player, start: number, danger: Int32Array, margin: number): number[] | null {
  if (danger[start] === SAFE) return [];
  const sr = search(s, p, start, danger, margin);
  let best = -1;
  for (let i = 0; i < sr.dist.length; i++) {
    if (sr.dist[i] < 0 || danger[i] !== SAFE) continue;
    if (best < 0 || sr.dist[i] < sr.dist[best]) best = i;
  }
  return best < 0 ? null : pathTo(sr, best);
}

/** Uma bomba aqui atingiria um bloco destrutível ou (se `hunt`) outro jogador? */
function bombUseful(s: RoundState, p: Player, gx: number, gy: number, hunt: boolean): boolean {
  const cells = blastCells(s, { gx, gy, t: 0, range: flameRange(p), pierce: p.pierce }, groundBombCells(s));
  for (const i of cells) {
    if (s.arena.cells[i] === CELL.SOFT && s.arena.burning[i] === 0) return true;
    if (hunt && s.players.some(q => q !== p && q.active && q.alive && q.dying === 0 && idx(cellX(q.x), cellY(q.y)) === i)) return true;
  }
  return false;
}

function ownBombs(s: RoundState, p: Player): number {
  return s.bombs.filter(b => b.owner === p.slot).length;
}

/** Decide o que fazer: caminho a seguir e se coloca bomba agora. */
function think(s: RoundState, p: Player, level: AiLevel, brain: Brain): void {
  brain.bomb = false;
  const gx = cellX(p.x), gy = cellY(p.y);
  const here = idx(gx, gy);
  const danger = dangerMap(s);
  const roll = aiRoll(s.frame, p.slot, 1);

  // 1) fugir
  if (danger[here] !== SAFE) {
    if (roll < level.mistake) { brain.path = []; return; }   // hesitou
    brain.path = escapePath(s, p, here, danger, level.margin) ?? [];
    return;
  }

  // Fora de perigo e entre duas casas: continua o caminho atual (ou centraliza, se não tiver um) em vez de
  // replanejar no meio do passo — replanejar aqui faz a IA oscilar entre duas casas sem nunca chegar.
  if (!centered(p)) {
    if (brain.path.length === 0) brain.path = [here];
    return;
  }

  const sr = search(s, p, here, danger, level.margin);
  const reach = (i: number) => sr.dist[i] >= 0;

  // 2) item perto
  let bestItem = -1;
  for (let i = 0; i < s.arena.items.length; i++) {
    const it = s.arena.items[i];
    if (it === ITEM.NONE || it === ITEM.SKULL || !reach(i) || sr.dist[i] > 6) continue;
    if (bestItem < 0 || sr.dist[i] < sr.dist[bestItem]) bestItem = i;
  }
  if (bestItem >= 0 && roll >= level.mistake) { brain.path = pathTo(sr, bestItem); return; }

  // 3) bomba aqui, se for útil e der para fugir dela (já estamos centralizados: o core anda antes de soltar a
  //    bomba, e na divisa entre duas casas ela cairia na vizinha, onde a rota de fuga calculada não vale).
  const canPlace = ownBombs(s, p) < p.maxBombs && !s.bombs.some(b => !b.carried && !b.flight && idx(cellX(b.x), cellY(b.y)) === here);
  if (canPlace && bombUseful(s, p, gx, gy, level.hunt)) {
    const withBomb = dangerMap(s, { gx, gy, range: flameRange(p), pierce: p.pierce });
    const out = escapePath(s, p, here, withBomb, level.margin);
    if (out && out.length > 0) { brain.bomb = true; brain.path = out; return; }
  }

  // 4) andar até uma casa de onde uma bomba seria útil (a mais próxima)
  let bestSpot = -1;
  for (let i = 0; i < sr.dist.length; i++) {
    if (!reach(i) || i === here) continue;
    if (!bombUseful(s, p, i % GRID_W, Math.floor(i / GRID_W), level.hunt)) continue;
    if (bestSpot < 0 || sr.dist[i] < sr.dist[bestSpot]) bestSpot = i;
  }
  if (bestSpot >= 0 && roll >= level.mistake) { brain.path = pathTo(sr, bestSpot); return; }

  // 5) passear para uma vizinha segura
  const options: number[] = [];
  for (let d = 1; d <= 4; d++) {
    const i = idx(gx + DX[d], gy + DY[d]);
    if (inPlayfield(gx + DX[d], gy + DY[d]) && reach(i) && sr.dist[i] === 1) options.push(i);
  }
  brain.path = options.length ? [options[aiRoll(s.frame, p.slot, 2) % options.length]] : [];
}

/** Botões de direção para seguir o caminho. Para virar basta apertar a direção da próxima casa: a correção de
 *  quina de `movePlayer` alinha o eixo perpendicular sozinha (em min(|desvio|, passo), sem passar do centro).
 *  Só com desvio maior que a quina é que primeiro se volta para o centro. */
function steer(p: Player, brain: Brain): number {
  const gx = cellX(p.x), gy = cellY(p.y);
  const here = idx(gx, gy);
  const spd = speedSub(p);
  const ox = p.x - centerX(gx), oy = p.y - centerY(gy);
  const near = Math.abs(ox) < spd && Math.abs(oy) < spd;
  while (brain.path.length && brain.path[0] === here && near) brain.path.shift();
  const target = brain.path[0] ?? here;
  const tgx = target % GRID_W, tgy = Math.floor(target / GRID_W);
  if (tgx !== gx) {
    if (Math.abs(oy) > CORNER_SUB) return oy < 0 ? BTN.DOWN : BTN.UP;
    return tgx > gx ? BTN.RIGHT : BTN.LEFT;
  }
  if (tgy !== gy) {
    if (Math.abs(ox) > CORNER_SUB) return ox < 0 ? BTN.RIGHT : BTN.LEFT;
    return tgy > gy ? BTN.DOWN : BTN.UP;
  }
  // chegou na casa-alvo: aproxima do centro (até menos de um passo) e para
  if (Math.abs(ox) >= spd) return ox < 0 ? BTN.RIGHT : BTN.LEFT;
  if (Math.abs(oy) >= spd) return oy < 0 ? BTN.DOWN : BTN.UP;
  return 0;
}

/**
 * Entradas das CPUs para este tick. `cpu[i]` diz se o slot i é controlado pela IA; os demais recebem 0.
 * Determinístico: depende só do estado da rodada e de `ai`.
 */
export function aiInputs(s: RoundState, ai: AiState, cpu: readonly boolean[], levelIdx: number): number[] {
  if (ai.round !== s) { ai.round = s; ai.brains = s.players.map(() => ({ path: [], bomb: false, nextThink: 0 })); }
  const level = AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, levelIdx))];
  const out = [0, 0, 0, 0, 0];
  if (s.phase !== 'playing') return out;
  for (const p of s.players) {
    if (!cpu[p.slot] || !p.active || !p.alive || p.dying > 0) continue;
    const brain = ai.brains[p.slot];
    const react = p.disease === DISEASE.DIARRHEA ? 1 : level.react;
    if (s.frame >= brain.nextThink) {
      think(s, p, level, brain);
      brain.nextThink = s.frame + react;
      // solta a bomba parado (neste quadro não anda) para ela cair exatamente na casa planejada
      if (brain.bomb) { out[p.slot] = BTN.A; continue; }
    }
    out[p.slot] = steer(p, brain);
  }
  return out;
}
