# Efeitos visuais da batalha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** camada de efeitos (luz, tremor, partículas, sombras, brilho, morte, clima) desenhada em resolução nativa por
cima do canvas fiel 256×224, ligada por padrão e desligável em Opções.

**Architecture:** o jogo continua desenhando num canvas de base 256×224 (agora fora da tela). `present()` copia a base
ampliada para o `#screen` em resolução nativa e, na batalha, desenha os efeitos por cima. O estado dos efeitos
(`FxState`) avança uma vez por tick na tela de batalha, a partir dos eventos e da grade do núcleo, com RNG próprio.

**Tech Stack:** TypeScript, Canvas2D, Vite, Vitest (ambiente Node, sem DOM).

**Spec:** `docs/superpowers/specs/2026-10-01-crown-blast-efeitos-design.md`

## Global Constraints

- `web/src/core` não muda e não importa nada de `render/` (§2.1).
- O fx usa só o próprio RNG; nunca `Math.random` nem o RNG do núcleo (§2.2).
- O canvas de base recebe exatamente o que é desenhado hoje (§2.3).
- `options.fx = false` ou `?fx=0` → visível = só a base ampliada (§2.4).
- Teto de 600 partículas; tremor máx. 6 px; clima máx. 25%; sombras desligam com média > 12 ms (§4).
- Rótulo do menu: `EFEITOS VISUAIS` (o `VOLUME DOS EFEITOS` já existe e é áudio).
- Comandos rodam em `web/`: `npm test`, `npx tsc --noEmit`.

## Review Focus

1. **Nova rodada na mesma partida:** partículas, tremor e flash da rodada anterior não podem vazar → teste em Task 2.
2. **TIME UP / fim de rodada:** explosões nessas fases não geram efeitos novos → teste em Task 2.
3. **Cadeia de explosões:** muitas explosões juntas respeitam o teto de partículas e de tremor → teste em Task 2.
4. **Configuração salva antiga** (sem `fx`) carrega com efeitos ligados → teste em Task 1.
5. **Sprite sobre o chão:** a sombra nunca pinta pixel coberto por sprite → teste da máscara em Task 3.

---

### Task 1: Opção `fx` nas configurações e no menu

**Files:**
- Modify: `web/src/app/settings.ts` (interface `Options`, `defaultOptions`, `normalizeSettings`)
- Modify: `web/src/render/text/strings.ts` (`S.options.fx`)
- Modify: `web/src/screens/options.ts` (linha antes de `music`)
- Test: `web/tests/client/settings.test.ts`

**Interfaces:** Produces `Options.fx: boolean` (padrão `true`).

- [ ] **Step 1: testes** — em `settings.test.ts`, os dois `toEqual` de `s.options` ganham `fx: true`, e um caso novo:
```ts
  it('efeitos visuais: padrão ligado, campo ausente em configuração antiga vira true, lixo vira padrão', () => {
    expect(defaultSettings().options.fx).toBe(true);
    expect(normalizeSettings({ options: { musicVol: 3 } }).options.fx).toBe(true);
    expect(normalizeSettings({ options: { fx: false } }).options.fx).toBe(false);
    expect(normalizeSettings({ options: { fx: 'não' } }).options.fx).toBe(true);
  });
```
- [ ] **Step 2:** `npx vitest run tests/client/settings.test.ts` → FAIL (`fx` indefinido).
- [ ] **Step 3: implementação**
  - `Options`: `fx: boolean;          // efeitos visuais da batalha (luz, partículas, sombras…)`
  - `defaultOptions()`: acrescentar `fx: true`.
  - `normalizeSettings`: `fx: bool(ro.fx, d.options.fx),`
  - `strings.ts`, em `options`: `fx: 'EFEITOS VISUAIS',`
  - `options.ts`, página `main`, antes da linha `music`:
```ts
    rows.push({
      id: 'fx', label: S.options.fx, value: () => (opt().fx ? S.options.yes : S.options.no),
      left: () => { const changed = opt().fx; opt().fx = false; app.save(); return changed; },
      right: () => { const changed = !opt().fx; opt().fx = true; app.save(); return changed; },
    });
```
- [ ] **Step 4:** `npm test` → PASS (conferir testes de tela de opções que contam linhas; ajustar a contagem se houver).
- [ ] **Step 5:** commit `feat(opções): liga/desliga dos efeitos visuais`.

### Task 2: Estado e atualização dos efeitos (`fxUpdate`)

**Files:**
- Create: `web/src/render/fx/state.ts`, `web/src/render/fx/coords.ts`, `web/src/render/fx/update.ts`
- Test: `web/tests/client/fx-update.test.ts`

