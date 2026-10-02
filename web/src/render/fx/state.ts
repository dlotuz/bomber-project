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
  /** Quadros que faltam com as sombras em pausa (orçamento estourado; voltam a ser tentadas depois). */
  shadowsPause: number; costSum: number; costN: number;
}

/** O que a tela de batalha entrega ao `present()` (spec §3.3). `drawNoActors` desenha o quadro sem atores (sem
 *  jogadores, montarias, trajes nem bombas); com `bombs`, o mesmo quadro só com as bombas (paradas, chutadas e voando)
 *  — a diferença entre os dois é a bomba inteira, e o quadro completo diz que parte dela está à vista. */
export interface FxFrame {
  state: FxState; round: RoundState; drawNoActors(ctx: CanvasRenderingContext2D, bombs?: boolean): void;
  /** O quadro com atores saiu dos sprites da ROM (a sombra suave vai onde a ROM punha a dela); ausente = arte própria. */
  rom?: boolean;
  /** Vagas em que a elipse do sprite da ROM ficou no último quadro (sem a suave). */
  hardShadows?: ReadonlySet<number>;
}

export function createFx(seed = 0x5eed): FxState {
  const f32 = () => new Float32Array(MAX_PARTS);
  return {
    seed, next: 0,
    kind: new Uint8Array(MAX_PARTS), color: new Uint32Array(MAX_PARTS), age: new Int16Array(MAX_PARTS), life: new Int16Array(MAX_PARTS),
    x: f32(), y: f32(), vx: f32(), vy: f32(), g: f32(), size: f32(), grow: f32(), ground: f32(),
    shake: 0, dx: 0, dy: 0, flash: 0, round: null, prevGrid: null, shadowsPause: 0, costSum: 0, costN: 0,
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
  fx.shake = 0; fx.dx = 0; fx.dy = 0; fx.flash = 0; fx.shadowsPause = 0; fx.costSum = 0; fx.costN = 0;
}
