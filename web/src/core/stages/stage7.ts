import type { StageModule } from '../hooks';
import { CODE, type RoundState } from '../types';
import { cellOf } from '../units';
import { A7_ARROWS } from './tables';
import { flameOver } from './kit';
import { stage7Ai } from '../ai/stages/stage7';

/** Setas da arena 7 ($C3:0EFF, lista $C3:918E): face = palavra − 0x1CC0. */
export const ARROWS = A7_ARROWS.map(([c, l, w]) => ({ cell: cellOf(c, l), face: (w - 0x1cc0) as 0 | 2 | 4 | 6, word: w }));
export const arrowAt = (cell: number) => ARROWS.find(a => a.cell === cell);

function apply(s: RoundState): void {
  for (const a of ARROWS) if (s.grid[a.cell] === CODE.FLOOR) s.grid[a.cell] = CODE.ARROW;
}

/** Arena 7: setas desviam a bomba chutada; moitas são só visuais (BG1, plano 7). */
export const stage7: StageModule = {
  init(s) { apply(s); },
  tick(s) { apply(s); },                                  // devolve a seta quando a chama acaba (gancho $C1:534F)
  onFlameCell(s, cell, armDir) { if (s.grid[cell] === CODE.ARROW) flameOver(s, cell, armDir); },
  kickedBombEnter(_s, _b, cell) { const a = arrowAt(cell); return a ? { turn: a.face } : 'go'; },
  get ai() { return stage7Ai; },
};
