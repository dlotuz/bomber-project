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
