import { BTN, CELL, DIR, DISEASE, DX, DY, ITEM, type Bomb, type Player, type RoundState } from './types';
import { CORNER_SUB, FLAME_FRAMES, FUSE_FRAMES, GRID_H, GRID_W, MOVE_BOMB_SUB, PRESSURE_INTERVAL, T } from './constants';
import { cellX, cellY, centerX, centerY, idx, inPlayfield } from './grid';
import { flameRange, speedSub } from './player';
import { blocksBomb, blocksPlayer } from './query';

/** Casa que nenhuma chama conhecida vai atingir. */
export const SAFE = 1_000_000;

/** Quantos ticks antes do início da pressão a IA já trata as casas da borda como condenadas. */
const PRESSURE_LEAD = 300;

export interface AiLevel {
  react: number;    // frames entre decisões
  mistake: number;  // % de decisões erradas (demora a fugir ou anda à toa)
  hunt: boolean;    // persegue outros jogadores (e não só blocos)
  margin: number;   // folga, em frames, exigida antes e depois de cada explosão prevista (busca estrita)
  open: boolean;    // entre refúgios igualmente próximos, prefere os com 2+ saídas (evita beco)
  alert: number;    // frames até replanejar quando surge/some/é chutada uma bomba (em vez de esperar `react`)
}

/** Fraco, Normal, Forte (índice = rules.cpuLevel). */
export const AI_LEVELS: readonly AiLevel[] = [
  { react: 20, mistake: 20, hunt: false, margin: 4, open: false, alert: 20 },
  { react: 8, mistake: 5, hunt: true, margin: 8, open: true, alert: 2 },
  { react: 2, mistake: 0, hunt: true, margin: 12, open: true, alert: 0 },
];

/** `go[k]`: frame (absoluto) a partir do qual pode andar rumo a `path[k]` (espera chamas passarem). */
interface Brain { path: number[]; go: number[]; bomb: boolean; nextThink: number }

/** Memória das CPUs (caminho planejado, próxima decisão). Fica fora do RoundState de propósito (o core não depende
 *  da IA); um rollback online que restaure um RoundState antigo precisará clonar e restaurar esta memória junto. */
export interface AiState { round: RoundState | null; brains: Brain[]; bombsSig: number }

export function createAi(): AiState {
  return { round: null, brains: [], bombsSig: 0 };
}

/** Número pseudoaleatório 0..99 derivado só do estado (frame, slot, sal): mantém a IA determinística sem guardar RNG.
 *  Usa um hash próprio em vez de `s.rng`: tirar números do RNG da rodada mudaria o sorteio de itens/spawns conforme a quantidade de CPUs. */
