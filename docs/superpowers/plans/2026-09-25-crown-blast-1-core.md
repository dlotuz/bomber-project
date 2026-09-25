# Crown Blast: Plano 1, Núcleo de simulação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `web/src/core/`, a simulação determinística do Battle Mode (arena, movimento, bombas, explosões, itens, habilidades, rodada, pressão, partida), com todos os números medidos no SB4 e cobertura de testes Vitest.

**Architecture:** TypeScript puro, sem DOM. O núcleo avança por `step(state, inputs[5]) → GameEvent[]` a 60 ticks/s, com estado mutável, RNG com seed guardado no estado e só aritmética inteira (posições em subpixels de 1/8 px). Telas, render, áudio, IA e rede ficam para os Planos 2 e 3 e só consomem este núcleo.

**Tech Stack:** TypeScript 5, Vite, Vitest. Node ≥ 18.

**Spec:** `docs/superpowers/specs/2026-09-25-crown-blast-web-design.md`

## Global Constraints

- Tick fixo de **60 Hz**; todo tempo em **frames**.
- `core/` **não** usa `Math.random`, `Date`, DOM nem importa `render/`, `audio/`, `input/` ou `net/`.
- Aleatoriedade só pelo RNG do estado (`src/core/rng.ts`).
- Posições em **subpixels (1 px = 8)**. Centro da casa: `X = 16·(gx+1)` px, `Y = 16·(gy+2)` px. Área jogável gx 1–13, gy 1–11. Grid total de 15×13 com borda HARD.
- Constantes medidas: pavio **128**, chama **33**, morte **78**, alcance **fogo+2**, velocidade **8 + (nível−1) subpx/frame**, intro **90**.
- Spawns P1..P5 (grid): `(1,1) (13,11) (13,1) (1,11) (7,6)`.
- Arte, textos e nomes originais; nada da Hudson/Konami.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de arquivos

```
web/package.json, web/tsconfig.json, web/vite.config.ts
web/src/core/
  rng.ts        RNG mulberry32 com seed (estado serializável)
  constants.ts  números do jogo
  types.ts      tipos + enums (CELL, ITEM, DISEASE, DIR, BTN) + defaultRules
  grid.ts       conversão casa↔subpixel, idx, inPlayfield
  layouts.ts    10 layouts 13×11 + nomes das fases
  items.ts      pesos, sorteio, efeitos
  arena.ts      construção da arena, tick de chamas/queima
  query.ts      bombAt, playerAt, blocksPlayer, blocksBomb
  player.ts     movimento, correção de canto, ações (bomba, soco, luva, chute)
  bombs.ts      fuse, deslizar, voo, explosão em cadeia
  round.ts      createRound, step, relógio, pressão, fim de rodada
  match.ts      coroas, meta, sementes por rodada
  hash.ts       hash do estado (teste de determinismo)
  index.ts      API pública
web/tests/core/*.test.ts + helpers.ts
```

---

