import type { FlamePieceName } from '../rom/scene';

export interface ScriptStep { word: number; dur: number }

/** O 1º quadro da bomba dura 2 ticks a menos (medido 18 de 20, ANI §5.1). */
export const BOMB_SHIFT = 2;

/** Palavra do script de bomba na idade `age` (ticks desde `born`); o script dá a volta. */
export function scriptWord(script: readonly ScriptStep[], age: number): number {
  if (script.length === 0) throw new Error('script de bomba vazio');
  const total = script.reduce((n, s) => n + s.dur, 0);
  let t = Math.max(0, age) + BOMB_SHIFT;
  if (total > 0) t %= total;
  for (const s of script) {
    if (t < s.dur) return s.word;
    t -= s.dur;
  }
  return script[script.length - 1].word;
}

/** Fase por idade 0..24: A2 B2 C2 B2 C2 B2 C2 B2 C2 B2 C2 B2 A1 (0 = A, 1 = B, 2 = C). */
export const FLAME_PHASE: readonly number[] = [0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 0];

/** Palavra da fase A de cada peça (pal. 3; ANI §6). */
export const FLAME_BASE: Readonly<Record<FlamePieceName, number>> = {
  center: 0x0f6c, armR: 0x0f6a, armL: 0x4f6a, armU: 0x0f68, armD: 0x8f68,
  tipR: 0x0f66, tipL: 0x4f66, tipU: 0x0f60, tipD: 0x8f60,
};

export function flameWord(piece: FlamePieceName, age: number): number {
  const a = Math.min(24, Math.max(0, age));
  return FLAME_BASE[piece] + 0x20 * FLAME_PHASE[a];
}

export function softBurnWord(age: number): number {
  return 0x0c20 + 2 * Math.min(5, Math.floor(Math.max(0, age) / 4));
}

/** null = já acabou (piso). */
export function itemBurnWord(age: number): number | null {
  const k = Math.floor(Math.max(0, age) / 4);
  return k < 5 ? 0x0f2e + 0x20 * k : null;
}
