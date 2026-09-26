import { CODE } from './types';
import { cellOf } from './units';
import { STAGE_FACTS } from './tables/stages';

/** Miniatura da grade-base de cada fase (campo 13 × 11): # duro, x soft, . piso, ? especial. */
export const LAYOUTS: string[][] = STAGE_FACTS.map(f => Array.from({ length: 11 }, (_, r) =>
  Array.from({ length: 13 }, (_, c) => {
    const v = f.base[cellOf(c + 2, r + 1)];
    return v === CODE.HARD ? '#' : v === CODE.SOFT ? 'x' : v === CODE.FLOOR ? '.' : '?';
  }).join('')));
