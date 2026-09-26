import { defaultRules, type GameEvent, type RoundState } from '../../src/core/types';
import { STAGES } from '../../src/core/stages';
import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import type { BattleObj, RomBattleBuilder } from '../../src/render/battle-layers';
import type { StageRomAssets, RomAnimFrame } from '../../src/render/rom/stages/romkit';
import { arena } from '../core/kit';
export { arena, put, run, runUntil, setCell, codeAt, C } from '../core/kit';

/** Arena vazia do plano 6 (paredes + pilares em col ímpar × lin par) em `play` no tick 100, com o init da arena. */
export function stageArena(stage: number, players = 2, seed = 0x12): RoundState {
  const s = arena({ stage, players, seed });
  STAGES[stage].init?.(s);
  return s;
}

/** Rodada real (remoção, init da arena, itens) com 5 jogadores e semente `seed`, em `intro`. */
export function fullRound(stage: number, seed = 0x12): RoundState {
  return startRound(createMatch(defaultRules(), stage, seed));
}

/** Roda o intro inteiro (62 ticks) e o 1º tick de play. Devolve os eventos desse 1º tick. */
export function toPlay(s: RoundState): GameEvent[] {
  while (s.phase === 'intro') step(s, [0, 0, 0, 0, 0]);
  return step(s, [0, 0, 0, 0, 0]);
}

export type StageEvent = Extract<GameEvent, { type: 'stage' }>;
export const stageEvents = (ev: GameEvent[], id?: string): StageEvent[] =>
  ev.filter((e): e is StageEvent => e.type === 'stage' && (id === undefined || e.id === id));

/** Espelho do LCG para calcular valores esperados sem tocar no estado. */
export function mirror(seed: number) {
  let sd = seed & 0xffff;
  return {
    rnd(n: number): number { sd = ((sd | 1) * 0x383) & 0xffff; return (sd * (n & 0xff)) >>> 16; },
    seed: () => sd,
  };
}

/** Builder falso do plano 7: grava as chamadas. */
export function fakeBuilder() {
  const calls = {
    bg2: new Map<string, number>(), bg1: new Map<string, number>(),
    sprites: [] as { e: BattleObj; sortY: number; order: number }[],
    cgram: new Map<number, number>(), scroll: [] as number[],
  };
  const b: RomBattleBuilder = {
    setBg2: (c, l, w) => { calls.bg2.set(`${c},${l}`, w); },
    setBg1: (c, l, w) => { calls.bg1.set(`${c},${l}`, w); },
    sprite: (e, sortY, order) => { calls.sprites.push({ e, sortY, order }); },
    cgram: (i, v) => { calls.cgram.set(i, v); },
    bg1Scroll: h => { calls.scroll.push(h); },
  };
  return { b, calls };
}

/** RomAssets falso: u16(a) = a & 0x7fff; anim(a) = 2 quadros de 1 peça (tile = a & 0xff, depois +1). */
export function fakeAssets(): StageRomAssets {
  return {
    rom: { u8: a => a & 0xff, u16: a => a & 0x7fff },
    anim: (a: number): RomAnimFrame[] => [
      { dur: 4, mx: 0, my: 0, pieces: [{ dx: -8, dy: -8, tile: a & 0xff, hflip: false, vflip: false, big: false, palAdd: 0 }] },
      { dur: 4, mx: 0, my: 0, pieces: [{ dx: -8, dy: -8, tile: (a & 0xff) + 1, hflip: false, vflip: false, big: false, palAdd: 0 }] },
    ],
  };
}

/** Contexto 2D falso: grava o nome de cada método chamado. */
export function fakeCtx(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(t, k) { if (typeof k === 'string' && k in t) return t[k]; return (..._a: unknown[]) => { log.push(String(k)); }; },
    set(t, k, v) { t[String(k)] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}
