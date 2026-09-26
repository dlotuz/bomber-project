import type { AiStageHints } from '../hints';
import { playerCell, standing } from '../../stages/kit';
import { st9 } from '../../stages/stage9';

/** Evitar ponta de gangorra com adversário em cima dela (§9 item 8). */
export const stage9Ai: AiStageHints = {
  avoid(s, slot) {
    const out: number[] = [];
    for (const w of st9(s).saws) {
      const cells = [w.a, w.a + 1, w.b];
      if (s.players.some(p => p.slot !== slot && standing(p) && cells.includes(playerCell(p)))) out.push(w.a, w.b);
    }
    return out;
  },
};