**Interfaces:**
- Produces:
  - `createFx(seed?: number): FxState`, `liveCount(fx): number`, `spawn(fx, p)`, `rand(fx): number`
  - `PART = { SPARK: 1, SMOKE: 2, DEBRIS: 3, DUST: 4, BURST: 5 }`
  - `fxUpdate(fx, round, events, colorAt?: (cell: number) => number): void`
  - `cellX(cell)`, `cellY(cell)`, `entX(x)`, `entY(y)`, `FIELD_TOP = 24`
  - `interface FxFrame { state: FxState; round: RoundState; drawNoActors(ctx: CanvasRenderingContext2D): void }`

- [ ] **Step 1: testes** (`fx-update.test.ts`):
```ts
import { createRound, makeRng, defaultRules, cellOf, CODE, BURN } from '../../src/core';
import { createFx, liveCount } from '../../src/render/fx/state';
import { fxUpdate } from '../../src/render/fx/update';

const boom = (cell: number) => ({ type: 'explosion' as const, cell, owner: 0 });
const round = () => createRound(1, defaultRules(), makeRng());

describe('fxUpdate', () => {
  it('explosão gera 18 faíscas + 6 fumaças e tremor', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [boom(cellOf(5, 5))]);
    expect(liveCount(fx)).toBe(24);
    expect(fx.shake).toBeGreaterThan(0);
  });
  it('tudo some e o tremor zera depois de 60 ticks', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    for (let i = 0; i < 60; i++) fxUpdate(fx, r, []);
    expect(liveCount(fx)).toBe(0);
    expect(fx.shake).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('bloco que vira BURNING (SOFT) solta 8 detritos com a cor amostrada', () => {
    const r = round(), fx = createFx(), c = cellOf(3, 3);
    fxUpdate(fx, r, []);
    r.grid[c] = CODE.BURNING; r.cellAux[c] = BURN.SOFT;
    const asked: number[] = [];
    fxUpdate(fx, r, [], cell => { asked.push(cell); return 0x123456; });
    expect(liveCount(fx)).toBe(8);
    expect(asked).toEqual([c]);
    fxUpdate(fx, r, []);
    expect(liveCount(fx)).toBe(8);   // continua queimando: não solta de novo
  });
  it('player_hit acende o flash e solta 24 partículas', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [{ type: 'player_hit', slot: 1 }]);
    expect(fx.flash).toBe(1);
    expect(liveCount(fx)).toBe(24);
  });
  it('cadeia: teto de 600 partículas e de 6 px de tremor', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, Array.from({ length: 40 }, () => boom(cellOf(7, 7))));
    expect(liveCount(fx)).toBe(600);
    expect(fx.shake).toBeLessThanOrEqual(6);
  });
  it('TIME UP e fim de rodada não geram efeitos novos', () => {
    const r = round(), fx = createFx();
    r.phase = 'timeUp';
    fxUpdate(fx, r, [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    expect(liveCount(fx)).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('rodada nova zera o que sobrou da anterior', () => {
    const fx = createFx();
    fxUpdate(fx, round(), [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    fxUpdate(fx, round(), []);
    expect(liveCount(fx)).toBe(0);
    expect(fx.shake).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('determinístico: mesma semente e mesmos eventos = mesmo estado', () => {
    const r = round(), a = createFx(7), b = createFx(7);
    for (const fx of [a, b]) { fxUpdate(fx, r, [boom(cellOf(5, 5))]); fxUpdate(fx, r, []); }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect([a.dx, a.dy]).toEqual([b.dx, b.dy]);
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/client/fx-update.test.ts` → FAIL (módulos inexistentes).
- [ ] **Step 3: `coords.ts`**
```ts
import { colOf, linOf, px } from '../../core';

/** Centro da casa no canvas de base (o mesmo mapeamento de draw-game.ts: tile em 16·col − 8, 16·lin + 24). */
export const cellX = (cell: number): number => 16 * colOf(cell);
export const cellY = (cell: number): number => 16 * linOf(cell) + 32;
/** Centro de uma entidade (1/256 px) no canvas de base; o fallback desenha o sprite 16×16 em px − 7. */
export const entX = (x: number): number => px(x) + 1;
export const entY = (y: number): number => px(y) + 1;
/** Acima desta linha é o HUD: clima, luz e flash não passam dela. */
export const FIELD_TOP = 24;
```
- [ ] **Step 4: `state.ts`**
```ts
import type { RoundState } from '../../core';

export const MAX_PARTS = 600;
export const PART = { SPARK: 1, SMOKE: 2, DEBRIS: 3, DUST: 4, BURST: 5 } as const;

/** Partículas em arrays de tamanho fixo (anel: a nova substitui a mais antiga), tremor, flash e a grade anterior. */
export interface FxState {
  seed: number;
  next: number;
  kind: Uint8Array; color: Uint32Array; age: Int16Array; life: Int16Array;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; g: Float32Array;
  size: Float32Array; grow: Float32Array; ground: Float32Array;
  shake: number; dx: number; dy: number; flash: number;
  round: RoundState | null; prevGrid: Int32Array | null;
  shadowsOff: boolean; costSum: number; costN: number;
}

/** O que a tela de batalha entrega ao `present()` (spec §3.3). */
export interface FxFrame { state: FxState; round: RoundState; drawNoActors(ctx: CanvasRenderingContext2D): void }

export function createFx(seed = 0x5eed): FxState {
  const f32 = () => new Float32Array(MAX_PARTS);
  return {
    seed, next: 0,
    kind: new Uint8Array(MAX_PARTS), color: new Uint32Array(MAX_PARTS), age: new Int16Array(MAX_PARTS), life: new Int16Array(MAX_PARTS),
    x: f32(), y: f32(), vx: f32(), vy: f32(), g: f32(), size: f32(), grow: f32(), ground: f32(),
    shake: 0, dx: 0, dy: 0, flash: 0, round: null, prevGrid: null, shadowsOff: false, costSum: 0, costN: 0,
  };
}

/** mulberry32: 0 ≤ n < 1, só do fx (nunca o RNG do núcleo). */
export function rand(fx: FxState): number {
  let t = (fx.seed = (fx.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const between = (fx: FxState, a: number, b: number): number => a + (b - a) * rand(fx);

export interface Spawn { kind: number; color: number; life: number; x: number; y: number; vx: number; vy: number; g?: number; size: number; grow?: number; ground?: number }

export function spawn(fx: FxState, p: Spawn): void {
  const i = fx.next;
  fx.next = (i + 1) % MAX_PARTS;
  fx.kind[i] = p.kind; fx.color[i] = p.color; fx.age[i] = 0; fx.life[i] = p.life;
  fx.x[i] = p.x; fx.y[i] = p.y; fx.vx[i] = p.vx; fx.vy[i] = p.vy; fx.g[i] = p.g ?? 0;
  fx.size[i] = p.size; fx.grow[i] = p.grow ?? 0; fx.ground[i] = p.ground ?? Infinity;
}

export function liveCount(fx: FxState): number {
  let n = 0;
  for (let i = 0; i < MAX_PARTS; i++) if (fx.age[i] < fx.life[i]) n++;
  return n;
}

export function clearFx(fx: FxState): void {
  fx.life.fill(0); fx.age.fill(0); fx.next = 0;
  fx.shake = 0; fx.dx = 0; fx.dy = 0; fx.flash = 0; fx.shadowsOff = false; fx.costSum = 0; fx.costN = 0;
}
```
- [ ] **Step 5: `update.ts`**
```ts
import { BURN, CODE, type GameEvent, type RoundState } from '../../core';
import { PLAYER_COLORS } from '../draw-game';
import { cellX, cellY, entX, entY } from './coords';
import { PART, between, clearFx, rand, spawn, type FxState } from './state';

export const DEBRIS_COLOR = 0x8a6a3a;
const SHAKE_ADD = 2.5, SHAKE_MAX = 6, SHAKE_DECAY = 0.85, SHAKE_MIN = 0.3;
const FLASH_TICKS = 6;
const SPARK_COLORS = [0xfff2a0, 0xffc040, 0xff8a2a];
const hex = (s: string): number => Number.parseInt(s.slice(1), 16);

function explosion(fx: FxState, cell: number): void {
  const x = cellX(cell), y = cellY(cell);
  for (let k = 0; k < 18; k++) {
    const a = rand(fx) * Math.PI * 2, v = between(fx, 1.5, 3);
    spawn(fx, { kind: PART.SPARK, color: SPARK_COLORS[k % 3], life: Math.round(between(fx, 14, 24)),
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.08, size: between(fx, 1, 2) });
  }
  for (let k = 0; k < 6; k++) {
    spawn(fx, { kind: PART.SMOKE, color: 0x5a5a60, life: Math.round(between(fx, 36, 48)),
      x: x + between(fx, -6, 6), y: y + between(fx, -6, 6), vx: between(fx, -0.2, 0.2), vy: -0.3, size: 3, grow: 0.17 });
  }
  fx.shake = Math.min(SHAKE_MAX, fx.shake + SHAKE_ADD);
}

function debris(fx: FxState, cell: number, color: number): void {
  const x = cellX(cell), y = cellY(cell);
  for (let k = 0; k < 8; k++) {
    spawn(fx, { kind: PART.DEBRIS, color, life: 30, x: x + between(fx, -5, 5), y: y + between(fx, -5, 5),
      vx: between(fx, -1.4, 1.4), vy: between(fx, -3, -1.5), g: 0.2, size: between(fx, 2, 3), ground: y + 6 });
  }
}

function dust(fx: FxState, cell: number): void {
  const x = cellX(cell), y = cellY(cell) + 6;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    spawn(fx, { kind: PART.DUST, color: 0xd8c8a0, life: 16, x, y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 0.5, size: 2, grow: 0.1 });
  }
}

function burst(fx: FxState, round: RoundState, slot: number): void {
  const p = round.players[slot];
  const x = entX(p.x), y = entY(p.y) - 8 - p.z, color = hex(PLAYER_COLORS[slot]);
  for (let k = 0; k < 24; k++) {
    const a = rand(fx) * Math.PI * 2, v = between(fx, 0.8, 2.4);
    spawn(fx, { kind: PART.BURST, color, life: 30, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, g: 0.05, size: between(fx, 1.5, 2.5) });
  }
  fx.flash = 1;
}

/** Um tick de 60 Hz dos efeitos (spec §3.3): física, eventos → partículas/flash/tremor, decaimentos. */
export function fxUpdate(fx: FxState, round: RoundState, events: readonly GameEvent[], colorAt: (cell: number) => number = () => DEBRIS_COLOR): void {
  if (fx.round !== round) { clearFx(fx); fx.round = round; fx.prevGrid = Int32Array.from(round.grid); }
  for (let i = 0; i < fx.life.length; i++) {
    if (fx.age[i] >= fx.life[i]) continue;
    fx.age[i]++;
    fx.x[i] += fx.vx[i]; fx.y[i] += fx.vy[i]; fx.vy[i] += fx.g[i]; fx.size[i] += fx.grow[i];
    if (fx.y[i] > fx.ground[i]) { fx.y[i] = fx.ground[i]; fx.vy[i] *= -0.4; fx.vx[i] *= 0.6; }
  }
  const prev = fx.prevGrid!;
  if (round.phase !== 'timeUp' && round.phase !== 'over') {
    for (const e of events) {
      if (e.type === 'explosion') explosion(fx, e.cell);
      else if (e.type === 'player_hit') burst(fx, round, e.slot);
      else if (e.type === 'bomb_landed') dust(fx, e.cell);
    }
    for (let c = 0; c < round.grid.length; c++) {
      if (round.grid[c] === CODE.BURNING && prev[c] !== CODE.BURNING && round.cellAux[c] === BURN.SOFT) debris(fx, c, colorAt(c));
    }
  }
  prev.set(round.grid);
  fx.shake *= SHAKE_DECAY;
  if (fx.shake < SHAKE_MIN) fx.shake = 0;
  fx.dx = fx.shake ? (rand(fx) * 2 - 1) * fx.shake : 0;
  fx.dy = fx.shake ? (rand(fx) * 2 - 1) * fx.shake : 0;
  fx.flash = Math.max(0, fx.flash - 1 / FLASH_TICKS);
}
```
- [ ] **Step 6:** `npx vitest run tests/client/fx-update.test.ts` → PASS. (O teste de "flash zera" depende de 6 decrementos de 1/6 chegarem a 0: o `Math.max(0, …)` cobre o erro de ponto flutuante só se cair abaixo de 0; se sobrar resíduo, trocar por `fx.flash = fx.flash > 1 / FLASH_TICKS + 1e-9 ? fx.flash - 1 / FLASH_TICKS : 0`.)
- [ ] **Step 7:** commit `feat(fx): estado e atualização dos efeitos da batalha`.

