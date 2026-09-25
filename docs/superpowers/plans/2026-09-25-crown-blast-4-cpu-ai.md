# Crown Blast: Plano 4, IA das CPUs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as CPUs jogarem (spec §9), nos níveis Fraco, Normal e Forte. Até aqui elas ficavam paradas.

**Architecture:** Um módulo novo e puro no core, `web/src/core/ai.ts`, que não altera nenhum outro arquivo do core além de uma linha de export no `index.ts`. Ele tem três partes.
- **`dangerMap(s)`:** diz, para cada casa, em quantos frames ela terá chama. Considera o pavio, a reação em cadeia, as chamas atuais, os próximos blocos de pressão e uma bomba hipotética opcional.
- **Busca de caminho (BFS):** só passa por casas que continuam seguras na hora em que o jogador atravessa cada uma.
- **Decisão por prioridade:** fugir → item próximo → bomba (só se houver rota de fuga garantida) → ir até um bloco/inimigo → passear.

A IA é determinística. O "sorteio" (`aiRoll`) é um hash de frame/slot, e a memória (`AiState`: caminho e próxima decisão) vive na sessão. Os níveis mudam o tempo de reação, a taxa de erro, se persegue jogadores e a folga de segurança. Na sessão, os slots de CPU recebem `aiInputs(...)` no lugar dos 0 de hoje.

**Tech Stack:** TypeScript 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-web-design.md` (§9)

## Global Constraints

- **Código validado:** tudo aqui já foi escrito e testado pelo controlador, que também conferiu CPUs jogando no navegador: 213 testes, `tsc` limpo, build ok, 22 screenshots. Copie os blocos **exatamente**; "substituir" = trocar o arquivo inteiro.
- O core continua determinístico: nada de `Math.random`, `Date` ou DOM em `ai.ts`.
- Regras do core respeitadas pela IA: ela só coloca bomba centralizada na casa e **sem andar naquele quadro**, porque o core anda antes de soltar a bomba.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (ou a linha que o harness do modelo exigir).

---

### Task 1: Módulo de IA no core

**Files:**
- Create: `web/src/core/ai.ts`, `web/tests/core/ai.test.ts`
- Replace: `web/src/core/index.ts` (acrescenta o export da IA)

**Interfaces:**
- Produces: `SAFE`, `interface AiLevel { react; mistake; hunt; margin }`, `AI_LEVELS` (Fraco/Normal/Forte), `interface AiState`, `createAi()`, `aiRoll(frame, slot, salt)`, `dangerMap(s, extra?)`, `aiInputs(s, ai, cpu: boolean[], levelIdx): number[]`

- [ ] **Step 1: Escrever o teste** `web/tests/core/ai.test.ts`:

```ts
import { newRound, addBomb, place } from './helpers';
import { createAi, aiInputs, dangerMap, aiRoll, SAFE, AI_LEVELS } from '../../src/core/ai';
import { step, createRound } from '../../src/core/round';
import { idx } from '../../src/core/grid';
import { ITEM, CELL, defaultRules, type RoundState, type GameEvent } from '../../src/core/types';
import { hashState } from '../../src/core/hash';
import { INTRO_FRAMES } from '../../src/core/constants';

/** Roda `frames` ticks com a IA controlando os slots marcados em `cpu`; os demais ficam parados. */
function play(s: RoundState, cpu: boolean[], level: number, frames: number): GameEvent[] {
  const ai = createAi();
  const ev: GameEvent[] = [];
  for (let f = 0; f < frames && s.phase !== 'result'; f++) ev.push(...step(s, aiInputs(s, ai, cpu, level)));
  return ev;
}

describe('mapa de perigo', () => {
  it('marca o alcance da bomba com o tempo do pavio e deixa o resto seguro', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 50, 2);
    const d = dangerMap(s);
    expect(d[idx(7, 1)]).toBe(50);
    expect(d[idx(9, 1)]).toBe(50);
    expect(d[idx(7, 3)]).toBe(50);
    expect(d[idx(10, 1)]).toBe(SAFE);
    expect(d[idx(8, 2)]).toBe(SAFE);
  });
  it('chama atual = perigo 0', () => {
    const s = newRound({ clear: true });
    s.arena.flame[idx(4, 3)] = 10;
    expect(dangerMap(s)[idx(4, 3)]).toBe(0);
  });
  it('reação em cadeia antecipa a bomba atingida', () => {
    const s = newRound({ clear: true });
    addBomb(s, 5, 1, 10, 2);
    addBomb(s, 7, 1, 100, 2);
    const d = dangerMap(s);
    expect(d[idx(9, 1)]).toBe(10);
  });
  it('pilares e blocos param a chama como no jogo', () => {
    const s = newRound();                   // (3,1) é bloco destrutível
    addBomb(s, 2, 1, 40, 4);
    const d = dangerMap(s);
    expect(d[idx(3, 1)]).toBe(40);          // o bloco queima…
    expect(d[idx(4, 1)]).toBe(SAFE);        // …e segura o resto
    expect(d[idx(2, 2)]).toBe(SAFE);        // pilar
  });
  it('bomba hipotética entra no cálculo', () => {
    const s = newRound({ clear: true });
    const d = dangerMap(s, { gx: 5, gy: 5, range: 2, pierce: false });
    expect(d[idx(5, 7)]).toBeLessThan(SAFE);
    expect(d[idx(5, 8)]).toBe(SAFE);
  });
});