export function aiRoll(frame: number, slot: number, salt: number): number {
  let h = Math.imul(frame + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}

interface BombInfo { gx: number; gy: number; t: number; range: number; pierce: boolean; trail?: number[]; flying?: boolean }
interface Extra { gx: number; gy: number; range: number; pierce: boolean }

/** Casas ocupadas por bombas no chão (seguram o braço de uma explosão e barram o caminho). */
function groundBombCells(s: RoundState): Set<number> {
  const out = new Set<number>();
  for (const b of s.bombs) if (!b.carried && !b.flight) out.add(idx(cellX(b.x), cellY(b.y)));
  return out;
}

/** Bomba chutada: repete `stepSlide` (bombs.ts) até o pavio acabar, ela parar ou entrar numa chama acesa, e devolve
 *  a casa e o frame da explosão e as casas por onde passa. O pavio continua correndo durante o deslize. */
function slideEnd(s: RoundState, b: Bomb): { gx: number; gy: number; t: number; trail: number[] } {
  const dx = DX[b.slide], dy = DY[b.slide];
  let x = b.x, y = b.y;
  const trail = [idx(cellX(x), cellY(y))];
  for (let k = 1; k <= b.fuse; k++) {
    if (x % T === 0 && y % T === 0 && blocksBomb(s, cellX(x) + dx, cellY(y) + dy)) break;
    x += dx * MOVE_BOMB_SUB; y += dy * MOVE_BOMB_SUB;
    const c = idx(cellX(x), cellY(y));
    if (c !== trail[trail.length - 1]) trail.push(c);
    if (s.arena.flame[c] > k) return { gx: cellX(x), gy: cellY(y), t: k, trail };
  }
  return { gx: cellX(x), gy: cellY(y), t: Math.max(0, b.fuse), trail };
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
 * Perigo previsto de cada casa. Explosões futuras tornam a casa mortal nos frames [at, end): `at` = primeira explosão
 * que a atinge (SAFE = nenhuma), `end` = quando apaga a chama da última (SAFE = bloco de pressão, para sempre).
 * Frames contados a partir do próximo tick (1 = o próximo). Chamas que já estão na arena ficam em `s.arena.flame`
 * (mortais enquanto o contador não zera) e não entram aqui.
 */
interface Hazard { at: Int32Array; end: Int32Array }

function hazards(s: RoundState, extra?: Extra): Hazard {
  const n = GRID_W * GRID_H;
  const at = new Int32Array(n).fill(SAFE);
  const last = new Int32Array(n).fill(-1);

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
      // chutada: explode onde parar (ou onde estiver quando o pavio acabar, ou ao entrar numa chama); o trajeto todo fica marcado
      const e = slideEnd(s, b);
      bombs.push({ gx: e.gx, gy: e.gy, t: e.t, range: b.range, pierce: b.pierce, trail: e.trail });
      continue;
    }
    const gx = cellX(b.x), gy = cellY(b.y);
    // bomba parada em cima de chama explode no próximo tick
    const t = s.arena.flame[idx(gx, gy)] > 1 ? 1 : Math.max(0, b.fuse);
    bombs.push({ gx, gy, t, range: b.range, pierce: b.pierce });
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
  bombs.forEach((b, k) => {
    for (const i of blasts[k].concat(b.trail ?? [])) { at[i] = Math.min(at[i], b.t); last[i] = Math.max(last[i], b.t); }
  });
  const end = new Int32Array(n).fill(SAFE);
  for (let i = 0; i < n; i++) if (last[i] >= 0) end[i] = last[i] + FLAME_FRAMES;

  // blocos de pressão (mortais daí em diante): todos os que ainda vão cair, a partir de alguns segundos antes de a
  // pressão começar — assim a IA sai cedo das bordas em vez de ficar encurralada. Sem nenhum refúgio (morte súbita),
  // a fuga vai para a casa que cai por último.
  const pr = s.pressure;
  const lead = s.timeLeft - pr.startAt;   // ticks até o relógio chegar no início da pressão
  if (s.timeLeft >= 0 && lead <= PRESSURE_LEAD) {
    const every = pr.overtime ? 1 : PRESSURE_INTERVAL;
    const base = lead > 0 ? lead - 1 : -pr.timer;
    let k = 0;
    for (let j = pr.next; j < pr.order.length; j++) {
      const i = pr.order[j];
      if (s.arena.cells[i] === CELL.HARD) continue;
      at[i] = Math.min(at[i], Math.max(1, base + (k + 1) * every));
      end[i] = SAFE;
      k++;
    }
  }
  return { at, end };
}

/**
 * Para cada casa, em quantos frames ela passa a ter chama (0 = já tem; SAFE = ninguém atinge).
 * Considera pavio, reação em cadeia, bombas chutadas/voando, chamas atuais e os próximos blocos de pressão.
 * `extra`: bomba hipotética (para decidir se dá para fugir antes de colocá-la).
 */
export function dangerMap(s: RoundState, extra?: Extra): Int32Array {
  const danger = hazards(s, extra).at;
  for (let i = 0; i < danger.length; i++) if (s.arena.flame[i] > 0) danger[i] = 0;
  return danger;
}

/** A janela mortal da casa `i` (alargada pela folga) cruza os frames [from, to]? */
function hits(hz: Hazard, i: number, from: number, to: number, margin: number): boolean {
  if (from > to || hz.at[i] === SAFE) return false;
  return to >= hz.at[i] - margin && (hz.end[i] === SAFE || from < hz.end[i] + margin);
}

/** "Centrado" na própria casa: a menos de um passo do centro nos dois eixos. Com velocidades que não dividem 128
 *  (11, 12, 15 sub/frame…) o jogador passa do centro exato; exigir igualdade faria a IA ir e voltar para sempre.
 *  Uma bomba solta aqui cai na mesma casa: |desvio| < passo ≤ 15 < 64. */
function centered(p: Player): boolean {
  const spd = speedSub(p);
  return Math.abs(p.x - centerX(cellX(p.x))) < spd && Math.abs(p.y - centerY(cellY(p.y))) < spd;
}

/** Frames até o jogador (com desvio `along` rumo à direção `d` e `perp` no outro eixo) entrar na casa vizinha, e até
 *  chegar ao centro dela. A correção de quina gasta frames sem avançar; a divisa fica a 64 sub para a direita/baixo e
 *  a 65 para a esquerda/cima (arredondamento de `cellX`/`cellY`). */
function stepFrames(d: number, along: number, perp: number, spd: number): { enter: number; arrive: number } {
  const a = Math.ceil(Math.abs(perp) / spd);
  const edge = DX[d] + DY[d] > 0 ? 64 : 65;
  return { enter: a + Math.max(1, Math.ceil((edge - along) / spd)), arrive: a + Math.ceil((T - along) / spd) };
}

/** Desvio do jogador em relação ao centro da sua casa, no eixo de `d` (positivo = rumo a `d`) e no outro eixo. */
function offsets(p: Player, d: number): { along: number; perp: number } {
  const ox = p.x - centerX(cellX(p.x)), oy = p.y - centerY(cellY(p.y));
  return DX[d] !== 0 ? { along: ox * DX[d], perp: oy } : { along: oy * DY[d], perp: ox };
}

/** `time`: frame em que chega ao centro; `go`: frame em que começa a andar rumo à casa (vindo de `prev`). */
interface Search { prev: Int32Array; dist: Int32Array; time: Int32Array; go: Int32Array }

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
 * Menor tempo de chegada a cada casa (Dijkstra), a partir da posição real do jogador (não do centro), passando só
 * por casas que não explodem enquanto ele está nelas. Pode esperar parado numa casa segura até a chama da próxima
 * apagar (chama atual ou explosão prevista). `delay`: frames parado antes de começar (ex.: o tick de soltar a bomba).
 */
function search(s: RoundState, p: Player, hz: Hazard, blocked: ReadonlySet<number>, margin: number, delay: number): Search {
  const n = GRID_W * GRID_H;
  const prev = new Int32Array(n).fill(-1);
  const dist = new Int32Array(n).fill(-1);
  const time = new Int32Array(n).fill(-1);
  const go = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const spd = speedSub(p);
  const start = idx(cellX(p.x), cellY(p.y));
  const ox = p.x - centerX(cellX(p.x)), oy = p.y - centerY(cellY(p.y));
  dist[start] = 0;
  time[start] = delay + Math.ceil((Math.abs(ox) + Math.abs(oy)) / spd);
  const heap: number[] = [];
  heapPush(heap, time[start] * 256 + start);
  while (heap.length) {
    const c = heapPop(heap) & 255;
    if (done[c]) continue;
    done[c] = 1;
    const cx = c % GRID_W, cy = Math.floor(c / GRID_W);
    for (let d = 1; d <= 4; d++) {
      const x = cx + DX[d], y = cy + DY[d];
      if (!inPlayfield(x, y)) continue;
      const i = idx(x, y);
      if (done[i] || s.arena.cells[i] !== CELL.EMPTY || blocked.has(i)) continue;
      const o = c === start ? offsets(p, d) : { along: 0, perp: 0 };
      const k = stepFrames(d, o.along, o.perp, spd);
      const from = c === start ? 1 : time[c];
      let dep = Math.max(c === start ? delay : time[c], s.arena.flame[i] - k.enter);   // chama atual apaga antes de entrar
      if (hits(hz, i, dep + k.enter, dep + k.arrive + Math.ceil(65 / spd), margin)) {
        if (hz.end[i] === SAFE) continue;                   // pressão: nunca mais passa
        dep = Math.max(dep, hz.end[i] + margin - k.enter);  // espera a explosão passar
      }
      if (hits(hz, c, from, dep + k.enter - 1, margin)) continue;   // não dá para ficar em `c` até sair
      const arr = dep + k.arrive;
      if (time[i] >= 0 && arr >= time[i]) continue;
      time[i] = arr; go[i] = dep; prev[i] = c; dist[i] = dist[c] + 1;
      heapPush(heap, arr * 256 + i);
    }
  }
  return { prev, dist, time, go };
}

interface Route { path: number[]; go: number[] }

function route(sr: Search, target: number): Route {
  const path: number[] = [], go: number[] = [];
  for (let c = target; sr.prev[c] >= 0; c = sr.prev[c]) { path.unshift(c); go.unshift(sr.go[c]); }
  return { path, go };
}

/** Vizinhas andáveis (saídas) de uma casa. */
function exits(s: RoundState, i: number, blocked: ReadonlySet<number>): number {
  const gx = i % GRID_W, gy = Math.floor(i / GRID_W);
  let k = 0;
  for (let d = 1; d <= 4; d++) {
    const x = gx + DX[d], y = gy + DY[d];
    if (inPlayfield(x, y) && s.arena.cells[idx(x, y)] === CELL.EMPTY && !blocked.has(idx(x, y))) k++;
  }
  return k;
}

/** Refúgio: casa onde dá para ficar parado depois de chegar (nenhuma explosão prevista dali em diante). */
function refuge(hz: Hazard, sr: Search, i: number, margin: number): boolean {
  if (sr.time[i] < 0) return false;
  return hz.at[i] === SAFE || (hz.end[i] !== SAFE && sr.time[i] >= hz.end[i] + margin);
}

/**
 * Rota até o refúgio mais próximo (em tempo; entre os igualmente próximos, com `open`, prefere os que não são beco).
 * Tenta com a folga do nível e, se `strict` for falso, de novo com folga 0; sem refúgio, vai para a casa alcançável
 * que explode por último (ganha tempo; as chamas podem abrir caminho depois). null = sem refúgio na busca estrita.
 */
function escape(s: RoundState, p: Player, hz: Hazard, blocked: ReadonlySet<number>, level: AiLevel,
  strict: boolean, delay: number): Route | null {
  const fpc = Math.ceil(T / speedSub(p));
  let sr: Search | null = null;
  for (const margin of strict ? [level.margin] : [level.margin, 0]) {
    sr = search(s, p, hz, blocked, margin, delay);
    let best = -1, bestScore = 0;
    for (let i = 0; i < sr.time.length; i++) {
      if (!refuge(hz, sr, i, margin)) continue;
      const cellsAway = Math.ceil(sr.time[i] / fpc);
      const score = (cellsAway * 2 + (level.open && exits(s, i, blocked) < 2 ? 1 : 0)) * 100_000 + sr.time[i];
      if (best < 0 || score < bestScore) { best = i; bestScore = score; }
    }
    if (best >= 0) return route(sr, best);
  }
  if (strict || !sr) return null;
  let best = -1;
  for (let i = 0; i < sr.time.length; i++) {
    if (sr.time[i] < 0) continue;
    if (best < 0 || hz.at[i] > hz.at[best] || (hz.at[i] === hz.at[best] && sr.time[i] < sr.time[best])) best = i;
  }
  return route(sr, best);
}

/** `q` tem algum refúgio alcançável com este perigo (folga 0)? */
function hasRefuge(s: RoundState, q: Player, hz: Hazard, blocked: ReadonlySet<number>): boolean {
  const sr = search(s, q, hz, blocked, 0, 0);
  for (let i = 0; i < sr.time.length; i++) if (refuge(hz, sr, i, 0)) return true;
  return false;
}

/** Jogadores de pé (ativos, vivos, sem animação de morte). */
function standing(s: RoundState): Player[] {
  return s.players.filter(q => q.active && q.alive && q.dying === 0);
}

/** Colega de time (só no modo `team`): nunca é alvo e não pode estar no alcance de uma bomba nossa. */
function mate(s: RoundState, p: Player, q: Player): boolean {
  return q !== p && s.rules.mode === 'team' && q.team === p.team;
}

/** Uma bomba aqui atingiria um bloco destrutível ou (se `hunt`) um adversário? */
function bombUseful(s: RoundState, p: Player, gx: number, gy: number, hunt: boolean): boolean {
  const cells = blastCells(s, { gx, gy, t: 0, range: flameRange(p), pierce: p.pierce }, groundBombCells(s));
  for (const i of cells) {
    if (s.arena.cells[i] === CELL.SOFT && s.arena.burning[i] === 0) return true;
    if (hunt && standing(s).some(q => q !== p && !mate(s, p, q) && idx(cellX(q.x), cellY(q.y)) === i)) return true;
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
  const hz = hazards(s);
  const blocked = groundBombCells(s);
  const roll = aiRoll(s.frame, p.slot, 1);
  const follow = (r: Route | null) => {
    brain.path = r ? r.path : [];
    brain.go = r ? r.go.map(t => s.frame + t) : [];
  };

  // 1) fugir (também no meio de um passo: a busca parte da posição real)
  if (hz.at[here] !== SAFE) {
    if (roll < level.mistake) { follow(null); return; }   // hesitou
    follow(escape(s, p, hz, blocked, level, false, 0));
    return;
  }

  // Fora de perigo e entre duas casas: continua o caminho atual (ou centraliza, se não tiver um) em vez de
  // replanejar no meio do passo — replanejar aqui faz a IA oscilar entre duas casas sem nunca chegar.
  if (!centered(p)) {
    if (brain.path.length === 0) { brain.path = [here]; brain.go = [0]; }
    return;
  }

  const sr = search(s, p, hz, blocked, level.margin, 0);
  // alvos (itens, casas para bomba, passeio) só em casas sem perigo nenhum previsto
  const target = (i: number) => sr.time[i] >= 0 && hz.at[i] === SAFE && s.arena.flame[i] === 0;

  // 2) item perto
  let bestItem = -1;
  for (let i = 0; i < s.arena.items.length; i++) {
    const it = s.arena.items[i];
    if (it === ITEM.NONE || it === ITEM.SKULL || !target(i) || sr.dist[i] > 6) continue;
    if (bestItem < 0 || sr.time[i] < sr.time[bestItem]) bestItem = i;
  }
  if (bestItem >= 0 && roll >= level.mistake) { follow(route(sr, bestItem)); return; }

  // 3) bomba aqui, se for útil e der para fugir dela pela busca estrita (a relaxada fica só para emergências).
  //    Estamos centrados: ela cai nesta casa. Neste tick só solta a bomba; a fuga começa no seguinte (delay 1).
  // (com outro jogador com Luva na mesma casa, não: se ele também apertar A, pega a bomba e arremessa)
  const crowded = s.players.some(q => q !== p && q.glove && q.active && q.alive && q.dying === 0 && idx(cellX(q.x), cellY(q.y)) === here);
  const canPlace = ownBombs(s, p) < p.maxBombs && !blocked.has(here) && !crowded;
  if (canPlace && bombUseful(s, p, gx, gy, level.hunt)) {
    const withBomb = hazards(s, { gx, gy, range: flameRange(p), pierce: p.pierce });
    const blockedWith = new Set(blocked).add(here);
    // a bomba (ou a cadeia que ela antecipa) não pode chegar num colega de time, nem tirar a fuga dele
    const hurtsMate = standing(s).some(q => {
      if (!mate(s, p, q)) return false;
      const c = idx(cellX(q.x), cellY(q.y));
      if (withBomb.at[c] < hz.at[c]) return true;
      return Math.abs(cellX(q.x) - gx) + Math.abs(cellY(q.y) - gy) <= 10 &&
        hasRefuge(s, q, hz, blocked) && !hasRefuge(s, q, withBomb, blockedWith);
    });
    const out = hurtsMate ? null : escape(s, p, withBomb, blockedWith, level, true, 1);
    if (out && out.path.length > 0) { brain.bomb = true; follow(out); return; }
  }

  // 4) andar até uma casa de onde uma bomba seria útil (a mais próxima)
  let bestSpot = -1;
  for (let i = 0; i < sr.time.length; i++) {
    if (!target(i) || i === here) continue;
    if (!bombUseful(s, p, i % GRID_W, Math.floor(i / GRID_W), level.hunt)) continue;
    if (bestSpot < 0 || sr.time[i] < sr.time[bestSpot]) bestSpot = i;
  }
  if (bestSpot >= 0 && roll >= level.mistake) { follow(route(sr, bestSpot)); return; }

  // 5) passear para uma vizinha segura
  const options: number[] = [];
  for (let d = 1; d <= 4; d++) {
    const i = idx(gx + DX[d], gy + DY[d]);
    if (inPlayfield(gx + DX[d], gy + DY[d]) && target(i) && sr.dist[i] === 1) options.push(i);
  }
  follow(options.length ? route(sr, options[aiRoll(s.frame, p.slot, 2) % options.length]) : null);
}

/** Botões de direção para seguir o caminho. Para virar basta apertar a direção da próxima casa: a correção de
 *  quina de `movePlayer` alinha o eixo perpendicular sozinha (em min(|desvio|, passo), sem passar do centro).
 *  Só com desvio maior que a quina é que primeiro se volta para o centro. Espera (centrado) enquanto não chega o
 *  frame planejado para a próxima casa ou enquanto a chama dela ainda estaria acesa na hora de entrar. */
function steer(s: RoundState, p: Player, brain: Brain): number {
  const gx = cellX(p.x), gy = cellY(p.y);
  const here = idx(gx, gy);
  const spd = speedSub(p);
  const ox = p.x - centerX(gx), oy = p.y - centerY(gy);
  const near = Math.abs(ox) < spd && Math.abs(oy) < spd;
  while (brain.path.length && brain.path[0] === here && near) { brain.path.shift(); brain.go.shift(); }
  const target = brain.path[0] ?? here;
  if (target !== here) {
    const tgx = target % GRID_W, tgy = Math.floor(target / GRID_W);
    const d = tgx > gx ? DIR.RIGHT : tgx < gx ? DIR.LEFT : tgy > gy ? DIR.DOWN : DIR.UP;
    const nx = gx + DX[d], ny = gy + DY[d];
    const o = offsets(p, d);
    if (blocksPlayer(s, nx, ny, p.slot)) {
      brain.path = []; brain.go = [];                        // apareceu uma bomba (ou bloco) no caminho: replaneja
    } else if (s.frame >= (brain.go[0] ?? 0) && s.arena.flame[idx(nx, ny)] <= stepFrames(d, o.along, o.perp, spd).enter) {
      if (Math.abs(o.perp) > CORNER_SUB) return DX[d] !== 0 ? (oy < 0 ? BTN.DOWN : BTN.UP) : (ox < 0 ? BTN.RIGHT : BTN.LEFT);
      return d === DIR.RIGHT ? BTN.RIGHT : d === DIR.LEFT ? BTN.LEFT : d === DIR.DOWN ? BTN.DOWN : BTN.UP;
    }
  }
  // na casa-alvo (ou esperando): aproxima do centro (até menos de um passo) e para
  if (Math.abs(ox) >= spd) return ox < 0 ? BTN.RIGHT : BTN.LEFT;
  if (Math.abs(oy) >= spd) return oy < 0 ? BTN.DOWN : BTN.UP;
  return 0;
}

/**
 * Entradas das CPUs para este tick. `cpu[i]` diz se o slot i é controlado pela IA; os demais recebem 0.
 * Determinístico: depende só do estado da rodada e de `ai`.
 */
export function aiInputs(s: RoundState, ai: AiState, cpu: readonly boolean[], levelIdx: number): number[] {
  if (ai.round !== s) { ai.round = s; ai.brains = s.players.map(() => ({ path: [], go: [], bomb: false, nextThink: 0 })); }
  // bomba nova, explodida, chutada ou arremessada: antecipa a próxima decisão (conforme `alert` do nível)
  let sig = s.bombs.length;
  for (const b of s.bombs) sig = (Math.imul(sig, 31) + b.id * 8 + b.slide + (b.flight ? 5 : 0) + (b.carried ? 6 : 0)) | 0;
  const changed = sig !== ai.bombsSig;
  ai.bombsSig = sig;
  const level = AI_LEVELS[Math.max(0, Math.min(AI_LEVELS.length - 1, levelIdx))];
  const out = [0, 0, 0, 0, 0];
  if (s.phase !== 'playing') return out;
  for (const p of s.players) {
    if (!cpu[p.slot] || !p.active || !p.alive || p.dying > 0) continue;
    const brain = ai.brains[p.slot];
    if (changed) brain.nextThink = Math.min(brain.nextThink, s.frame + level.alert);
    const react = p.disease === DISEASE.DIARRHEA ? 1 : level.react;
    if (s.frame >= brain.nextThink) {
      think(s, p, level, brain);
      brain.nextThink = s.frame + react;
      // solta a bomba parado (neste quadro não anda) para ela cair exatamente na casa planejada
      if (brain.bomb) { out[p.slot] = BTN.A; continue; }
    }
    out[p.slot] = steer(s, p, brain);
  }
  return out;
}