### Task 3: Máscara de chão das sombras

**Files:**
- Create: `web/src/render/fx/mask.ts`
- Test: `web/tests/client/fx-mask.test.ts`

**Interfaces:** Produces `groundMask(withActors: Uint8ClampedArray, without: Uint8ClampedArray, out: Uint8ClampedArray): void`
(RGBA do mesmo tamanho; `out` alfa 255 onde iguais, 0 onde diferem; RGB = 0).

- [ ] **Step 1: teste**
```ts
import { groundMask } from '../../src/render/fx/mask';

describe('groundMask', () => {
  it('opaco onde os dois quadros batem, transparente onde um sprite cobre o chão', () => {
    const chao = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 255, 1, 2, 3, 255]);
    const com = new Uint8ClampedArray([10, 20, 30, 255, 99, 20, 30, 255, 1, 2, 4, 255]);
    const out = new Uint8ClampedArray(12);
    groundMask(com, chao, out);
    expect(Array.from(out)).toEqual([0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
```
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:**
```ts
/** Spec §4.4: alfa 255 onde o quadro com atores e o sem atores são iguais (chão à vista), 0 onde algum sprite cobre. */
export function groundMask(withActors: Uint8ClampedArray, without: Uint8ClampedArray, out: Uint8ClampedArray): void {
  for (let i = 0; i < out.length; i += 4) {
    const same = withActors[i] === without[i] && withActors[i + 1] === without[i + 1] && withActors[i + 2] === without[i + 2];
    out[i] = out[i + 1] = out[i + 2] = 0;
    out[i + 3] = same ? 255 : 0;
  }
}
```
- [ ] **Step 4:** rodar → PASS. **Step 5:** commit `feat(fx): máscara de chão das sombras`.