describe('comportamento', () => {
  it('pega um item próximo', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.arena.items[idx(3, 1)] = ITEM.FIRE;
    play(s, [true, false, false, false, false], 1, 120);
    expect(s.players[0].fire).toBe(1);
  });
  it('explode blocos e sobrevive às próprias bombas', () => {
    for (const level of [0, 1, 2]) {
      const s = newRound({ active: [true, true, false, false, false], seed: 3 });
      const soft0 = s.arena.cells.filter(c => c === CELL.SOFT).length;
      play(s, [true, false, false, false, false], level, 900);
      expect(s.players[0].alive, `nível ${level}`).toBe(true);
      expect(s.arena.cells.filter(c => c === CELL.SOFT).length, `nível ${level}`).toBeLessThan(soft0);
    }
  });
  it('foge de uma bomba colocada ao lado', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    place(s, 0, 5, 5);
    addBomb(s, 6, 5, 60, 3);
    play(s, [true, false, false, false, false], 2, 120);
    expect(s.players[0].alive).toBe(true);
  });
  it('partida só de CPUs termina, e nem sempre em empate', () => {
    let decided = 0;
    for (const seed of [1, 2, 3, 4]) {
      const s = createRound(1, { ...defaultRules(), timeIdx: 1 }, seed);  // 2:00
      for (let f = 0; f < INTRO_FRAMES; f++) step(s, [0, 0, 0, 0, 0]);
      play(s, [true, true, true, true, true], 1, 120 * 60 + 200);
      expect(s.phase, `seed ${seed}`).toBe('result');
      if (s.winners.length === 1) decided++;
    }
    expect(decided).toBeGreaterThan(0);
  });
  it('é determinística', () => {
    const run = () => {
      const s = createRound(1, { ...defaultRules(), timeIdx: 0 }, 9);
      for (let f = 0; f < INTRO_FRAMES; f++) step(s, [0, 0, 0, 0, 0]);
      play(s, [true, true, true, true, true], 2, 1500);
      return hashState(s);
    };
    expect(run()).toBe(run());
  });
});