### Task 1: Scaffold + RNG

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/src/core/rng.ts`
- Test: `web/tests/core/rng.test.ts`

**Interfaces:**
- Produces: `interface Rng { s: number }`, `makeRng(seed:number): Rng`, `nextU32(r:Rng): number`, `randInt(r:Rng, n:number): number`, `shuffle<T>(r:Rng, a:T[]): T[]`

- [ ] **Step 1: Criar o projeto**

```bash
mkdir -p web/src/core web/tests/core && cd web
cat > package.json <<'EOF'
{
  "name": "crown-blast",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
EOF
npm install -D typescript vite vitest
```

`web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

`web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { globals: true, include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 2: Escrever o teste que falha**

`web/tests/core/rng.test.ts`:
```ts
import { makeRng, nextU32, randInt, shuffle } from '../../src/core/rng';

describe('rng', () => {
  it('mesma seed gera a mesma sequência', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(nextU32(a)).toBe(nextU32(b));
  });
  it('seeds diferentes divergem', () => {
    const a = makeRng(1), b = makeRng(2);
    expect(nextU32(a)).not.toBe(nextU32(b));
  });
  it('randInt fica em [0,n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) { const v = randInt(r, 5); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); }
  });
  it('shuffle devolve uma permutação', () => {
    const r = makeRng(3);
    const out = shuffle(r, [0, 1, 2, 3, 4]);
    expect([...out].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('o estado é serializável e retomável', () => {
    const a = makeRng(9); nextU32(a);
    const b = JSON.parse(JSON.stringify(a));
    expect(nextU32(a)).toBe(nextU32(b));
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/rng.test.ts`
Expected: FAIL (módulo `rng` não existe)

- [ ] **Step 4: Implementar**

`web/src/core/rng.ts`:
```ts
export interface Rng { s: number }

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** mulberry32: rápido, 32 bits, estado em um número. */
export function nextU32(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

export function randInt(r: Rng, n: number): number {
  return nextU32(r) % n;
}

export function shuffle<T>(r: Rng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(r, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core/rng.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/tsconfig.json web/vite.config.ts web/src/core/rng.ts web/tests/core/rng.test.ts
git commit -m "feat(core): scaffold do projeto web e RNG determinístico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tipos, constantes, grid, layouts, itens e criação da rodada

**Files:**
- Create: `web/src/core/constants.ts`, `types.ts`, `grid.ts`, `layouts.ts`, `items.ts`, `arena.ts`, `round.ts`
- Test: `web/tests/core/setup.test.ts`

**Interfaces:**
- Consumes: `Rng`, `makeRng`, `randInt`, `shuffle` (Task 1)
- Produces:
  - `CELL {EMPTY:0,HARD:1,SOFT:2}`, `ITEM {NONE:0,BOMB:1,FIRE:2,SPEED:3,KICK:4,SKULL:5,PUNCH:6,GLOVE:7,PIERCE:8}`, `DISEASE {NONE:0,SLOW:1,FAST:2,DIARRHEA:3,LOW_FIRE:4}`, `DIR {NONE:0,UP:1,DOWN:2,LEFT:3,RIGHT:4}`, `DX`, `DY`, `BTN {UP:1,DOWN:2,LEFT:4,RIGHT:8,A:16,B:32,Y:64,START:128}`
  - `Rules`, `Player`, `Bomb`, `Flight`, `Arena`, `Pressure`, `RoundState`, `GameEvent`, `Phase`, `defaultRules()`
  - `idx(gx,gy)`, `centerX(gx)`, `centerY(gy)`, `cellX(x)`, `cellY(y)`, `inPlayfield(gx,gy)`
  - `LAYOUTS: string[][]`, `STAGE_NAMES: string[]`
  - `ITEM_WEIGHTS`, `rollItem(rng)`, `applyItem(p, item, rng)`
  - `buildArena(stage, rng): Arena`, `specialCells(stage): [number,number][]`
  - `createRound(stage, rules, seed): RoundState`, `makePlayers(stage, rules, rng): Player[]`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/setup.test.ts`:
```ts
import { createRound } from '../../src/core/round';
import { defaultRules, CELL } from '../../src/core/types';
import { idx, centerX, centerY, cellX, cellY } from '../../src/core/grid';
import { LAYOUTS } from '../../src/core/layouts';
import { SPAWNS } from '../../src/core/constants';
import { rollItem, ITEM_WEIGHTS } from '../../src/core/items';
import { makeRng } from '../../src/core/rng';

const rules = (o = {}) => ({ ...defaultRules(), randomSpawns: false, ...o });
const count = (s: ReturnType<typeof createRound>, c: number) => s.arena.cells.filter(v => v === c).length;

describe('grid', () => {
  it('centro de casa em pixels bate com o SB4', () => {
    expect(centerX(1) / 8).toBe(32); expect(centerY(1) / 8).toBe(48);
    expect(centerX(13) / 8).toBe(224); expect(centerY(11) / 8).toBe(208);
    expect(centerX(7) / 8).toBe(128); expect(centerY(6) / 8).toBe(128);
  });
  it('cellX/cellY invertem o centro e arredondam', () => {
    for (let g = 1; g <= 13; g++) expect(cellX(centerX(g))).toBe(g);
    for (let g = 1; g <= 11; g++) expect(cellY(centerY(g))).toBe(g);
    expect(cellX(centerX(2) - 64)).toBe(2);
    expect(cellX(centerX(2) - 65)).toBe(1);
  });
});

describe('arena', () => {
  it('10 layouts de 11 linhas × 13 colunas', () => {
    expect(LAYOUTS).toHaveLength(10);
    for (const l of LAYOUTS) { expect(l).toHaveLength(11); for (const r of l) expect(r).toHaveLength(13); }
  });
  it('contagem de soft blocks igual ao original', () => {
    const exp = [80, 80, 80, 70, 0, 80, 62, 0, 78, 80];
    exp.forEach((n, i) => expect(count(createRound(i + 1, rules(), 1), CELL.SOFT)).toBe(n));
  });
  it('borda é HARD e pilares (par,par) são HARD', () => {
    const s = createRound(1, rules(), 1);
    for (let x = 0; x < 15; x++) { expect(s.arena.cells[idx(x, 0)]).toBe(CELL.HARD); expect(s.arena.cells[idx(x, 12)]).toBe(CELL.HARD); }
    for (let y = 2; y <= 10; y += 2) for (let x = 2; x <= 12; x += 2) expect(s.arena.cells[idx(x, y)]).toBe(CELL.HARD);
  });
  it('casas de spawn são livres em todas as fases', () => {
    for (let st = 1; st <= 10; st++) {
      const s = createRound(st, rules(), 1);
      for (const [gx, gy] of SPAWNS) expect(s.arena.cells[idx(gx, gy)]).toBe(CELL.EMPTY);
    }
  });
  it('itens escondidos só sob soft blocks', () => {
    const s = createRound(1, rules(), 5);
    s.arena.hidden.forEach((it, i) => { if (it) expect(s.arena.cells[i]).toBe(CELL.SOFT); });
    expect(s.arena.hidden.filter(Boolean).length).toBeGreaterThan(10);
  });
});

describe('jogadores', () => {
  it('spawns padrão e status iniciais', () => {
    const s = createRound(1, rules(), 1);
    s.players.forEach((p, i) => {
      expect([cellX(p.x), cellY(p.y)]).toEqual(SPAWNS[i]);
      expect([p.speed, p.maxBombs, p.fire]).toEqual([1, 1, 0]);
    });
  });
  it('fase 5 começa forte', () => {
    const p = createRound(5, rules(), 1).players[0];
    expect([p.maxBombs, p.fire, p.kick, p.punch, p.glove, p.pierce]).toEqual([5, 4, true, true, true, true]);
  });
  it('racer começa com velocidade 4', () => {
    expect(createRound(1, rules({ racer: true }), 1).players[0].speed).toBe(4);
  });
  it('spawns aleatórios são uma permutação dos 5 pontos', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const s = createRound(1, rules({ randomSpawns: true }), seed);
      const pos = s.players.map(p => `${cellX(p.x)},${cellY(p.y)}`);
      expect(new Set(pos)).toEqual(new Set(SPAWNS.map(([x, y]) => `${x},${y}`)));
      seen.add(pos.join('|'));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('itens', () => {
  it('pesos somam 100 e rollItem respeita a tabela', () => {
    expect(ITEM_WEIGHTS.reduce((a, [, w]) => a + w, 0)).toBe(100);
    const r = makeRng(1);
    for (let i = 0; i < 500; i++) expect(rollItem(r)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/setup.test.ts`
Expected: FAIL (módulos inexistentes)

- [ ] **Step 3: Implementar `constants.ts`**

```ts
export const SUB = 8;                 // subpixels por pixel
export const TILE = 16;               // px
export const T = TILE * SUB;          // 128 subpx por casa
export const GRID_W = 15;
export const GRID_H = 13;
export const FUSE_FRAMES = 128;
export const FLAME_FRAMES = 33;
export const DEATH_FRAMES = 78;
export const INTRO_FRAMES = 90;
export const BASE_SPEED_SUB = 8;      // nível 1 = 1 px/frame
export const MAX_BOMBS = 8;
export const MAX_FIRE = 8;
export const MAX_SPEED = 5;
export const CORNER_SUB = 6 * SUB;
export const MOVE_BOMB_SUB = 2 * SUB; // chute e voo: 2 px/frame
export const FLY_CELLS = 3;
export const ITEM_CHANCE_PCT = 40;
export const DISEASE_FRAMES = 600;
export const PRESSURE_START_FRAMES = 60 * 60;
export const PRESSURE_INTERVAL = 6;
export const PRESSURE_RINGS = 2;
export const TIME_OPTIONS_FRAMES = [60 * 60, 120 * 60, 180 * 60, 300 * 60, -1];
export const SPAWNS: ReadonlyArray<readonly [number, number]> = [[1, 1], [13, 11], [13, 1], [1, 11], [7, 6]];
```

- [ ] **Step 4: Implementar `types.ts`**

```ts
import type { Rng } from './rng';

export const CELL = { EMPTY: 0, HARD: 1, SOFT: 2 } as const;
export const ITEM = { NONE: 0, BOMB: 1, FIRE: 2, SPEED: 3, KICK: 4, SKULL: 5, PUNCH: 6, GLOVE: 7, PIERCE: 8 } as const;
export const DISEASE = { NONE: 0, SLOW: 1, FAST: 2, DIARRHEA: 3, LOW_FIRE: 4 } as const;
export const DIR = { NONE: 0, UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4 } as const;
export const DX = [0, 0, 0, -1, 1];
export const DY = [0, -1, 1, 0, 0];
export const BTN = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, A: 16, B: 32, Y: 64, START: 128 } as const;

export interface Rules {
  cpuLevel: 0 | 1 | 2;
  matches: number;          // 1..5
  timeIdx: number;          // índice em TIME_OPTIONS_FRAMES
  suddenDeath: boolean;
  badBomber: boolean;
  racer: boolean;
  randomSpawns: boolean;
  mode: 'ffa' | 'team';
  teams: number[];          // time de cada slot (0/1)
  active: boolean[];        // slot participa?
}

export interface Player {
  slot: number; active: boolean; team: number;
  x: number; y: number; facing: number;
  speed: number; maxBombs: number; fire: number;
  kick: boolean; punch: boolean; glove: boolean; pierce: boolean;
  disease: number; diseaseTimer: number;
  alive: boolean; dying: number;
  prevButtons: number; carrying: number; // id da bomba carregada ou -1
}

export interface Flight { dx: number; dy: number; cellsLeft: number; progress: number }

export interface Bomb {
  id: number; owner: number; x: number; y: number;
  fuse: number; range: number; pierce: boolean;
  passers: number[];        // slots que ainda podem atravessar
  slide: number;            // DIR do chute ou NONE
  flight: Flight | null;
  carried: boolean;
}

export interface Arena {
  cells: number[]; items: number[]; hidden: number[];
  flame: number[]; burning: number[];
}

export interface Pressure { order: number[]; next: number; timer: number; overtime: boolean }

export type Phase = 'intro' | 'playing' | 'result';

export interface RoundState {
  rng: Rng; frame: number; phase: Phase; introLeft: number;
  timeLeft: number;         // frames; -1 = infinito
  stage: number; rules: Rules;
  players: Player[]; bombs: Bomb[]; nextBombId: number;
  arena: Arena; pressure: Pressure; winners: number[];
}

export type GameEvent =
  | { type: 'bomb_placed'; slot: number; gx: number; gy: number }
  | { type: 'explosion'; gx: number; gy: number }
  | { type: 'block_destroyed'; gx: number; gy: number }
  | { type: 'player_hit'; slot: number }
  | { type: 'player_out'; slot: number }
  | { type: 'item_picked'; slot: number; item: number }
  | { type: 'bomb_kicked'; slot: number }
  | { type: 'bomb_punched'; slot: number }
  | { type: 'bomb_thrown'; slot: number }
  | { type: 'pressure_block'; gx: number; gy: number }
  | { type: 'round_end'; winners: number[] };

export function defaultRules(): Rules {
  return {
    cpuLevel: 1, matches: 3, timeIdx: 2, suddenDeath: false, badBomber: false, racer: false,
    randomSpawns: true, mode: 'ffa', teams: [0, 1, 0, 1, 0], active: [true, true, true, true, true],
  };
}
```

- [ ] **Step 5: Implementar `grid.ts`**

```ts
import { GRID_W, GRID_H, T } from './constants';

export const idx = (gx: number, gy: number): number => gy * GRID_W + gx;
export const centerX = (gx: number): number => (gx + 1) * T;
export const centerY = (gy: number): number => (gy + 2) * T;
export const cellX = (x: number): number => Math.floor((x + T / 2) / T) - 1;
export const cellY = (y: number): number => Math.floor((y + T / 2) / T) - 2;
export const inPlayfield = (gx: number, gy: number): boolean =>
  gx >= 1 && gx <= GRID_W - 2 && gy >= 1 && gy <= GRID_H - 2;
```

- [ ] **Step 6: Implementar `layouts.ts`** (copiado de `analise/layouts_arenas.txt`; `?` = casa especial, tratada como vazia até o Plano 3)

```ts
export const STAGE_NAMES = [
  'O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
  'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria',
];

const BASE = [
  '..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xxx.xxxxxxxxx', '.#x#x#x#x#x#x', '.xxxx...xxx.x', 'x#.#x#.#x#x#x',
  'xxxxx...x.xxx', 'x#x#x#x#x#x#x', '.x.xxxxxxxxxx', '.#x#.#x#.#.#.', '..xxxxxxxxx..',
];

export const LAYOUTS: string[][] = [
  BASE,
  BASE,
  ['..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xxx.xxxxxxxxx', 'x#x#x#x#x#x#x', '.xxx?...xxxxx', 'x#.#x#.#x#x#x',
   'xxxxx...?.xxx', 'x#x#x#x#x#x#x', '.x.xxxxxxxxxx', '.#x#.#x#.#.#.', '..xxxxxxxxx..'],
  ['..xxx###xxx..', '.#x#.###x#x#.', 'xxx.xxxxxxxxx', 'x#x#x#x#x#x#x', '####x...x####', '####x#.#x####',
   'xxxxx...x.xxx', 'x#x#x#x#x#x#x', 'xxxxxxxxxxxxx', '.#x#.###x#x#.', '..xxx###xxx..'],
  ['.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.',
   '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............'],
  BASE,
  ['..xxxx.xxxx..', '.#x#.#.#x#x#.', 'xx?.x...xx?xx', 'x#x#x#.#x#x#x', 'x...x...x...x', 'x#.#x#.#x#.#x',
   'x...x...x...x', 'x#x#x#.#x#x#x', 'xx?xx...xx?xx', '.#x#.#.#x#x#.', '..xxxxxxxxx..'],
  ['.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.',
   '..?...?...?..', '.#.#.#.#.#.#.', '.............', '.#.#.#.#.#.#.', '.............'],
  ['..xxxx.xxxx..', '.#x#x#x#x#x#.', 'xx...xxx...xx', 'x#x#x#x#x#x#x', 'xxxxx...xxxxx', 'x#.#x#.#x#x#x',
   'xxxxx...x.xxx', 'x#x#x#x#x#x#x', 'xx...xxx...xx', '.#x#.#x#x#x#.', '..xxxxxxxxx..'],
  BASE,
];
```

- [ ] **Step 7: Implementar `items.ts`**

```ts
import { ITEM, type Player } from './types';
import { randInt, type Rng } from './rng';
import { MAX_BOMBS, MAX_FIRE, MAX_SPEED, DISEASE_FRAMES } from './constants';

export const ITEM_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [ITEM.BOMB, 28], [ITEM.FIRE, 20], [ITEM.SPEED, 12], [ITEM.KICK, 10],
  [ITEM.SKULL, 9], [ITEM.PUNCH, 7], [ITEM.GLOVE, 7], [ITEM.PIERCE, 7],
];

export function rollItem(rng: Rng): number {
  let r = randInt(rng, 100);
  for (const [it, w] of ITEM_WEIGHTS) { if (r < w) return it; r -= w; }
  return ITEM.BOMB;
}

export function applyItem(p: Player, item: number, rng: Rng): void {
  switch (item) {
    case ITEM.BOMB: p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1); break;
    case ITEM.FIRE: p.fire = Math.min(MAX_FIRE, p.fire + 1); break;
    case ITEM.SPEED: p.speed = Math.min(MAX_SPEED, p.speed + 1); break;
    case ITEM.KICK: p.kick = true; break;
    case ITEM.PUNCH: p.punch = true; break;
    case ITEM.GLOVE: p.glove = true; break;
    case ITEM.PIERCE: p.pierce = true; break;
    case ITEM.SKULL: p.disease = 1 + randInt(rng, 4); p.diseaseTimer = DISEASE_FRAMES; break;
  }
}
```

- [ ] **Step 8: Implementar `arena.ts`**

```ts
import { CELL, ITEM, type Arena } from './types';
import { GRID_W, GRID_H, ITEM_CHANCE_PCT } from './constants';
import { idx } from './grid';
import { LAYOUTS } from './layouts';
import { rollItem } from './items';
import { randInt, type Rng } from './rng';

export function buildArena(stage: number, rng: Rng): Arena {
  const n = GRID_W * GRID_H;
  const a: Arena = {
    cells: new Array(n).fill(CELL.HARD), items: new Array(n).fill(ITEM.NONE),
    hidden: new Array(n).fill(ITEM.NONE), flame: new Array(n).fill(0), burning: new Array(n).fill(0),
  };
  const rows = LAYOUTS[stage - 1];
  for (let r = 0; r < 11; r++) for (let c = 0; c < 13; c++) {
    const ch = rows[r][c];
    const i = idx(c + 1, r + 1);
    a.cells[i] = ch === '#' ? CELL.HARD : ch === 'x' ? CELL.SOFT : CELL.EMPTY;
    if (ch === 'x' && randInt(rng, 100) < ITEM_CHANCE_PCT) a.hidden[i] = rollItem(rng);
  }
  return a;
}

export function specialCells(stage: number): [number, number][] {
  const out: [number, number][] = [];
  LAYOUTS[stage - 1].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '?') out.push([c + 1, r + 1]); }));
  return out;
}
```

- [ ] **Step 9: Implementar `round.ts` (só criação por enquanto)**

```ts
import { DIR, type Player, type RoundState, type Rules } from './types';
import { INTRO_FRAMES, SPAWNS, TIME_OPTIONS_FRAMES } from './constants';
import { centerX, centerY } from './grid';
import { buildArena } from './arena';
import { makeRng, shuffle, type Rng } from './rng';

export function makePlayers(stage: number, rules: Rules, rng: Rng): Player[] {
  const order = [0, 1, 2, 3, 4];
  if (rules.randomSpawns) shuffle(rng, order);
  return order.map((spawn, slot) => {
    const [gx, gy] = SPAWNS[spawn];
    const p: Player = {
      slot, active: rules.active[slot], team: rules.teams[slot],
      x: centerX(gx), y: centerY(gy), facing: DIR.DOWN,
      speed: rules.racer ? 4 : 1, maxBombs: 1, fire: 0,
      kick: false, punch: false, glove: false, pierce: false,
      disease: 0, diseaseTimer: 0, alive: rules.active[slot], dying: 0,
      prevButtons: 0, carrying: -1,
    };
    if (stage === 5) { p.maxBombs = 5; p.fire = 4; p.kick = p.punch = p.glove = p.pierce = true; }
    return p;
  });
}

export function createRound(stage: number, rules: Rules, seed: number): RoundState {
  const rng = makeRng(seed);
  const arena = buildArena(stage, rng);
  const players = makePlayers(stage, rules, rng);
  return {
    rng, frame: 0, phase: 'intro', introLeft: INTRO_FRAMES,
    timeLeft: TIME_OPTIONS_FRAMES[rules.timeIdx], stage, rules,
    players, bombs: [], nextBombId: 1, arena,
    pressure: { order: [], next: 0, timer: 0, overtime: false }, winners: [],
  };
}
```

- [ ] **Step 10: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core/setup.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add web/src/core web/tests/core/setup.test.ts
git commit -m "feat(core): tipos, grid, 10 layouts, itens e criação da rodada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Movimento, colisão, correção de canto e `step()`

**Files:**
- Create: `web/src/core/query.ts`, `web/src/core/player.ts`, `web/tests/core/helpers.ts`
- Modify: `web/src/core/round.ts` (adicionar `step`)
- Test: `web/tests/core/movement.test.ts`

**Interfaces:**
- Consumes: tudo da Task 2
- Produces:
  - `bombAt(s,gx,gy): Bomb|undefined`, `playerAt(s,gx,gy): boolean`, `blocksPlayer(s,gx,gy,slot): boolean`, `blocksBomb(s,gx,gy): boolean`
  - `speedSub(p): number`, `flameRange(p): number`, `movePlayer(s,p,dir,ev): void`, `steerPlayer(s,p,buttons,ev): void`
  - `step(s: RoundState, inputs: number[]): GameEvent[]`
  - helpers de teste: `newRound`, `run`, `input`, `clearSoft`, `addBomb`, `place`

- [ ] **Step 1: Escrever os helpers e o teste que falha**

`web/tests/core/helpers.ts`:
```ts
import { createRound, step } from '../../src/core/round';
import { defaultRules, CELL, type Rules, type RoundState, type Bomb, type GameEvent } from '../../src/core/types';
import { centerX, centerY } from '../../src/core/grid';

export function newRound(opts: Partial<Rules> & { stage?: number; seed?: number; clear?: boolean } = {}): RoundState {
  const { stage = 1, seed = 1, clear = false, ...r } = opts;
  const s = createRound(stage, { ...defaultRules(), randomSpawns: false, ...r }, seed);
  if (clear) clearSoft(s);
  while (s.phase === 'intro') step(s, [0, 0, 0, 0, 0]);
  return s;
}

export function run(s: RoundState, n: number, inputs: number[] = [0, 0, 0, 0, 0]): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < n; i++) ev.push(...step(s, inputs));
  return ev;
}

export function input(slot: number, bits: number): number[] {
  const a = [0, 0, 0, 0, 0]; a[slot] = bits; return a;
}

export function clearSoft(s: RoundState): void {
  s.arena.cells = s.arena.cells.map(c => (c === CELL.SOFT ? CELL.EMPTY : c));
  s.arena.hidden.fill(0);
}

export function place(s: RoundState, slot: number, gx: number, gy: number): void {
  s.players[slot].x = centerX(gx); s.players[slot].y = centerY(gy);
}

export function addBomb(s: RoundState, gx: number, gy: number, fuse = 999, range = 2, owner = 4, passers: number[] = []): Bomb {
  const b: Bomb = { id: s.nextBombId++, owner, x: centerX(gx), y: centerY(gy), fuse, range, pierce: false,
    passers, slide: 0, flight: null, carried: false };
  s.bombs.push(b);
  return b;
}
```

`web/tests/core/movement.test.ts`:
```ts
import { newRound, run, input, place } from './helpers';
import { BTN } from '../../src/core/types';
import { centerX, centerY } from '../../src/core/grid';
import { step } from '../../src/core/round';
import { createRound } from '../../src/core/round';
import { defaultRules } from '../../src/core/types';

describe('intro', () => {
  it('90 frames de intro ignoram inputs', () => {
    const s = createRound(1, { ...defaultRules(), randomSpawns: false }, 1);
    const x0 = s.players[0].x;
    for (let i = 0; i < 89; i++) step(s, input(0, BTN.RIGHT));
    expect(s.phase).toBe('intro');
    step(s, input(0, BTN.RIGHT));
    expect(s.phase).toBe('playing');
    expect(s.players[0].x).toBe(x0);
  });
});

describe('movimento', () => {
  it('velocidade nível 1 = 60 px em 60 frames', () => {
    const s = newRound({ clear: true });
    const x0 = s.players[0].x;
    run(s, 60, input(0, BTN.RIGHT));
    expect((s.players[0].x - x0) / 8).toBe(60);
  });
  it('velocidade nível 5 = 90 px em 60 frames', () => {
    const s = newRound({ clear: true });
    s.players[0].speed = 5;
    const x0 = s.players[0].x;
    run(s, 60, input(0, BTN.RIGHT));
    expect((s.players[0].x - x0) / 8).toBe(90);
  });
  it('pilar bloqueia', () => {
    const s = newRound({ clear: true });
    place(s, 0, 1, 2);
    run(s, 10, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1));
  });
  it('para no centro da casa antes de um bloco', () => {
    const s = newRound();                    // fase 1 sem limpar: (3,1) é soft
    run(s, 40, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(2));
  });
  it('correção de canto: desalinhado 4 px desliza até alinhar e depois anda', () => {
    const s = newRound({ clear: true });
    s.players[0].y = centerY(1) + 32;
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].y).toBe(centerY(1) + 24);
    expect(s.players[0].x).toBe(centerX(1));
    run(s, 3, input(0, BTN.RIGHT));
    expect(s.players[0].y).toBe(centerY(1));
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1) + 8);
  });
  it('sem correção além de 6 px', () => {
    const s = newRound({ clear: true });
    s.players[0].y = centerY(1) + 56;
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1));
    expect(s.players[0].y).toBe(centerY(1) + 56);
  });
  it('diagonal: se o primeiro eixo está bloqueado, usa o outro', () => {
    const s = newRound({ clear: true });
    run(s, 5, input(0, BTN.UP | BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1) + 40);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/movement.test.ts`
Expected: FAIL (`step` não exportado)

- [ ] **Step 3: Implementar `query.ts`**

```ts
import { CELL, ITEM, type Bomb, type RoundState } from './types';
import { cellX, cellY, idx, inPlayfield } from './grid';

export function bombAt(s: RoundState, gx: number, gy: number): Bomb | undefined {
  return s.bombs.find(b => !b.carried && !b.flight && cellX(b.x) === gx && cellY(b.y) === gy);
}

export function playerAt(s: RoundState, gx: number, gy: number): boolean {
  return s.players.some(p => p.active && p.alive && p.dying === 0 && cellX(p.x) === gx && cellY(p.y) === gy);
}

export function blocksPlayer(s: RoundState, gx: number, gy: number, slot: number): boolean {
  if (!inPlayfield(gx, gy)) return true;
  if (s.arena.cells[idx(gx, gy)] !== CELL.EMPTY) return true;
  const b = bombAt(s, gx, gy);
  return !!b && !b.passers.includes(slot);
}

export function blocksBomb(s: RoundState, gx: number, gy: number): boolean {
  if (!inPlayfield(gx, gy)) return true;
  const i = idx(gx, gy);
  if (s.arena.cells[i] !== CELL.EMPTY) return true;
  if (s.arena.items[i] !== ITEM.NONE) return true;
  if (bombAt(s, gx, gy)) return true;
  return playerAt(s, gx, gy);
}
```

- [ ] **Step 4: Implementar `player.ts` (movimento)**

```ts
import { BASE_SPEED_SUB, CORNER_SUB } from './constants';
import { BTN, DIR, DISEASE, DX, DY, type GameEvent, type Player, type RoundState } from './types';
import { cellX, cellY, centerX, centerY } from './grid';
import { blocksPlayer } from './query';

export function speedSub(p: Player): number {
  if (p.disease === DISEASE.SLOW) return 4;
  if (p.disease === DISEASE.FAST) return BASE_SPEED_SUB + 7;
  return BASE_SPEED_SUB + (p.speed - 1);
}

export function flameRange(p: Player): number {
  return p.disease === DISEASE.LOW_FIRE ? 1 : p.fire + 2;
}

export function movePlayer(s: RoundState, p: Player, dir: number, ev: GameEvent[]): void {
  if (dir === DIR.NONE) return;
  p.facing = dir;
  const spd = speedSub(p);
  const gx = cellX(p.x), gy = cellY(p.y);
  const dx = DX[dir], dy = DY[dir];
  if (dx !== 0) {
    const off = p.y - centerY(gy);
    if (off !== 0) {
      if (Math.abs(off) > CORNER_SUB || blocksPlayer(s, gx + dx, gy, p.slot)) return;
      p.y -= Math.sign(off) * Math.min(Math.abs(off), spd);
      return;
    }
    const cx = centerX(gx);
    let nx = p.x + dx * spd;
    if (blocksPlayer(s, gx + dx, gy, p.slot)) {
      nx = dx > 0 ? Math.max(p.x, Math.min(nx, cx)) : Math.min(p.x, Math.max(nx, cx));
      if (nx === p.x) onBlocked(s, p, gx + dx, gy, dir, ev);
    }
    p.x = nx;
  } else {
    const off = p.x - centerX(gx);
    if (off !== 0) {
      if (Math.abs(off) > CORNER_SUB || blocksPlayer(s, gx, gy + dy, p.slot)) return;
      p.x -= Math.sign(off) * Math.min(Math.abs(off), spd);
      return;
    }
    const cy = centerY(gy);
    let ny = p.y + dy * spd;
    if (blocksPlayer(s, gx, gy + dy, p.slot)) {
      ny = dy > 0 ? Math.max(p.y, Math.min(ny, cy)) : Math.min(p.y, Math.max(ny, cy));
      if (ny === p.y) onBlocked(s, p, gx, gy + dy, dir, ev);
    }
    p.y = ny;
  }
}

/** Gancho para o chute (Task 6). */
function onBlocked(_s: RoundState, _p: Player, _tx: number, _ty: number, _dir: number, _ev: GameEvent[]): void {}

export function steerPlayer(s: RoundState, p: Player, buttons: number, ev: GameEvent[]): void {
  const dirs: number[] = [];
  if (buttons & BTN.UP) dirs.push(DIR.UP);
  if (buttons & BTN.DOWN) dirs.push(DIR.DOWN);
  if (buttons & BTN.LEFT) dirs.push(DIR.LEFT);
  if (buttons & BTN.RIGHT) dirs.push(DIR.RIGHT);
  for (const d of dirs) {
    const x = p.x, y = p.y;
    movePlayer(s, p, d, ev);
    if (p.x !== x || p.y !== y) return;
  }
}
```

- [ ] **Step 5: Adicionar `step` em `round.ts`**

Acrescente ao topo: `import type { GameEvent } from './types';` e `import { steerPlayer } from './player';`. Acrescente no fim do arquivo:

```ts
export function step(s: RoundState, inputs: number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'result') return ev;
  s.frame++;
  if (s.phase === 'intro') {
    if (--s.introLeft <= 0) s.phase = 'playing';
    for (const p of s.players) p.prevButtons = inputs[p.slot] ?? 0;
    return ev;
  }
  for (const p of s.players) {
    if (!p.active || !p.alive) continue;
    const btn = inputs[p.slot] ?? 0;
    if (p.dying === 0) steerPlayer(s, p, btn, ev);
    p.prevButtons = btn;
  }
  return ev;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core`
Expected: PASS (todos os testes até aqui)

- [ ] **Step 7: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): movimento sub-pixel, colisão, correção de canto e step()

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Bombas, explosões, chamas, reação em cadeia e morte

**Files:**
- Create: `web/src/core/bombs.ts`
- Modify: `web/src/core/player.ts` (adicionar `placeBomb`, `playerActions`), `web/src/core/arena.ts` (adicionar `tickArena`), `web/src/core/round.ts` (substituir `step`, adicionar `applyHazards`, `tickDying`)
- Test: `web/tests/core/bombs.test.ts`

**Interfaces:**
- Consumes: Task 3
- Produces: `updateBombs(s, ev)`, `explode(s, b, ev)`, `launch(b, dir)` (em `bombs.ts`); `placeBomb(s,p,gx,gy,ev)`, `playerActions(s,p,buttons,ev)` (em `player.ts`); `tickArena(s)` (em `arena.ts`); `killPlayer(s,p,ev)` (em `round.ts`)

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/bombs.test.ts`:
```ts
import { newRound, run, input, place, addBomb } from './helpers';
import { BTN, CELL, ITEM } from '../../src/core/types';
import { idx } from '../../src/core/grid';
import { FLAME_FRAMES } from '../../src/core/constants';

const flame = (s: any, x: number, y: number) => s.arena.flame[idx(x, y)];

describe('bomba', () => {
  it('A coloca bomba na casa do jogador; limite de 1', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    expect(s.bombs).toHaveLength(1);
    run(s, 1); run(s, 1, input(0, BTN.A));
    expect(s.bombs).toHaveLength(1);
  });
  it('explode em exatamente 128 frames', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    run(s, 126);
    expect(s.bombs).toHaveLength(1);
    expect(flame(s, 1, 1)).toBe(0);
    run(s, 1);
    expect(s.bombs).toHaveLength(0);
    expect(flame(s, 1, 1)).toBeGreaterThan(0);
  });
  it('chama dura 33 frames', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 1);
    run(s, 1);
    expect(flame(s, 7, 1)).toBeGreaterThan(0);
    run(s, FLAME_FRAMES - 1);
    expect(flame(s, 7, 1)).toBeGreaterThan(0);
    run(s, 1);
    expect(flame(s, 7, 1)).toBe(0);
  });
  it('alcance = fogo + 2', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 1, 2);
    run(s, 1);
    expect(flame(s, 9, 1)).toBeGreaterThan(0);
    expect(flame(s, 10, 1)).toBe(0);
    expect(flame(s, 7, 3)).toBeGreaterThan(0);
  });
  it('HARD bloqueia a chama', () => {
    const s = newRound({ clear: true });
    addBomb(s, 1, 2, 1, 3);
    run(s, 1);
    expect(flame(s, 2, 2)).toBe(0);
    expect(flame(s, 3, 2)).toBe(0);
  });
  it('destrói só o primeiro soft block e revela o item escondido', () => {
    const s = newRound();                       // (3,1),(4,1) são soft
    s.arena.hidden[idx(3, 1)] = ITEM.FIRE;
    addBomb(s, 2, 1, 1, 4);
    run(s, 1);
    expect(s.arena.burning[idx(3, 1)]).toBeGreaterThan(0);
    expect(s.arena.burning[idx(4, 1)]).toBe(0);
    expect(flame(s, 4, 1)).toBe(0);
    run(s, FLAME_FRAMES);
    expect(s.arena.cells[idx(3, 1)]).toBe(CELL.EMPTY);
    expect(s.arena.items[idx(3, 1)]).toBe(ITEM.FIRE);
  });
  it('chama destrói item e para nele', () => {
    const s = newRound({ clear: true });
    s.arena.items[idx(9, 1)] = ITEM.BOMB;
    addBomb(s, 7, 1, 1, 4);
    run(s, 1);
    expect(s.arena.items[idx(9, 1)]).toBe(ITEM.NONE);
    expect(flame(s, 10, 1)).toBe(0);
  });
  it('reação em cadeia no mesmo frame', () => {
    const s = newRound({ clear: true });
    addBomb(s, 5, 1, 1, 2);
    addBomb(s, 7, 1, 999, 2);
    run(s, 1);
    expect(s.bombs).toHaveLength(0);
    expect(flame(s, 9, 1)).toBeGreaterThan(0);
  });
  it('jogador atingido morre após 78 frames', () => {
    const s = newRound({ clear: true });
    place(s, 1, 8, 1);
    addBomb(s, 7, 1, 1);
    run(s, 1);
    expect(s.players[1].dying).toBe(77);
    run(s, 76);
    expect(s.players[1].alive).toBe(true);
    run(s, 1);
    expect(s.players[1].alive).toBe(false);
  });
  it('dono atravessa a própria bomba até sair da casa, depois ela bloqueia', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    run(s, 20, input(0, BTN.RIGHT));
    run(s, 20, input(0, BTN.LEFT));
    expect(s.players[0].x).toBe((2 + 1) * 128);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/bombs.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar `bombs.ts`**

```ts
import { CELL, DIR, DX, DY, ITEM, type Bomb, type GameEvent, type RoundState } from './types';
import { FLAME_FRAMES, FLY_CELLS, MOVE_BOMB_SUB, T } from './constants';
import { cellX, cellY, centerX, centerY, idx, inPlayfield } from './grid';
import { bombAt, blocksBomb } from './query';

export function launch(b: Bomb, dir: number): void {
  b.flight = { dx: DX[dir], dy: DY[dir], cellsLeft: FLY_CELLS, progress: 0 };
  b.slide = DIR.NONE; b.carried = false; b.passers = [];
}

function stepSlide(s: RoundState, b: Bomb): void {
  if (b.x % T === 0 && b.y % T === 0) {
    if (blocksBomb(s, cellX(b.x) + DX[b.slide], cellY(b.y) + DY[b.slide])) { b.slide = DIR.NONE; return; }
  }
  b.x += DX[b.slide] * MOVE_BOMB_SUB;
  b.y += DY[b.slide] * MOVE_BOMB_SUB;
}

function stepFlight(s: RoundState, b: Bomb): void {
  const f = b.flight!;
  b.x += f.dx * MOVE_BOMB_SUB; b.y += f.dy * MOVE_BOMB_SUB; f.progress += MOVE_BOMB_SUB;
  if (f.progress < T) return;
  f.progress = 0; f.cellsLeft--;
  let gx = cellX(b.x), gy = cellY(b.y);
  if (gx < 1) gx = 13; else if (gx > 13) gx = 1;
  if (gy < 1) gy = 11; else if (gy > 11) gy = 1;
  b.x = centerX(gx); b.y = centerY(gy);
  if (f.cellsLeft > 0) return;
  if (blocksBomb(s, gx, gy)) f.cellsLeft = 1; else b.flight = null;
}

export function explode(s: RoundState, b: Bomb, ev: GameEvent[]): void {
  const k = s.bombs.indexOf(b);
  if (k < 0) return;
  s.bombs.splice(k, 1);
  const gx = cellX(b.x), gy = cellY(b.y);
  ev.push({ type: 'explosion', gx, gy });
  s.arena.flame[idx(gx, gy)] = FLAME_FRAMES;
  for (let d = 1; d <= 4; d++) {
    for (let r = 1; r <= b.range; r++) {
      const x = gx + DX[d] * r, y = gy + DY[d] * r;
      if (!inPlayfield(x, y)) break;
      const i = idx(x, y);
      const c = s.arena.cells[i];
      if (c === CELL.HARD) break;
      if (c === CELL.SOFT) {
        if (s.arena.burning[i] === 0) { s.arena.burning[i] = FLAME_FRAMES; ev.push({ type: 'block_destroyed', gx: x, gy: y }); }
        if (!b.pierce) break;
        continue;
      }
      s.arena.flame[i] = FLAME_FRAMES;
      if (s.arena.items[i] !== ITEM.NONE) { s.arena.items[i] = ITEM.NONE; break; }
      const other = bombAt(s, x, y);
      if (other) { explode(s, other, ev); break; }
    }
  }
}

export function updateBombs(s: RoundState, ev: GameEvent[]): void {
  const due: Bomb[] = [];
  for (const b of s.bombs) {
    if (b.carried) continue;
    if (b.flight) { stepFlight(s, b); continue; }
    if (b.slide !== DIR.NONE) stepSlide(s, b);
    b.fuse--;
    if (b.fuse <= 0 || s.arena.flame[idx(cellX(b.x), cellY(b.y))] > 0) due.push(b);
  }
  for (const b of due) explode(s, b, ev);
  for (const b of s.bombs) {
    b.passers = b.passers.filter(slot => {
      const q = s.players[slot];
      return q.alive && cellX(q.x) === cellX(b.x) && cellY(q.y) === cellY(b.y);
    });
  }
}
```

- [ ] **Step 4: Adicionar `tickArena` em `arena.ts`**

Acrescente `import type { RoundState } from './types';` e no fim:
```ts
export function tickArena(s: RoundState): void {
  const a = s.arena;
  for (let i = 0; i < a.flame.length; i++) {
    if (a.flame[i] > 0) a.flame[i]--;
    if (a.burning[i] > 0 && --a.burning[i] === 0) {
      a.cells[i] = CELL.EMPTY;
      a.items[i] = a.hidden[i];
      a.hidden[i] = ITEM.NONE;
    }
  }
}
```

- [ ] **Step 5: Adicionar `placeBomb` e `playerActions` em `player.ts`**

Acrescente os imports `FUSE_FRAMES` (de `./constants`), `CELL` (de `./types`), `idx` (de `./grid`), `bombAt` (de `./query`) e, no fim do arquivo:
```ts
export function placeBomb(s: RoundState, p: Player, gx: number, gy: number, ev: GameEvent[]): void {
  if (s.bombs.filter(b => b.owner === p.slot).length >= p.maxBombs) return;
  if (s.arena.cells[idx(gx, gy)] !== CELL.EMPTY || bombAt(s, gx, gy)) return;
  const passers = s.players
    .filter(q => q.active && q.alive && q.dying === 0 && cellX(q.x) === gx && cellY(q.y) === gy)
    .map(q => q.slot);
  s.bombs.push({
    id: s.nextBombId++, owner: p.slot, x: centerX(gx), y: centerY(gy), fuse: FUSE_FRAMES,
    range: flameRange(p), pierce: p.pierce, passers, slide: DIR.NONE, flight: null, carried: false,
  });
  ev.push({ type: 'bomb_placed', slot: p.slot, gx, gy });
}

export function playerActions(s: RoundState, p: Player, buttons: number, ev: GameEvent[]): void {
  const pressed = buttons & ~p.prevButtons;
  const gx = cellX(p.x), gy = cellY(p.y);
  if ((pressed & BTN.A) || p.disease === DISEASE.DIARRHEA) placeBomb(s, p, gx, gy, ev);
}
```

- [ ] **Step 6: Substituir `step` em `round.ts` e adicionar mortes**

Imports extras: `DEATH_FRAMES` de `./constants`; `CELL` de `./types`; `cellX, cellY, idx` de `./grid`; `tickArena` de `./arena`; `updateBombs` de `./bombs`; `playerActions` de `./player`.

```ts
export function killPlayer(s: RoundState, p: Player, ev: GameEvent[]): void {
  if (p.dying > 0 || !p.alive) return;
  p.dying = DEATH_FRAMES;
  if (p.carrying >= 0) {
    const b = s.bombs.find(x => x.id === p.carrying);
    if (b) { b.carried = false; b.x = centerX(cellX(p.x)); b.y = centerY(cellY(p.y)); }
    p.carrying = -1;
  }
  ev.push({ type: 'player_hit', slot: p.slot });
}

function applyHazards(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (!p.active || !p.alive || p.dying > 0) continue;
    const i = idx(cellX(p.x), cellY(p.y));
    if (s.arena.flame[i] > 0 || s.arena.cells[i] === CELL.HARD) killPlayer(s, p, ev);
  }
}

function tickDying(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    if (p.dying > 0 && --p.dying === 0) { p.alive = false; ev.push({ type: 'player_out', slot: p.slot }); }
  }
}

export function step(s: RoundState, inputs: number[]): GameEvent[] {
  const ev: GameEvent[] = [];
  if (s.phase === 'result') return ev;
  s.frame++;
  if (s.phase === 'intro') {
    if (--s.introLeft <= 0) s.phase = 'playing';
    for (const p of s.players) p.prevButtons = inputs[p.slot] ?? 0;
    return ev;
  }
  tickArena(s);
  for (const p of s.players) {
    if (!p.active || !p.alive) continue;
    const btn = inputs[p.slot] ?? 0;
    if (p.dying === 0) {
      steerPlayer(s, p, btn, ev);
      playerActions(s, p, btn, ev);
    }
    p.prevButtons = btn;
  }
  updateBombs(s, ev);
  applyHazards(s, ev);
  tickDying(s, ev);
  return ev;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): bombas (pavio 128), explosão em cruz, cadeia, chamas 33f e morte 78f

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Coleta de itens, caveira e contágio

**Files:**
- Modify: `web/src/core/round.ts` (adicionar `pickupsAndContagion` e o tick de doença no `step`)
- Test: `web/tests/core/items.test.ts`

**Interfaces:**
- Consumes: `applyItem` (Task 2), `step` (Task 4)
- Produces: comportamento de coleta no `step`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/items.test.ts`:
```ts
import { newRound, run, input, place } from './helpers';
import { BTN, DISEASE, ITEM } from '../../src/core/types';
import { idx } from '../../src/core/grid';
import { speedSub, flameRange } from '../../src/core/player';

describe('itens', () => {
  const walkInto = (item: number) => {
    const s = newRound({ clear: true });
    s.arena.items[idx(2, 1)] = item;
    run(s, 10, input(0, BTN.RIGHT));
    return s;
  };
  it('Fogo+ aumenta alcance e some do chão', () => {
    const s = walkInto(ITEM.FIRE);
    expect(s.players[0].fire).toBe(1);
    expect(flameRange(s.players[0])).toBe(3);
    expect(s.arena.items[idx(2, 1)]).toBe(ITEM.NONE);
  });
  it('Bomba+, Patins e habilidades', () => {
    expect(walkInto(ITEM.BOMB).players[0].maxBombs).toBe(2);
    expect(walkInto(ITEM.SPEED).players[0].speed).toBe(2);
    expect(walkInto(ITEM.KICK).players[0].kick).toBe(true);
    expect(walkInto(ITEM.PUNCH).players[0].punch).toBe(true);
    expect(walkInto(ITEM.GLOVE).players[0].glove).toBe(true);
    expect(walkInto(ITEM.PIERCE).players[0].pierce).toBe(true);
  });
  it('máximos respeitados', () => {
    const s = newRound({ clear: true });
    s.players[0].speed = 5; s.arena.items[idx(2, 1)] = ITEM.SPEED;
    run(s, 10, input(0, BTN.RIGHT));
    expect(s.players[0].speed).toBe(5);
  });
  it('caveira aplica doença 1..4 por ~600 frames', () => {
    const s = walkInto(ITEM.SKULL);
    const p = s.players[0];
    expect(p.disease).toBeGreaterThanOrEqual(1);
    expect(p.disease).toBeLessThanOrEqual(4);
    expect(p.diseaseTimer).toBeGreaterThan(590);
  });
  it('doença cura após 600 frames', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.disease = DISEASE.SLOW; p.diseaseTimer = 600;
    run(s, 599);
    expect(p.disease).toBe(DISEASE.SLOW);
    run(s, 1);
    expect(p.disease).toBe(DISEASE.NONE);
  });
  it('doenças alteram velocidade e alcance', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.disease = DISEASE.SLOW; expect(speedSub(p)).toBe(4);
    p.disease = DISEASE.FAST; expect(speedSub(p)).toBe(15);
    p.disease = DISEASE.LOW_FIRE; expect(flameRange(p)).toBe(1);
  });
  it('diarreia solta bombas sem apertar A', () => {
    const s = newRound({ clear: true });
    s.players[0].disease = DISEASE.DIARRHEA; s.players[0].diseaseTimer = 600;
    run(s, 1);
    expect(s.bombs).toHaveLength(1);
  });
  it('contágio por contato', () => {
    const s = newRound({ clear: true });
    s.players[0].disease = DISEASE.SLOW; s.players[0].diseaseTimer = 600;
    place(s, 1, 1, 1);
    run(s, 1);
    expect(s.players[1].disease).toBe(DISEASE.SLOW);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/items.test.ts`
Expected: FAIL (itens não são coletados)

- [ ] **Step 3: Implementar em `round.ts`**

Imports extras: `ITEM` de `./types`, `DISEASE_FRAMES` de `./constants`, `applyItem` de `./items`.

```ts
function pickupsAndContagion(s: RoundState, ev: GameEvent[]): void {
  const standing = s.players.filter(p => p.active && p.alive && p.dying === 0);
  for (const p of standing) {
    const i = idx(cellX(p.x), cellY(p.y));
    const it = s.arena.items[i];
    if (it !== ITEM.NONE) {
      applyItem(p, it, s.rng);
      s.arena.items[i] = ITEM.NONE;
      ev.push({ type: 'item_picked', slot: p.slot, item: it });
    }
  }
  for (let a = 0; a < standing.length; a++) for (let b = a + 1; b < standing.length; b++) {
    const p = standing[a], q = standing[b];
    if (cellX(p.x) !== cellX(q.x) || cellY(p.y) !== cellY(q.y)) continue;
    if (p.disease && !q.disease) { q.disease = p.disease; q.diseaseTimer = DISEASE_FRAMES; }
    else if (q.disease && !p.disease) { p.disease = q.disease; p.diseaseTimer = DISEASE_FRAMES; }
  }
}
```

No `step`, dentro do laço de jogadores e antes de `steerPlayer`, adicione o tick de doença:
```ts
    if (p.dying === 0) {
      if (p.disease && --p.diseaseTimer <= 0) p.disease = 0;
      steerPlayer(s, p, btn, ev);
      playerActions(s, p, btn, ev);
    }
```
Chame `pickupsAndContagion(s, ev);` logo após `updateBombs(s, ev);`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): coleta de itens, caveira com 4 doenças e contágio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Chute, soco, luva e bomba perfurante

**Files:**
- Modify: `web/src/core/player.ts` (implementar `onBlocked`; ampliar `playerActions`)
- Test: `web/tests/core/abilities.test.ts`

**Interfaces:**
- Consumes: `launch`, `updateBombs` (Task 4), `bombAt`, `blocksBomb` (Task 3)
- Produces: comportamentos de habilidade; eventos `bomb_kicked`, `bomb_punched`, `bomb_thrown`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/abilities.test.ts`:
```ts
import { newRound, run, input, addBomb } from './helpers';
import { BTN, DIR, CELL } from '../../src/core/types';
import { cellX, idx } from '../../src/core/grid';

describe('habilidades', () => {
  it('chute: bomba desliza até o obstáculo (P3 em 13,1)', () => {
    const s = newRound({ clear: true });
    s.players[0].kick = true;
    const b = addBomb(s, 3, 1);
    run(s, 17, input(0, BTN.RIGHT));
    expect(b.slide).toBe(DIR.RIGHT);
    run(s, 100);
    expect(b.slide).toBe(DIR.NONE);
    expect(cellX(b.x)).toBe(12);
  });
  it('sem chute a bomba não se move', () => {
    const s = newRound({ clear: true });
    const b = addBomb(s, 3, 1);
    run(s, 30, input(0, BTN.RIGHT));
    expect(cellX(b.x)).toBe(3);
  });
  it('soco (Y): bomba voa 3 casas em 24 frames', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    run(s, 1, input(0, BTN.Y));
    expect(b.flight).not.toBeNull();
    run(s, 23);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(5);
  });
  it('voo quica quando a casa de pouso está ocupada', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    addBomb(s, 5, 1);
    run(s, 1, input(0, BTN.Y));
    run(s, 31);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(6);
  });
  it('luva: segurar A sobre a bomba levanta; soltar arremessa 3 casas', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.glove = true; p.facing = DIR.RIGHT;
    const b = addBomb(s, 1, 1, 999, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    expect(b.carried).toBe(true);
    expect(p.carrying).toBe(b.id);
    run(s, 5, input(0, BTN.A));
    run(s, 1);
    expect(b.flight).not.toBeNull();
    run(s, 23);
    expect(cellX(b.x)).toBe(4);
    expect(p.carrying).toBe(-1);
  });
  it('bomba carregada não conta o pavio', () => {
    const s = newRound({ clear: true });
    s.players[0].glove = true;
    const b = addBomb(s, 1, 1, 10, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    run(s, 30, input(0, BTN.A));
    expect(b.fuse).toBe(10);
  });
  it('perfurante (P) destrói todos os soft blocks no alcance', () => {
    const s = newRound();                        // linha 1: (3..6,1) soft
    s.players[0].pierce = true; s.players[0].fire = 2;
    run(s, 1, input(0, BTN.A));
    run(s, 127);
    for (const x of [3, 4, 5]) expect(s.arena.burning[idx(x, 1)]).toBeGreaterThan(0);
    expect(s.arena.cells[idx(6, 1)]).toBe(CELL.SOFT);
    expect(s.arena.burning[idx(6, 1)]).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/abilities.test.ts`
Expected: FAIL (chute, soco e luva não fazem nada; o teste de perfurante já pode passar)

- [ ] **Step 3: Implementar em `player.ts`**

Acrescente `import { launch } from './bombs';` e `blocksBomb` ao import de `./query`. Substitua `onBlocked` e `playerActions`:

```ts
function onBlocked(s: RoundState, p: Player, tx: number, ty: number, dir: number, ev: GameEvent[]): void {
  if (!p.kick) return;
  const b = bombAt(s, tx, ty);
  if (!b || b.slide !== DIR.NONE) return;
  if (blocksBomb(s, tx + DX[dir], ty + DY[dir])) return;
  b.slide = dir;
  b.passers = [];
  ev.push({ type: 'bomb_kicked', slot: p.slot });
}

export function playerActions(s: RoundState, p: Player, buttons: number, ev: GameEvent[]): void {
  const pressed = buttons & ~p.prevButtons;
  const released = p.prevButtons & ~buttons;
  const gx = cellX(p.x), gy = cellY(p.y);

  if (p.carrying >= 0) {
    if (released & BTN.A) {
      const b = s.bombs.find(x => x.id === p.carrying);
      p.carrying = -1;
      if (b) {
        b.x = centerX(gx); b.y = centerY(gy);
        launch(b, p.facing);
        ev.push({ type: 'bomb_thrown', slot: p.slot });
      }
    }
    return;
  }

  if (pressed & BTN.A) {
    const under = bombAt(s, gx, gy);
    if (under && p.glove) {
      under.carried = true; under.slide = DIR.NONE; p.carrying = under.id;
      return;
    }
    placeBomb(s, p, gx, gy, ev);
  } else if (p.disease === DISEASE.DIARRHEA) {
    placeBomb(s, p, gx, gy, ev);
  }

  if ((pressed & BTN.Y) && p.punch) {
    const b = bombAt(s, gx + DX[p.facing], gy + DY[p.facing]);
    if (b) { launch(b, p.facing); ev.push({ type: 'bomb_punched', slot: p.slot }); }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): chute, soco, luva (carregar/arremessar) e bomba perfurante

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Relógio, pressão, fim de rodada, times e morte súbita

**Files:**
- Modify: `web/src/core/round.ts` (adicionar `ringCells`, `pressureOrder`, `tickClock`, `dropBlock`, `checkEnd`; usar `pressureOrder` em `createRound`)
- Test: `web/tests/core/round.test.ts`

**Interfaces:**
- Consumes: `killPlayer`, `step` (Task 4)
- Produces: `ringCells(k): number[]`, `pressureOrder(fromRing, toRing): number[]`; `s.phase === 'result'` com `s.winners`; evento `round_end`

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/round.test.ts`:
```ts
import { newRound, run, place } from './helpers';
import { CELL } from '../../src/core/types';
import { idx } from '../../src/core/grid';
import { ringCells } from '../../src/core/round';
import { PRESSURE_START_FRAMES } from '../../src/core/constants';

const two = { active: [true, true, false, false, false] };

describe('fim de rodada', () => {
  it('um sobrevivente vence', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5;
    run(s, 78);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([0]);
  });
  it('espera a animação de morte terminar', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5;
    run(s, 77);
    expect(s.phase).toBe('playing');
  });
  it('todos morrem → empate', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5; s.arena.flame[idx(1, 1)] = 5;
    const ev = run(s, 78);
    expect(s.winners).toEqual([]);
    expect(ev.some(e => e.type === 'round_end')).toBe(true);
  });
  it('tempo esgotado sem morte súbita → empate', () => {
    const s = newRound({ clear: true, ...two });
    s.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([]);
  });
  it('tempo esgotado com morte súbita → prorrogação', () => {
    const s = newRound({ clear: true, ...two, suddenDeath: true });
    s.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('playing');
    expect(s.pressure.overtime).toBe(true);
  });
  it('tempo infinito não conta e não tem pressão', () => {
    const s = newRound({ clear: true, timeIdx: 4 });
    run(s, 100);
    expect(s.timeLeft).toBe(-1);
    expect(s.pressure.next).toBe(0);
  });
  it('times: rodada acaba quando só resta um time; todo o time ganha', () => {
    const s = newRound({ clear: true, mode: 'team', teams: [0, 1, 0, 1, 0] });
    s.arena.flame[idx(13, 11)] = 5; s.arena.flame[idx(1, 11)] = 5;
    run(s, 78);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([0, 2, 4]);
  });
});

describe('pressão', () => {
  it('anel externo começa em (1,1) no sentido horário', () => {
    const r = ringCells(0);
    expect(r[0]).toBe(idx(1, 1));
    expect(r[12]).toBe(idx(13, 1));
    expect(r).toHaveLength(44);
  });
  it('primeiro bloco cai 6 frames após 1:00 restante e mata quem está na casa', () => {
    const s = newRound({ clear: true });
    s.timeLeft = PRESSURE_START_FRAMES + 1;
    run(s, 5);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.EMPTY);
    run(s, 1);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    run(s, 1);
    expect(s.players[0].dying).toBeGreaterThan(0);
  });
  it('preenche só os 2 anéis externos e para', () => {
    // só P2 e P5 jogam, ambos no miolo, para a rodada não acabar
    const s = newRound({ clear: true, timeIdx: 0, active: [false, true, false, false, true] });
    place(s, 1, 6, 5);
    run(s, 2000);
    expect(s.phase).toBe('playing');
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(2, 3)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(3, 3)]).toBe(CELL.EMPTY);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/round.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar em `round.ts`**

Imports extras: `PRESSURE_START_FRAMES, PRESSURE_INTERVAL, PRESSURE_RINGS` de `./constants`.

```ts
export function ringCells(k: number): number[] {
  const x0 = 1 + k, x1 = 13 - k, y0 = 1 + k, y1 = 11 - k;
  const out: number[] = [];
  if (x0 > x1 || y0 > y1) return out;
  for (let x = x0; x <= x1; x++) out.push(idx(x, y0));
  for (let y = y0 + 1; y <= y1; y++) out.push(idx(x1, y));
  if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push(idx(x, y1));
  if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push(idx(x0, y));
  return out;
}

export function pressureOrder(fromRing: number, toRing: number): number[] {
  const out: number[] = [];
  for (let k = fromRing; k < toRing; k++) out.push(...ringCells(k));
  return out;
}

function dropBlock(s: RoundState, i: number, ev: GameEvent[]): void {
  const a = s.arena;
  a.cells[i] = CELL.HARD; a.items[i] = ITEM.NONE; a.hidden[i] = ITEM.NONE; a.burning[i] = 0; a.flame[i] = 0;
  s.bombs = s.bombs.filter(b => b.carried || b.flight || idx(cellX(b.x), cellY(b.y)) !== i);
  ev.push({ type: 'pressure_block', gx: i % 15, gy: Math.floor(i / 15) });
}

function tickClock(s: RoundState, ev: GameEvent[]): void {
  if (s.timeLeft < 0) return;
  if (s.timeLeft > 0) s.timeLeft--;
  const pr = s.pressure;
  if (s.timeLeft === 0 && s.rules.suddenDeath && !pr.overtime) {
    pr.overtime = true;
    pr.order = pr.order.concat(pressureOrder(PRESSURE_RINGS, 6));
  }
  if (s.timeLeft > PRESSURE_START_FRAMES) return;
  if (!pr.overtime && ++pr.timer < PRESSURE_INTERVAL) return;
  pr.timer = 0;
  while (pr.next < pr.order.length && s.arena.cells[pr.order[pr.next]] === CELL.HARD) pr.next++;
  if (pr.next < pr.order.length) dropBlock(s, pr.order[pr.next++], ev);
}

function checkEnd(s: RoundState, ev: GameEvent[]): void {
  if (s.players.some(p => p.active && p.alive && p.dying > 0)) return;
  const standing = s.players.filter(p => p.active && p.alive);
  let done = false;
  let winners: number[] = [];
  if (s.rules.mode === 'team') {
    const teams = [...new Set(standing.map(p => p.team))];
    if (teams.length <= 1) {
      done = true;
      if (teams.length === 1) winners = s.players.filter(p => p.active && p.team === teams[0]).map(p => p.slot);
    }
  } else if (standing.length <= 1) {
    done = true;
    winners = standing.map(p => p.slot);
  }
  if (!done && s.timeLeft === 0 && !s.rules.suddenDeath) { done = true; winners = []; }
  if (done) { s.phase = 'result'; s.winners = winners; ev.push({ type: 'round_end', winners }); }
}
```

Em `createRound`, troque `order: []` por `order: TIME_OPTIONS_FRAMES[rules.timeIdx] < 0 ? [] : pressureOrder(0, PRESSURE_RINGS)`.

No fim do `step`, depois de `tickDying(s, ev);`, adicione:
```ts
  tickClock(s, ev);
  checkEnd(s, ev);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd web && npx vitest run tests/core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): relógio, pressão em espiral, fim de rodada, times e morte súbita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Partida (coroas), determinismo e API pública

**Files:**
- Create: `web/src/core/match.ts`, `web/src/core/hash.ts`, `web/src/core/index.ts`
- Test: `web/tests/core/match.test.ts`

**Interfaces:**
- Consumes: `createRound`, `step` (Tasks 2–7)
- Produces:
  - `interface MatchState { rules: Rules; stage: number; seed: number; roundNo: number; crowns: number[]; over: boolean }`
  - `createMatch(rules, stage, seed): MatchState`, `startRound(m): RoundState`, `finishRound(m, r): { winners: number[]; matchOver: boolean; champions: number[] }`
  - `hashState(x: unknown): string`
  - `index.ts` reexporta tudo o que o cliente usa

- [ ] **Step 1: Escrever o teste que falha**

`web/tests/core/match.test.ts`:
```ts
import { createMatch, startRound, finishRound, hashState, step, defaultRules, makeRng, randInt } from '../../src/core';

const rules = (o = {}) => ({ ...defaultRules(), ...o });

describe('partida', () => {
  it('coroas acumulam e a partida acaba na meta', () => {
    const m = createMatch(rules({ matches: 2 }), 1, 123);
    let r = startRound(m); r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: false, champions: [] });
    r = startRound(m); r.winners = [0];
    expect(finishRound(m, r)).toEqual({ winners: [0], matchOver: true, champions: [0] });
    expect(m.crowns).toEqual([2, 0, 0, 0, 0]);
  });
  it('empate não dá coroa', () => {
    const m = createMatch(rules(), 1, 1);
    const r = startRound(m); r.winners = [];
    finishRound(m, r);
    expect(m.crowns).toEqual([0, 0, 0, 0, 0]);
  });
  it('cada rodada tem seed diferente (spawns variam)', () => {
    const m = createMatch(rules({ randomSpawns: true }), 1, 7);
    const pos = new Set<string>();
    for (let i = 0; i < 6; i++) pos.add(startRound(m).players.map(p => p.x + ',' + p.y).join('|'));
    expect(pos.size).toBeGreaterThan(1);
  });
});

describe('determinismo', () => {
  const play = (seed: number) => {
    const m = createMatch(rules(), 1, seed);
    const r = startRound(m);
    const inRng = makeRng(seed * 31 + 1);
    for (let f = 0; f < 20000 && r.phase !== 'result'; f++) {
      step(r, [0, 1, 2, 3, 4].map(() => randInt(inRng, 128)));
    }
    return hashState(r);
  };
  it('mesma seed e mesmos inputs → mesmo hash', () => {
    expect(play(5)).toBe(play(5));
  });
  it('seeds diferentes → hashes diferentes', () => {
    expect(play(5)).not.toBe(play(6));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd web && npx vitest run tests/core/match.test.ts`
Expected: FAIL (`src/core/index` não existe)

- [ ] **Step 3: Implementar `match.ts`**

```ts
import type { Rules, RoundState } from './types';
import { createRound } from './round';

export interface MatchState { rules: Rules; stage: number; seed: number; roundNo: number; crowns: number[]; over: boolean }

export function createMatch(rules: Rules, stage: number, seed: number): MatchState {
  return { rules, stage, seed: seed >>> 0, roundNo: 0, crowns: [0, 0, 0, 0, 0], over: false };
}

export function startRound(m: MatchState): RoundState {
  m.roundNo++;
  return createRound(m.stage, m.rules, (m.seed + Math.imul(m.roundNo, 0x9e3779b1)) >>> 0);
}

export function finishRound(m: MatchState, r: RoundState): { winners: number[]; matchOver: boolean; champions: number[] } {
  for (const w of r.winners) m.crowns[w]++;
  const champions = [0, 1, 2, 3, 4].filter(i => m.crowns[i] >= m.rules.matches);
  m.over = champions.length > 0;
  return { winners: [...r.winners], matchOver: m.over, champions };
}
```

- [ ] **Step 4: Implementar `hash.ts` e `index.ts`**

`hash.ts`:
```ts
/** FNV-1a 32 bits sobre o JSON do estado. Só para testes e checagem de sync. */
export function hashState(x: unknown): string {
  const str = JSON.stringify(x);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
```

`index.ts`:
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
export { bombAt, blocksPlayer, blocksBomb } from './query';
```

- [ ] **Step 5: Rodar toda a suíte e o typecheck**

Run: `cd web && npx vitest run && npx tsc --noEmit`
Expected: todos os testes PASS; `tsc` sem erros

- [ ] **Step 6: Commit**

```bash
git add web/src/core web/tests/core
git commit -m "feat(core): partida com coroas, API pública e teste de determinismo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Próximos planos (escritos depois que este terminar)

- **Plano 2, cliente jogável:** loop de 60 Hz com acumulador; Canvas 256×224 com escala inteira; sprites pixel art gerados por código (6 personagens, bombas, chamas, blocos por tema, itens, HUD, fonte bitmap); entrada por teclado + Gamepad API (5 controles virtuais); todas as telas (título, VS, jogadores, regras, personagem, fase, placar, VITÓRIA, CONFIG).
- **Plano 3, conteúdo e integrações:** IA (Fraco/Normal/Forte); mecânicas especiais das fases 2, 3, 6, 7, 8 e 9; Bad Bomber; áudio chiptune; webhook Crown Cup com retry e fila offline.