### Task 4: Display em duas camadas, `present()` e ligação com a batalha

**Files:**
- Modify: `web/src/render/display.ts`, `web/src/main.ts`, `web/src/app/app.ts` (`Screen.fx?`),
  `web/src/screens/battle.ts`, `web/src/render/draw-game.ts` (`drawRound` opção `actors`),
  `web/src/render/rom/battle.ts` (`drawRomBattle` repassa `BuildOpts`)
- Create: `web/src/render/fx/present.ts`, `web/src/render/fx/draw.ts` (Task 5 preenche os efeitos; aqui só tremor)

**Interfaces:**
- Produces: `createDisplay(canvas): Display` com `{ ctx, out, scale() }`; `sampleBase(x, y, dflt): number`;
  `present(d: Display, frame: FxFrame | null, fade: number): void`; `drawFx(out, frame, base, fade): void`;
  `Screen.fx?(): FxFrame | null`; `drawRound(..., crowns, opts?: { actors?: boolean })`;
  `drawRomBattle(ctx, round, vis, assets, frame, opts?: BuildOpts)`.

- [ ] **Step 1: `display.ts`**
```ts
export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** `ctx` = canvas de base 256×224 (fora da tela), onde todo o jogo desenha; `out` = o #screen em resolução nativa. */
export interface Display { ctx: CanvasRenderingContext2D; out: CanvasRenderingContext2D; scale(): number }

let base: CanvasRenderingContext2D | null = null;

/** Canvas visível = 256×224 × o maior inteiro que cabe na janela (× DPR); a base é ampliada nele por `present()`. */
export function createDisplay(canvas: HTMLCanvasElement): Display {
  const b = document.createElement('canvas');
  b.width = SCREEN_W; b.height = SCREEN_H;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  base = ctx;
  const out = canvas.getContext('2d')!;
  let s = 1;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    s = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / SCREEN_W, (window.innerHeight * dpr) / SCREEN_H)));
    canvas.width = SCREEN_W * s;
    canvas.height = SCREEN_H * s;
    canvas.style.width = `${(SCREEN_W * s) / dpr}px`;
    canvas.style.height = `${(SCREEN_H * s) / dpr}px`;
    out.imageSmoothingEnabled = false;   // redimensionar o canvas reseta o contexto
  };
  window.addEventListener('resize', fit);
  fit();
  return { ctx, out, scale: () => s };
}

/** Cor 0xRRGGBB de um pixel do canvas de base (`dflt` fora do navegador). */
export function sampleBase(x: number, y: number, dflt: number): number {
  if (!base) return dflt;
  const d = base.getImageData(x, y, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
```
- [ ] **Step 2: `fx/present.ts`**
```ts
import { SCREEN_H, SCREEN_W, type Display } from '../display';
import { drawFx } from './draw';
import type { FxFrame } from './state';

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Base ampliada (com tremor) e, na batalha, os efeitos por cima (spec §3.1). `fade` = brilho do App / 15. */
export function present(d: Display, frame: FxFrame | null, fade: number): void {
  const { out } = d, s = d.scale();
  const shake = frame && !reduced?.matches;
  const ox = shake ? frame.state.dx * s : 0, oy = shake ? frame.state.dy * s : 0;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  if (ox || oy) { out.fillStyle = '#000'; out.fillRect(0, 0, SCREEN_W * s, SCREEN_H * s); }
  out.drawImage(d.ctx.canvas, ox, oy, SCREEN_W * s, SCREEN_H * s);
  if (!frame) return;
  out.setTransform(s, 0, 0, s, ox, oy);   // os efeitos desenham em pixels de base, rasterizados em resolução nativa
  drawFx(out, frame, d.ctx, fade);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
}
```
- [ ] **Step 3: `fx/draw.ts` provisório** (Task 5 substitui):
```ts
import type { FxFrame } from './state';
export function drawFx(_out: CanvasRenderingContext2D, _frame: FxFrame, _base: CanvasRenderingContext2D, _fade: number): void {}
```
- [ ] **Step 4: `app.ts`** — em `Screen`, depois de `frozen?()`:
```ts
  /** Efeitos visuais por cima da base (spec 2026-10-01); só a batalha implementa. */
  fx?(): FxFrame | null;
```
  com `import type { FxFrame } from '../render/fx/state';`.
