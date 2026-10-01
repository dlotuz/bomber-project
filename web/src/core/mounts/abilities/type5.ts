import type { MountAbility } from '../types';
import { BURN, CODE, type RoundState } from '../../types';
import { burnCell } from '../../bombs';
import { cellOf } from '../../units';
import { mstate } from '../types';

/** Caminho de $C1:724E: espiral horária de fora para dentro no campo (colunas 2–14, linhas 1–11), a partir de (2,1). */
export const SWEEP_PATH: readonly number[] = (() => {
  const out: number[] = [];
  let c0 = 2, c1 = 14, l0 = 1, l1 = 11;
  while (c0 <= c1 && l0 <= l1) {
    for (let c = c0; c <= c1; c++) out.push(cellOf(c, l0));
    for (let l = l0 + 1; l <= l1; l++) out.push(cellOf(c1, l));
    if (l0 < l1) for (let c = c1 - 1; c >= c0; c--) out.push(cellOf(c, l1));
    if (c0 < c1) for (let l = l1 - 1; l > l0; l--) out.push(cellOf(c0, l));
    c0++; c1--; l0++; l1--;
  }
  return out;
})();

/** Tipo 5: Y ($C2:46AF), se ainda há bloco macio ($90 ≠ 0), cria o objeto $C1:6A3F, que a partir do tick seguinte
 *  percorre SWEEP_PATH 1 casa por tick e queima cada bloco macio ($C1:4288). Um 2º Y cria outro objeto. */
export const ABILITY_5: MountAbility = {
  type: 0x5,
  onY(s) {
    if (!s.grid.some(v => v === CODE.SOFT)) return false;
    (mstate(s).sweeps ??= []).push({ i: 0, born: s.tick });
    return true;
  },
};

export function tickSweeps(s: RoundState): void {
  const ms = mstate(s);
  if (!ms.sweeps?.length) return;
  for (const w of ms.sweeps) {
    if (w.born === s.tick) continue;
    const cell = SWEEP_PATH[w.i++];
    if (s.grid[cell] === CODE.SOFT) burnCell(s, cell, BURN.SOFT);
  }
  ms.sweeps = ms.sweeps.filter(w => w.i < SWEEP_PATH.length);
}
