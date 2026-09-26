import type { AiStageHints } from '../hints';
import { CODE } from '../../types';
import { faceStep } from '../../units';
import { playerCell, standing } from '../../stages/kit';
import { arrowAt } from '../../stages/stage7';

/** Onde para a bomba chutada, seguindo as setas (§9 item 8). Para antes de $8400, bomba ou jogador de pé. */
export const stage7Ai: AiStageHints = {
  kickEnd(s, cell, face) {
    let c = cell, f = face;
    for (let i = 0; i < 64; i++) {
      const n = faceStep(c, f);
      const g = s.grid[n] ?? CODE.HARD;
      if (g & 0x8400 || (g & 0xefc0) === CODE.BOMB || s.players.some(p => standing(p) && playerCell(p) === n)) return c;
      c = n;
      f = arrowAt(c)?.face ?? f;
    }
    return c;
  },
};