- [ ] **Step 5: `draw-game.ts`** — `drawRound(..., crowns: number[], opts: { actors?: boolean } = {})`. Com `actors === false`:
  pula camadas `mounts`/`costume` de `fallbackLayers`, bombas, flyers, jogadores, Bad Bombers e todas as `fallbackOverLayers`:
```ts
  const actors = opts.actors !== false;
  for (const l of fallbackLayers) if (actors || !ACTOR_LAYERS.has(l.id)) l.draw(round, ctx, bank, frame);
  if (actors) {
    ... (bombas, flyers, jogadores, bad, over layers — o bloco atual, sem mudança)
  }
  drawHud(...);
```
  com `const ACTOR_LAYERS = new Set(['mounts', 'costume']);` no topo.
- [ ] **Step 6: `rom/battle.ts`** — `drawRomBattle(ctx, round, vis, assets, frame, opts: BuildOpts = {})` e
  `buildBattleFrame(round, vis, assets, frame, opts)`.
- [ ] **Step 7: `battle.ts`**
  - imports: `createFx, type FxFrame` de `../render/fx/state`; `fxUpdate, DEBRIS_COLOR` de `../render/fx/update`;
    `cellX, cellY` de `../render/fx/coords`; `sampleBase` de `../render/display`.
  - depois de `const view = createView();`:
