import type { Cue, TransitionSpec } from './app';

const range = (a: number, b: number): number[] => {
  const s = a <= b ? 1 : -1; const r: number[] = [];
  for (let v = a; v !== b + s; v += s) r.push(v);
  return r;
};
const twice = (v: number[]): number[] => v.flatMap(x => [x, x]);

/** Saída padrão dos menus: brilho 14→0, 1 passo por frame (15 f). */
export const FADE_OUT_1: readonly number[] = range(14, 0);
export const FADE_IN_1: readonly number[] = range(1, 15);
/** Saída do título: 2 f por passo, preto no frame 28. */
export const FADE_OUT_2: readonly number[] = [...twice(range(14, 1)), 0];
export const FADE_IN_2: readonly number[] = [...twice(range(1, 14)), 15];
/** B na tela VS (volta ao título): 12 f. */
export const FADE_OUT_12: readonly number[] = [14, 13, 11, 10, 9, 8, 6, 5, 4, 3, 1, 0];
/** A entrada das trocas de menu começa 58 f depois do botão [MNT §B.0]. */
export const MENU_ENTRY_AT = 58;

export function fadeSpec(out: readonly number[], inn: readonly number[], cues: readonly Cue[] = [], entryAt = MENU_ENTRY_AT): TransitionSpec {
  return { out, black: Math.max(0, entryAt - out.length), in: inn, cues };
}
export const FADE_MENU: TransitionSpec = fadeSpec(FADE_OUT_1, FADE_IN_1);
export const FADE_FROM_TITLE: TransitionSpec = fadeSpec(FADE_OUT_2, FADE_IN_1);
export const FADE_TO_TITLE: TransitionSpec = fadeSpec(FADE_OUT_12, FADE_IN_2);