describe('níveis', () => {
  it('Fraco reage mais devagar e erra mais que Forte', () => {
    expect(AI_LEVELS[0].react).toBeGreaterThan(AI_LEVELS[2].react);
    expect(AI_LEVELS[0].mistake).toBeGreaterThan(AI_LEVELS[2].mistake);
    expect(AI_LEVELS[0].hunt).toBe(false);
    expect(AI_LEVELS[2].hunt).toBe(true);
  });
  it('sorteio determinístico em 0..99', () => {
    expect(aiRoll(10, 2, 1)).toBe(aiRoll(10, 2, 1));
    const vals = new Set(Array.from({ length: 200 }, (_, f) => aiRoll(f, 0, 1)));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThan(100);
    expect(vals.size).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd web && npx vitest run tests/core/ai.test.ts` → FAIL (módulo inexistente)

- [ ] **Step 3: Criar** `web/src/core/ai.ts`:

```ts
import { BTN, CELL, DX, DY, ITEM, type Player, type RoundState } from './types';
import { FUSE_FRAMES, GRID_H, GRID_W, PRESSURE_INTERVAL, T } from './constants';
import { cellX, cellY, centerX, centerY, idx, inPlayfield } from './grid';
import { flameRange, speedSub } from './player';

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

/** Número pseudoaleatório 0..99 derivado só do estado (frame, slot, sal): mantém a IA determinística sem guardar RNG. */
export function aiRoll(frame: number, slot: number, salt: number): number {
  let h = Math.imul(frame + 0x9e3779b1, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35) ^ Math.imul(salt + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) % 100;
}

interface BombInfo { gx: number; gy: number; t: number; range: number; pierce: boolean }

/** Casas atingidas pela explosão de uma bomba (mesmas regras do core: HARD para; SOFT queima e para; item para). */
function blastCells(s: RoundState, b: BombInfo): number[] {
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
    if (b.carried || b.flight) continue;
    bombs.push({ gx: cellX(b.x), gy: cellY(b.y), t: Math.max(0, b.fuse), range: b.range, pierce: b.pierce });
  }
  if (extra) bombs.push({ ...extra, t: FUSE_FRAMES });

  // reação em cadeia: uma bomba no alcance de outra explode junto com ela
  const blasts = bombs.map(b => blastCells(s, b));
  for (let changed = true, guard = 0; changed && guard < bombs.length + 1; guard++) {
    changed = false;
    bombs.forEach((a, ia) => {
      bombs.forEach((b, ib) => {
        if (ia !== ib && b.t > a.t && blasts[ia].includes(idx(b.gx, b.gy))) { b.t = a.t; changed = true; }
      });
    });
  }
  bombs.forEach((b, k) => { for (const i of blasts[k]) danger[i] = Math.min(danger[i], b.t); });

  // blocos de pressão que estão para cair
  const pr = s.pressure;
  if (s.timeLeft >= 0 && s.timeLeft <= pr.startAt + PRESSURE_INTERVAL) {
    const every = pr.overtime ? 1 : PRESSURE_INTERVAL;
    let k = 0;
    for (let j = pr.next; j < pr.order.length && k < 12; j++) {
      const i = pr.order[j];
      if (s.arena.cells[i] === CELL.HARD) continue;
      danger[i] = Math.min(danger[i], Math.max(0, k * every - pr.timer));
      k++;
    }
  }
  return danger;
}

/** Casa andável para a IA: vazia, sem bomba (a não ser a de partida) e sem chama agora. */
function walkable(s: RoundState, i: number, start: number, danger: Int32Array): boolean {
  if (s.arena.cells[i] !== CELL.EMPTY) return false;
  if (danger[i] === 0) return false;
  if (i === start) return true;
  return !s.bombs.some(b => !b.carried && !b.flight && idx(cellX(b.x), cellY(b.y)) === i);
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
  const cells = blastCells(s, { gx, gy, t: 0, range: flameRange(p), pierce: p.pierce });
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
  if (p.x !== centerX(gx) || p.y !== centerY(gy)) {
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

/** Botões de direção para seguir o caminho: alinha no eixo perpendicular antes de virar. */
function steer(p: Player, brain: Brain): number {
  const gx = cellX(p.x), gy = cellY(p.y);
  while (brain.path.length && brain.path[0] === idx(gx, gy) && p.x === centerX(gx) && p.y === centerY(gy)) brain.path.shift();
  const target = brain.path[0] ?? idx(gx, gy);
  const tgx = target % GRID_W, tgy = Math.floor(target / GRID_W);
  const cx = centerX(gx), cy = centerY(gy);
  if (tgx !== gx) {
    if (p.y !== cy) return p.y < cy ? BTN.DOWN : BTN.UP;
    return tgx > gx ? BTN.RIGHT : BTN.LEFT;
  }
  if (tgy !== gy) {
    if (p.x !== cx) return p.x < cx ? BTN.RIGHT : BTN.LEFT;
    return tgy > gy ? BTN.DOWN : BTN.UP;
  }
  // chegou na casa-alvo: centraliza e para
  if (brain.path.length) brain.path.shift();
  if (p.x !== cx) return p.x < cx ? BTN.RIGHT : BTN.LEFT;
  if (p.y !== cy) return p.y < cy ? BTN.DOWN : BTN.UP;
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
    const buttons = 0;
    if (s.frame >= brain.nextThink) {
      think(s, p, level, brain);
      brain.nextThink = s.frame + level.react;
      // solta a bomba parado (neste quadro não anda) para ela cair exatamente na casa planejada
      if (brain.bomb) { out[p.slot] = BTN.A; continue; }
    }
    out[p.slot] = buttons | steer(p, brain);
  }
  return out;
}
```

- [ ] **Step 4: Substituir** `web/src/core/index.ts` por:

```ts
export * from './types';
export * from './constants';
export * from './grid';
export * from './rng';
export { LAYOUTS, STAGE_NAMES } from './layouts';
export { specialCells } from './arena';
export { createRound, step, ringCells, pressureOrder } from './round';
export { createMatch, startRound, finishRound, type MatchState } from './match';
export { hashState } from './hash';
export { speedSub, flameRange } from './player';
export { bombAt, blocksPlayer, blocksBomb, playerAt } from './query';
export { rollItem, applyItem } from './items';
export { AI_LEVELS, SAFE, createAi, aiInputs, dangerMap, aiRoll, type AiLevel, type AiState } from './ai';
```

- [ ] **Step 5: Verificar** — `cd web && npx vitest run && npx tsc --noEmit` → 212 testes PASS; tsc limpo

- [ ] **Step 6: Commit** — `git add web/src/core/ai.ts web/src/core/index.ts web/tests/core/ai.test.ts && git commit -m "feat(core): IA das CPUs (mapa de perigo, busca segura, fugir/itens/bombas/caçar; níveis fraco, normal e forte)"` (+ trailer)

---

### Task 2: CPUs jogando na sessão; partida rápida com CPUs

**Files:**
- Replace: `web/src/game/session.ts`, `web/src/game/config.ts`, `web/tests/client/session.test.ts`, `web/scripts/snapshots.mjs`

**Interfaces:**
- Consumes: `createAi`, `aiInputs`, `AiState` (Task 1)
- Produces:
  - `Session.ai: AiState`. No passo de batalha, os slots de CPU (`!humans[i] && active[i]`) recebem `aiInputs(round, ai, cpu, rules.cpuLevel)`, e os botões do controle de um slot de CPU são ignorados.
  - `parseConfig` aceita `humans=0..5` (quantos dos primeiros jogadores são humanos) e `level=0..2` (nível da CPU).
  - Screenshot `22-cpu-match` (partida só de CPUs).

- [ ] **Step 1: Substituir o teste** `web/tests/client/session.test.ts` por:

```ts
import { parseConfig } from '../../src/game/config';
import { createSession, updateSession, ROUND_OVER_FRAMES, SCOREBOARD_FRAMES, SKIP_AFTER, type Session } from '../../src/game/session';
import { BTN, INTRO_FRAMES } from '../../src/core';

const idle = [0, 0, 0, 0, 0];
const run = (s: Session, n: number, pads = idle) => { for (let i = 0; i < n; i++) updateSession(s, pads); };
const tap = (s: Session, slot: number, btn: number) => { const p = [0, 0, 0, 0, 0]; p[slot] = btn; updateSession(s, p); updateSession(s, idle); };
const winRound = (s: Session, winner: number) => {
  if (s.round.phase === 'intro') run(s, INTRO_FRAMES + 1);
  s.round.players.forEach((p, i) => { if (i !== winner) p.alive = false; });
  run(s, 1);
};

describe('parseConfig', () => {
  it('humans e level definem quem é CPU e o nível', () => {
    const c = parseConfig('?players=4&humans=1&level=2');
    expect(c.humans).toEqual([true, false, false, false, false]);
    expect(c.rules.active).toEqual([true, true, true, true, false]);
    expect(c.rules.cpuLevel).toBe(2);
    expect(parseConfig('').humans).toEqual([true, true, true, true, true]);
    expect(parseConfig('').rules.cpuLevel).toBe(1);
  });
  it('padrões', () => {
    const c = parseConfig('');
    expect(c.stage).toBe(1);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect([c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([3, 2, true, 'ffa']);
    expect(c.chars).toEqual([0, 1, 2, 3, 4]);
    expect(c.seed).toBeNull();
  });
  it('lê e limita os parâmetros', () => {
    const c = parseConfig('?stage=12&players=1&matches=9&time=4&chars=5,5,x&seed=42&mode=team&sd=1&racer=1&spawns=0');
    expect(c.stage).toBe(10);
    expect(c.rules.active).toEqual([true, true, false, false, false]);
    expect([c.rules.matches, c.rules.timeIdx]).toEqual([5, 4]);
    expect(c.chars).toEqual([5, 5, 2, 3, 4]);
    expect(c.seed).toBe(42);
    expect([c.rules.mode, c.rules.suddenDeath, c.rules.racer, c.rules.randomSpawns]).toEqual(['team', true, true, false]);
  });
});

describe('sessão', () => {
  it('começa em batalha com a rodada em intro', () => {
    const s = createSession(parseConfig(''), 1);
    expect(s.phase).toBe('battle');
    expect(s.round.phase).toBe('intro');
    run(s, INTRO_FRAMES + 1);
    expect(s.round.phase).toBe('playing');
  });
  it('fim de rodada → placar com coroa → próxima rodada', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.match.crowns[1]).toBe(1);
    expect(s.lastWinners).toEqual([1]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('battle');
    expect(s.match.roundNo).toBe(2);
  });
  it('placar só pode ser pulado depois de SKIP_AFTER frames', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES);
    run(s, 30); tap(s, 0, BTN.START);
    expect(s.phase).toBe('scoreboard');
    run(s, SKIP_AFTER); tap(s, 0, BTN.START);
    expect(s.phase).toBe('battle');
  });
  it('meta atingida → vitória → START encerra a partida (a tela que hospeda decide o que vem depois)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 0); run(s, ROUND_OVER_FRAMES); run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    expect(s.champions).toEqual([0]);
    tap(s, 0, BTN.START);
    expect(s.finished).toBe(false);
    run(s, SKIP_AFTER); tap(s, 1, BTN.A);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(false);
  });
  it('avisos de fim de rodada e de fim de partida (para áudio e webhook)', () => {
    const s = createSession(parseConfig('?players=2&matches=1'), 1);
    winRound(s, 1); run(s, ROUND_OVER_FRAMES);
    expect(s.notices).toEqual([
      { type: 'round_over', winners: [1], crowns: [0, 1, 0, 0, 0] },
      { type: 'match_over', champions: [1], crowns: [0, 1, 0, 0, 0] },
    ]);
  });
  it('na pausa, B pede confirmação; B de novo cancela; A confirma e sai da partida', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 5);
    tap(s, 0, BTN.B);
    expect(s.finished).toBe(false);
    expect(s.confirmQuit).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(true);
    expect(s.finished).toBe(false);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(false);
    expect(s.paused).toBe(true);
    tap(s, 1, BTN.B);
    expect(s.confirmQuit).toBe(true);
    tap(s, 0, BTN.A);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(true);
  });
  it('despausar limpa o pedido de confirmação', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 5);
    tap(s, 0, BTN.START);
    tap(s, 0, BTN.B);
    expect(s.confirmQuit).toBe(true);
    tap(s, 1, BTN.START);
    expect(s.paused).toBe(false);
    expect(s.confirmQuit).toBe(false);
  });
  it('sessão sem controle humano: pressedAny pausa e confirma a saída', () => {
    const cfg = parseConfig('?players=2');
    cfg.humans = [false, false, false, false, false];
    const s = createSession(cfg, 1);
    expect(s.anyControl).toBe(true);
    run(s, 5);
    updateSession(s, idle, BTN.START); updateSession(s, idle, 0);
    expect(s.paused).toBe(true);
    updateSession(s, idle, BTN.B); updateSession(s, idle, 0);
    expect(s.confirmQuit).toBe(true);
    updateSession(s, idle, BTN.A); updateSession(s, idle, 0);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(true);
  });
  it('sessão com humano: pressedAny sozinho não controla nada (só o próprio pad conta)', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    expect(s.anyControl).toBe(false);
    run(s, 5);
    updateSession(s, idle, BTN.START); updateSession(s, idle, 0);
    expect(s.paused).toBe(false);
  });
  it('vitória sem input humano: encerra sozinha depois de 900 frames quando anyControl', () => {
    const cfg = parseConfig('?players=2&matches=1');
    cfg.humans = [false, false, false, false, false];
    const s = createSession(cfg, 1);
    winRound(s, 0);
    run(s, ROUND_OVER_FRAMES);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
    run(s, 899);
    expect(s.finished).toBe(false);
    run(s, 2);
    expect(s.finished).toBe(true);
    expect(s.aborted).toBe(false);
  });
  it('slots de CPU não pausam e ignoram o controle: quem joga é a IA', () => {
    const mk = () => {
      const cfg = parseConfig('?players=3&seed=4');
      cfg.humans = [true, true, false, false, false];
      return createSession(cfg, 4);
    };
    const a = mk(), b = mk();
    run(a, INTRO_FRAMES + 1); run(b, INTRO_FRAMES + 1);
    tap(a, 2, BTN.START);
    run(b, 2);
    expect(a.paused).toBe(false);
    const noisy = [0, 0, BTN.A | BTN.DOWN | BTN.RIGHT, 0, 0];
    for (let i = 0; i < 60; i++) { updateSession(a, noisy); updateSession(b, idle); }
    const pos = (s: Session) => [s.round.players[2].x, s.round.players[2].y, s.round.bombs.filter(q => q.owner === 2).length];
    expect(pos(a)).toEqual(pos(b));
  });
  it('START pausa e retoma; slot inativo não pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    run(s, 10);
    tap(s, 4, BTN.START);
    expect(s.paused).toBe(false);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(true);
    const f = s.round.frame;
    run(s, 20);
    expect(s.round.frame).toBe(f);
    tap(s, 0, BTN.START);
    expect(s.paused).toBe(false);
  });
  it('START já pressionado ao abrir a partida (initialPads) não pausa no primeiro tick', () => {
    const pads = [BTN.START, 0, 0, 0, 0];
    const s = createSession(parseConfig('?players=2'), 1, pads);
    expect(s.prevPads).toEqual(pads);
    updateSession(s, pads);
    expect(s.paused).toBe(false);
  });
  it('modo time: time 0 vence → campeões são todos os slots do time 0', () => {
    const s = createSession(parseConfig('?players=5&mode=team&matches=1'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.players.forEach(p => { if (p.team !== 0) p.alive = false; });
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.champions).toEqual([0, 2, 4]);
    run(s, SCOREBOARD_FRAMES);
    expect(s.phase).toBe('victory');
  });
  it('empate por tempo esgotado: sem vencedor, sem coroa, ainda vai a placar', () => {
    const s = createSession(parseConfig('?players=2&matches=3'), 1);
    run(s, INTRO_FRAMES + 1);
    s.round.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('roundOver');
    run(s, ROUND_OVER_FRAMES);
    expect(s.phase).toBe('scoreboard');
    expect(s.lastWinners).toEqual([]);
    expect(s.match.crowns).toEqual([0, 0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `cd web && npx vitest run tests/client/session.test.ts` → FAIL (`humans`/`level` na URL; CPU agora é controlada pela IA)

- [ ] **Step 3: Substituir** `web/src/game/session.ts` por:

```ts
import { BTN, createMatch, startRound, finishRound, step, createAi, aiInputs, type AiState, type GameEvent, type MatchState, type RoundState } from '../core';
import type { GameConfig } from './config';

export const ROUND_OVER_FRAMES = 150;
export const SCOREBOARD_FRAMES = 540;   // ≈9 s, como o placar do original
export const SKIP_AFTER = 60;

export type SessionPhase = 'battle' | 'roundOver' | 'scoreboard' | 'victory';

/** Transições que interessam a quem está de fora (áudio, webhook). A fila é consumida por quem lê. */
export type SessionNotice =
  | { type: 'round_over'; winners: number[]; crowns: number[] }
  | { type: 'match_over'; champions: number[]; crowns: number[] };

/** Depois de quantos frames em vitória, sem ninguém controlando, a partida se encerra sozinha. */
export const AUTO_VICTORY_FRAMES = 900;

export interface Session {
  cfg: GameConfig; seed: number;
  match: MatchState; round: RoundState;
  phase: SessionPhase; timer: number; paused: boolean; matchOver: boolean;
  /** true só nos ticks em que `step()` do core de fato rodou (ver web/src/app/tick.ts). */
  stepped: boolean;
  /** A partida acabou (vitória confirmada) ou foi abandonada pela pausa; quem hospeda a sessão troca de tela. */
  finished: boolean;
  aborted: boolean;
  /** Enquanto pausado, aguardando confirmação (A: sai / B: cancela) do pedido de sair pela pausa. */
  confirmQuit: boolean;
  /** Nenhum slot humano tem um dispositivo de verdade (tudo CPU/desligado, ou humanos sem controle atribuído):
   *  pausar/sair/confirmar aceita entrada de qualquer dispositivo (`anyPressed`) em vez de só a do próprio slot. */
  anyControl: boolean;
  notices: SessionNotice[];
  /** Memória das CPUs (caminhos, próxima decisão). */
  ai: AiState;
  prevPads: number[]; lastWinners: number[]; champions: number[];
}

export function createSession(cfg: GameConfig, seed: number, initialPads: number[] = [0, 0, 0, 0, 0]): Session {
  const match = createMatch(cfg.rules, cfg.stage, seed);
  return {
    cfg, seed, match, round: startRound(match), phase: 'battle', timer: 0, paused: false, matchOver: false,
    stepped: false, finished: false, aborted: false, confirmQuit: false, anyControl: !cfg.humans.some(Boolean),
    notices: [], ai: createAi(), prevPads: [...initialPads], lastWinners: [], champions: [],
  };
}

/** Avança um tick (1/60 s). Devolve os eventos do core deste tick (vazio fora da batalha).
 *  `anyPressed`: apertados em qualquer dispositivo neste tick (só importa quando `anyControl`). */
export function updateSession(s: Session, pads: number[], anyPressed = 0): GameEvent[] {
  const pressed = pads.map((p, i) => p & ~(s.prevPads[i] ?? 0));
  s.prevPads = [...pads];
  s.stepped = false;
  if (s.finished) return [];
  // Só jogadores humanos pausam, pulam telas ou controlam personagens; as CPUs são controladas pela IA.
  // Sem ninguém no controle (anyControl), qualquer dispositivo serve para pausar/sair/confirmar.
  const hit = (mask: number) =>
    pressed.some((p, i) => s.cfg.humans[i] && (p & mask) !== 0) || (s.anyControl && (anyPressed & mask) !== 0);
  let ev: GameEvent[] = [];
  switch (s.phase) {
    case 'battle':
      if (hit(BTN.START)) {
        s.paused = !s.paused;
        if (!s.paused) s.confirmQuit = false;
      } else if (s.paused) {
        if (s.confirmQuit) {
          if (hit(BTN.A)) { s.finished = true; s.aborted = true; break; }
          if (hit(BTN.B)) s.confirmQuit = false;
        } else if (hit(BTN.B)) {
          s.confirmQuit = true;
        }
      }
      if (s.paused) break;
      {
        const cpu = s.cfg.humans.map((h, i) => !h && s.cfg.rules.active[i]);
        const ai = aiInputs(s.round, s.ai, cpu, s.cfg.rules.cpuLevel);
        ev = step(s.round, pads.map((p, i) => (s.cfg.humans[i] ? p : ai[i])));
      }
      s.stepped = true;
      if (s.round.phase === 'result') { s.phase = 'roundOver'; s.timer = ROUND_OVER_FRAMES; }
      break;
    case 'roundOver':
      if (--s.timer <= 0) {
        const r = finishRound(s.match, s.round);
        s.lastWinners = r.winners;
        s.champions = r.champions;
        s.matchOver = r.matchOver;
        s.notices.push({ type: 'round_over', winners: [...r.winners], crowns: [...s.match.crowns] });
        if (r.matchOver) s.notices.push({ type: 'match_over', champions: [...r.champions], crowns: [...s.match.crowns] });
        s.phase = 'scoreboard';
        s.timer = SCOREBOARD_FRAMES;
      }
      break;
    case 'scoreboard':
      s.timer--;
      if (s.timer <= 0 || (SCOREBOARD_FRAMES - s.timer > SKIP_AFTER && hit(BTN.START | BTN.A))) {
        if (s.matchOver) { s.phase = 'victory'; s.timer = 0; }
        else { s.round = startRound(s.match); s.phase = 'battle'; }
      }
      break;
    case 'victory':
      s.timer++;
      if (s.anyControl && s.timer > AUTO_VICTORY_FRAMES) s.finished = true;
      else if (s.timer > SKIP_AFTER && hit(BTN.START | BTN.A)) s.finished = true;
      break;
  }
  return ev;
}
```

- [ ] **Step 4: Substituir** `web/src/game/config.ts` por:

```ts
import { defaultRules, type Rules } from '../core';
import { CHARACTERS } from '../render/art/bomber';
import type { Setup, SlotKind } from '../app/settings';

export interface GameConfig {
  rules: Rules; stage: number; chars: number[]; seed: number | null;
  humans: boolean[];   // slots controlados por gente (CPU = false)
  names: string[];     // nomes dos jogadores ('' = usar P1..P5)
}

function int(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}

/** Nome para exibir: o nome configurado ou P1..P5. */
export function displayName(names: readonly string[], slot: number): string {
  const n = names[slot]?.trim();
  return n ? n : `P${slot + 1}`;
}

/**
 * Partida rápida pela URL (usada com ?quick e pelas screenshots):
 * ?stage=1..10&players=2..5&matches=1..5&time=0..4&mode=ffa|team&sd=1&racer=1&spawns=0&chars=0,1,2,3,4&seed=N
 *  &humans=0..5 (quantos dos primeiros jogadores são humanos; o resto é CPU — padrão: todos)
 *  &level=0..2 (nível da CPU: fraco, normal, forte — padrão: normal)
 */
export function parseConfig(search: string): GameConfig {
  const q = new URLSearchParams(search);
  const players = int(q.get('players'), 5, 2, 5);
  const active = [0, 1, 2, 3, 4].map(i => i < players);
  const rules: Rules = {
    ...defaultRules(),
    matches: int(q.get('matches'), 3, 1, 5),
    timeIdx: int(q.get('time'), 2, 0, 4),
    cpuLevel: int(q.get('level'), 1, 0, 2) as 0 | 1 | 2,
    suddenDeath: q.get('sd') === '1',
    racer: q.get('racer') === '1',
    randomSpawns: q.get('spawns') !== '0',
    mode: q.get('mode') === 'team' ? 'team' : 'ffa',
    teams: [0, 1, 0, 1, 0],
    active,
  };
  const raw = (q.get('chars') ?? '').split(',').map(s => Number.parseInt(s, 10));
  const chars = [0, 1, 2, 3, 4].map(i => (Number.isInteger(raw[i]) && raw[i] >= 0 && raw[i] < CHARACTERS.length ? raw[i] : i));
  return {
    rules, stage: int(q.get('stage'), 1, 1, 10), chars,
    seed: q.has('seed') ? int(q.get('seed'), 0, 0, 2 ** 31 - 1) : null,
    humans: active.map((a, i) => a && i < int(q.get('humans'), 5, 0, 5)), names: ['', '', '', '', ''],
  };
}

/** Regras da partida a partir das escolhas dos menus. */
export function configFromSetup(setup: Setup, names: readonly string[], seed: number | null = null): GameConfig {
  const rules: Rules = {
    ...defaultRules(), ...setup.rules,
    mode: setup.mode, teams: [...setup.teams], active: setup.slots.map(k => k !== 'off'),
  };
  return {
    rules, stage: setup.stage, chars: [...setup.chars], seed,
    humans: setup.slots.map(k => k === 'human'), names: [...names],
  };
}

/** Mensagem de erro se a formação não permite jogar; null se está tudo certo. */
export function validateSetup(mode: 'ffa' | 'team', slots: readonly SlotKind[], teams: readonly number[]): string | null {
  const on = [0, 1, 2, 3, 4].filter(i => slots[i] !== 'off');
  if (on.length < 2) return 'PRECISA DE 2 JOGADORES';
  if (mode === 'team' && new Set(on.map(i => teams[i])).size < 2) return 'CADA TIME PRECISA DE 1 JOGADOR';
  return null;
}
```

- [ ] **Step 5: Substituir** `web/scripts/snapshots.mjs` por:

```js
// Requer o Google Chrome instalado (playwright-core usa channel 'chrome', não baixa o Chromium).
// Abre o jogo no Chrome instalado, joga alguns frames e salva screenshots em web/snapshots/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}snapshots`;
mkdirSync(out, { recursive: true });
const PORT = 5188;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return; } catch { /* ainda subindo */ }
    await sleep(250);
  }
  throw new Error('vite não subiu');
}

let browser;
try {
  await waitServer();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 768, height: 672 } });
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const tap = async code => { await page.keyboard.down(code); await sleep(60); await page.keyboard.up(code); await sleep(60); };
  const hold = async (code, ms) => { await page.keyboard.down(code); await sleep(ms); await page.keyboard.up(code); };

  const base = `http://localhost:${PORT}/`;
  const waitScreen = id => page.waitForFunction(i => window.__crown.app.screen.id === i, id, { timeout: 15000 });

  // 1) Fluxo de menus (configurações zeradas: cada página abre com localStorage vazio)
  await page.goto(`${base}?debug=1`);
  await sleep(400); await shot('01-title');
  await tap('Enter'); await waitScreen('vs'); await shot('02-vs');
  await tap('Enter'); await waitScreen('mode'); await shot('03-mode');
  await tap('Enter'); await waitScreen('players'); await shot('04-players');
  await tap('Enter'); await waitScreen('rules'); await shot('05-rules');
  await tap('Enter'); await waitScreen('characters');
  await tap('KeyD'); await tap('ArrowDown'); await sleep(150); await shot('06-characters');
  await tap('KeyJ'); await tap('Numpad1'); await sleep(150); await shot('07-characters-ready');
  await tap('Enter'); await waitScreen('stage');
  await tap('KeyD'); await sleep(150); await shot('08-stage');
  await tap('Enter'); await sleep(200); await shot('09-battle-start');
  await waitScreen('battle'); await sleep(900); await shot('10-intro');

  // 2) Partida rápida (?quick): batalha, explosão, fim de rodada, placar, vitória e volta à fase
  await page.goto(`${base}?quick&seed=7&players=5&matches=1&spawns=0&debug=1`);
  await sleep(1700);
  await hold('KeyD', 250); await tap('KeyJ'); await hold('KeyA', 250); await hold('KeyS', 300);
  await sleep(300); await shot('11-battle');
  await page.waitForFunction(() => window.__crown.session.round.arena.flame.some(f => f > 20), null, { timeout: 5000 });
  await shot('12-explosion');
  await tap('Enter'); await sleep(150); await shot('13-pause');
  await tap('Enter');
  await page.evaluate(() => { window.__crown.session.round.players.forEach((p, i) => { if (i !== 2) p.alive = false; }); });
  await sleep(400); await shot('14-round-over');
  await page.waitForFunction(() => window.__crown.session?.phase === 'scoreboard', null, { timeout: 15000 });
  await sleep(300); await shot('15-scoreboard');
  await page.waitForFunction(() => window.__crown.session?.phase === 'victory', null, { timeout: 15000 });
  await sleep(1300); await shot('16-victory');
  await tap('Enter'); await waitScreen('stage'); await shot('17-back-to-stage');

  // 3) Configurações e nomes
  await page.goto(`${base}?debug=1`);
  await sleep(300); await tap('KeyS'); await tap('Enter'); await waitScreen('settings'); await shot('18-settings');
  for (let k = 0; k < 5; k++) await tap('KeyS');
  await tap('Enter'); await waitScreen('names');
  await tap('Enter'); for (let k = 0; k < 3; k++) await tap('KeyW');
  await sleep(100); await shot('19-name-edit');

  // 4) Partida só de CPUs (IA nível normal)
  await page.goto(`${base}?quick&seed=11&players=5&humans=0&level=1&debug=1`);
  await sleep(9000); await shot('22-cpu-match');

  // 5) Outras arenas
  for (const stage of [5, 8]) {
    await page.goto(`${base}?quick&seed=3&players=5&stage=${stage}&debug=1`);
    await sleep(2000);
    await shot(stage === 5 ? '20-stage5' : '21-stage8');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    server.kill();
  }
}
console.log(`screenshots em ${out}`);
```

- [ ] **Step 6: Verificar**

Run: `cd web && npx vitest run && npx tsc --noEmit && npx vite build && npm run snap`
Expected: 213 testes PASS; tsc limpo; build ok; 22 PNGs. Abra `22-cpu-match.png` e descreva no relatório: a arena deve ter bombas, blocos já destruídos e CPUs espalhadas.

- [ ] **Step 7: Commit** — `git add web/src/game/session.ts web/src/game/config.ts web/tests/client/session.test.ts web/scripts/snapshots.mjs && git commit -m "feat(client): CPUs controladas pela IA; ?quick aceita humans= e level="` (+ trailer)

---

## Próximos planos
- **Plano 5, torneio:**
  - webhook Crown Cup a partir do `match_over`, com URL e segredo em CONFIGURAÇÕES, retry e fila offline;
  - canal de avisos da sessão (`notices`), com `match_start`/`match_aborted`;
  - remapear gamepad e checar `gp.mapping`;
  - pausar quando um controle desconecta.
- **Plano 6, som:** SFX pelos eventos do core e músicas chiptune, com volume em CONFIGURAÇÕES.
- **Plano 7, arenas e regras:**
  - mecânicas das fases 2, 3, 6, 7, 8 e 9;
  - Bomber Vingador;
  - IA usando chute, soco e luva no nível Forte;
  - poses de morte e de vitória.