```ts
  const fx = createFx();
  let last: { bank: SpriteBank; frame: number } | null = null;
  const NO_ACTORS = { sprites: false, layers: [] };
  const fxFrame: FxFrame = {
    state: fx, round,
    drawNoActors(ctx) {
      if (!last) return;
      const a = romState.assets, crowns = crownsOf(ms.match);
      if (!(a && drawRomBattle(ctx, round, { crowns }, a, last.frame, NO_ACTORS))) {
        drawRound(ctx, round, view, last.bank, ms.cfg.chars, last.frame, [...crowns], { actors: false });
      }
      drawBombLevels(ctx, last.bank, round);
      drawBattleOverlays(ctx, last.bank, { paused, disconnected, ...banners() });
    },
  };
```
  - em `update`, depois de `updateView(view, round, ev);`:
    `fxUpdate(fx, round, ev, c => sampleBase(cellX(c), cellY(c), DEBRIS_COLOR));`
  - no objeto devolvido: `fx: () => (app.settings.options.fx ? fxFrame : null),`
  - em `draw`, primeira linha: `last = { bank, frame };`
- [ ] **Step 8: `main.ts`**
```ts
const display = createDisplay(document.getElementById('screen') as HTMLCanvasElement);
const ctx = display.ctx;
// ?fx=0 desliga os efeitos nesta sessão (debug e capturas fiéis).
const fxOff = params.get('fx') === '0';
const render = (): void => {
  app.draw(ctx, bank);
  present(display, fxOff ? null : app.screen.fx?.() ?? null, app.brightness() / 15);
};
```
  e trocar as duas chamadas `app.draw(ctx, bank)` (gancho `step` e `startLoop`) por `render()`.
- [ ] **Step 9:** `npx tsc --noEmit && npm test` → PASS.
- [ ] **Step 10:** commit `feat(fx): canvas de base + present em resolução nativa, tremor na batalha`.

### Task 5: Desenho dos efeitos

**Files:**
- Create: `web/src/render/fx/sprites.ts`, `web/src/render/fx/ambient.ts`, `web/src/render/fx/shadows.ts`
- Modify: `web/src/render/fx/draw.ts`

**Interfaces:** Consumes `FxFrame`, `groundMask`, coordenadas e `PART` das Tasks 2–3.

- [ ] **Step 1: `sprites.ts`** — sprites suaves pré-renderizados, criados sob demanda:
```ts
const cache = new Map<string, HTMLCanvasElement>();

/** Disco radial 64×64: `stops` = [posição, 'rgba(...)'][], usado escalado para luz, halo, fumaça e sombra. */
export function radial(key: string, stops: readonly (readonly [number, string])[]): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  cache.set(key, c);
  return c;
}
export const rgb = (c: number): string => `${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}`;
export const flameLight = () => radial('flame', [[0, 'rgba(255, 240, 170, 1)'], [0.35, 'rgba(255, 170, 60, 0.6)'], [1, 'rgba(255, 90, 20, 0)']]);
export const halo = (c: number) => radial(`halo${c}`, [[0, `rgba(${rgb(c)}, 0.9)`], [1, `rgba(${rgb(c)}, 0)`]]);
export const puff = () => radial('puff', [[0, 'rgba(90, 90, 96, 0.55)'], [1, 'rgba(90, 90, 96, 0)']]);
export const shadowBlob = () => radial('shadow', [[0, 'rgba(0, 0, 0, 0.4)'], [0.6, 'rgba(0, 0, 0, 0.3)'], [1, 'rgba(0, 0, 0, 0)']]);
```
- [ ] **Step 2: `ambient.ts`**
```ts
/** Clima por arena (1..10, spec §4.7): cor multiplicada sobre o campo e força 0..0,25. Ajustar jogando. */
export const AMBIENT: Record<number, readonly [number, number]> = {
  1: [0x9fb0c8, 0.12], 2: [0xd8b890, 0.12], 3: [0xe8c8a0, 0.10], 4: [0x90a890, 0.20], 5: [0xc8a080, 0.15],
  6: [0xa8b8e0, 0.12], 7: [0x88a8a0, 0.20], 8: [0xf0e0f0, 0.06], 9: [0x8080b0, 0.25], 10: [0xb090d0, 0.18],
};
/** Cor de `multiply` equivalente a aplicar `color` com força `k` (k = 0 → branco, sem efeito). */
export function ambientFill(stage: number, fade: number): string | null {
  const a = AMBIENT[stage];
  if (!a) return null;
  const k = Math.min(0.25, a[1]) * fade;
  const ch = (v: number) => Math.round(255 - (255 - v) * k);
  return `rgb(${ch((a[0] >> 16) & 255)}, ${ch((a[0] >> 8) & 255)}, ${ch(a[0] & 255)})`;
}
```
- [ ] **Step 3: `shadows.ts`**
```ts
import { SCREEN_H, SCREEN_W } from '../display';
import { entX, entY } from './coords';
import { groundMask } from './mask';
import { shadowBlob } from './sprites';
import type { FxFrame } from './state';

let noAct: CanvasRenderingContext2D | null = null, mask: CanvasRenderingContext2D | null = null, maskImg: ImageData | null = null;
let layer: CanvasRenderingContext2D | null = null;
const canvas2d = (w: number, h: number, read = false) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c.getContext('2d', { willReadFrequently: read })!;
};

function blob(g: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  const k = Math.max(0.3, 1 - height / 48);
  g.globalAlpha = k;
  g.drawImage(shadowBlob(), x - 7 * k, y - 3 * k, 14 * k, 6 * k);
}

/** Sombras sob jogadores, bombas e objetos em voo, recortadas pela máscara de chão (spec §4.4). */
export function drawShadows(out: CanvasRenderingContext2D, frame: FxFrame, base: CanvasRenderingContext2D, fade: number, s: number): void {
  noAct ??= canvas2d(SCREEN_W, SCREEN_H, true);
  mask ??= canvas2d(SCREEN_W, SCREEN_H);
  maskImg ??= mask.createImageData(SCREEN_W, SCREEN_H);
  if (!layer || layer.canvas.width !== SCREEN_W * s) layer = canvas2d(SCREEN_W * s, SCREEN_H * s);
  noAct.clearRect(0, 0, SCREEN_W, SCREEN_H);
  frame.drawNoActors(noAct);
  groundMask(base.getImageData(0, 0, SCREEN_W, SCREEN_H).data, noAct.getImageData(0, 0, SCREEN_W, SCREEN_H).data, maskImg.data);
  mask.putImageData(maskImg, 0, 0);

  const g = layer, r = frame.round;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  for (const p of r.players) if (p.present && p.state === 'alive') blob(g, entX(p.x), entY(p.y) + 6, p.z);
  for (const b of r.bombs) if (b.state === 'idle' || b.state === 'kicked') blob(g, entX(b.x), entY(b.y) + 5, 0);
  for (const f of r.flyers) if (f.kind !== 'player') blob(g, entX(f.x), entY(f.y) + 5, -f.z);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = false;
  g.drawImage(mask.canvas, 0, 0, SCREEN_W, SCREEN_H);

  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = fade;
  out.drawImage(g.canvas, 0, 0, SCREEN_W, SCREEN_H);
}
```
- [ ] **Step 4: `draw.ts`** (substitui o provisório)
```ts
import { CODE, FLAME_PIECE, FLAME_TICKS, ITEM, isEggCode, isItemCode, itemOfCode } from '../../core';
import { SCREEN_H, SCREEN_W } from '../display';
import { ambientFill } from './ambient';
import { FIELD_TOP, cellX, cellY } from './coords';
import { drawShadows } from './shadows';
import { flameLight, halo, puff, rgb } from './sprites';
import { MAX_PARTS, PART, type FxFrame, type FxState } from './state';

const SHADOW_BUDGET_MS = 12, SHADOW_WINDOW = 60;
const LIGHT_R = 24, LIGHT_ALPHA = 0.55, HALO_R = 14;

function itemColor(v: number): number {
  if (isEggCode(v)) return 0xffe08a;
  const id = itemOfCode(v);
  if (id >= 0x20 && id < 0x30) return 0xc77dff;
  if (id === ITEM.FIRE || id === ITEM.FULL_FIRE) return 0xff8a2a;
  if (id === ITEM.BOMB) return 0x4aa0ff;
  if (id === ITEM.SPEED) return 0x5fe07a;
  return 0xffe08a;
}

/** Intensidade da luz pela idade da chama: sobe em 2 ticks e cai até 0 no fim (spec §4.1). */
export function flameIntensity(age: number): number {
  return Math.max(0, Math.min(1, (age + 1) / 2, (FLAME_TICKS - age) / (FLAME_TICKS - 2)));
}

function lights(out: CanvasRenderingContext2D, frame: FxFrame, fade: number): void {
  const r = frame.round;
  out.globalCompositeOperation = 'lighter';
  for (let c = 0; c < r.grid.length; c++) {
    const v = r.grid[c];
    if (v === CODE.FLAME) {
      const k = flameIntensity(r.tick - r.cellT0[c]);
      const rad = r.cellAux[c] === FLAME_PIECE.CENTER ? LIGHT_R * 1.5 : LIGHT_R;
      out.globalAlpha = k * LIGHT_ALPHA * fade;
      out.drawImage(flameLight(), cellX(c) - rad, cellY(c) - rad, rad * 2, rad * 2);
    } else if (isItemCode(v)) {
      out.globalAlpha = (0.375 + 0.125 * Math.sin((r.tick / 60) * Math.PI * 2)) * fade;
      out.drawImage(halo(itemColor(v)), cellX(c) - HALO_R, cellY(c) - HALO_R, HALO_R * 2, HALO_R * 2);
    }
  }
}

function particles(out: CanvasRenderingContext2D, fx: FxState, fade: number): void {
  for (let i = 0; i < MAX_PARTS; i++) {
    if (fx.age[i] >= fx.life[i]) continue;
    const t = 1 - fx.age[i] / fx.life[i], k = fx.kind[i], sz = fx.size[i];
    out.globalAlpha = t * fade;
    if (k === PART.SMOKE) {
      out.globalCompositeOperation = 'source-over';
      out.drawImage(puff(), fx.x[i] - sz, fx.y[i] - sz, sz * 2, sz * 2);
      continue;
    }
    out.globalCompositeOperation = k === PART.SPARK ? 'lighter' : 'source-over';
    out.fillStyle = `rgb(${rgb(fx.color[i])})`;
    out.fillRect(fx.x[i] - sz / 2, fx.y[i] - sz / 2, sz, sz);
  }
}

/** Ordem da spec §4.8: sombras → clima → luzes/halo → partículas → flash; tudo abaixo do HUD. */
export function drawFx(out: CanvasRenderingContext2D, frame: FxFrame, base: CanvasRenderingContext2D, fade: number): void {
  const fx = frame.state, s = out.getTransform().a;
  if (!fx.shadowsOff) {
    const t0 = performance.now();
    drawShadows(out, frame, base, fade, s);
    fx.costSum += performance.now() - t0;
    if (++fx.costN === SHADOW_WINDOW) {
      if (fx.costSum / SHADOW_WINDOW > SHADOW_BUDGET_MS) fx.shadowsOff = true;
      fx.costSum = 0; fx.costN = 0;
    }
  }
  out.save();
  out.beginPath();
  out.rect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  out.clip();
  const amb = ambientFill(frame.round.stage, fade);
  if (amb) {
    out.globalCompositeOperation = 'multiply';
    out.globalAlpha = 1;
    out.fillStyle = amb;
    out.fillRect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  }
  lights(out, frame, fade);
  particles(out, fx, fade);
  if (fx.flash > 0) {
    out.globalCompositeOperation = 'source-over';
    out.globalAlpha = fx.flash * 0.35 * fade;
    out.fillStyle = '#ffffff';
    out.fillRect(0, FIELD_TOP, SCREEN_W, SCREEN_H - FIELD_TOP);
  }
  out.restore();
}
```
- [ ] **Step 5: teste de `flameIntensity`** em `fx-update.test.ts`:
```ts
import { flameIntensity } from '../../src/render/fx/draw';
it('luz da chama: sobe em 2 ticks, apaga no fim', () => {
  expect(flameIntensity(0)).toBe(0.5);
  expect(flameIntensity(1)).toBe(1);
  expect(flameIntensity(24)).toBeLessThan(0.05);
  expect(flameIntensity(25)).toBe(0);
});
```
- [ ] **Step 6:** `npx tsc --noEmit && npm test` → PASS.
- [ ] **Step 7:** commit `feat(fx): luz, sombras, partículas, brilho, flash e clima da arena`.

### Task 6: Guarda do núcleo e verificação visual

**Files:**
- Create: `web/tests/client/fx-core-guard.test.ts`
- Modify: `web/scripts/snapshots.mjs` (captura extra com efeitos durante uma explosão)

- [ ] **Step 1: teste**
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

describe('núcleo não depende do render (spec efeitos §2.1)', () => {
  it('nenhum arquivo de src/core importa de render/', () => {
    const bad = walk(join(__dirname, '../../src/core')).filter(f => /from ['"][^'"]*render\//.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/client/fx-core-guard.test.ts` → PASS.
- [ ] **Step 3: snapshots** — ler `scripts/snapshots.mjs`, achar a captura da partida rápida (`?quick`) e acrescentar uma
  captura `fx-explosao` que planta bomba (A) e avança ~140 ticks até a explosão; as capturas existentes ganham `&fx=0`
  para continuarem fiéis.
- [ ] **Step 4:** rodar `npm run snap` sem ROM e com `SB4_ROM="$HOME/Downloads/Super Bomberman 4 (USA).sfc"`; abrir as
  capturas e conferir: luz alinhada às chamas, sombras sob os pés e nunca sobre o sprite, HUD sem escurecer, clima
  visível mas leve.
- [ ] **Step 5:** ajustar constantes se algo estiver desalinhado; `npm test` e `npx tsc --noEmit` verdes; commit
  `test(fx): guarda do núcleo e capturas com efeitos`.
