import type { AiStageHints } from '../hints';
import { CODE } from '../../types';
import { st3, triggerDir, ORB_STEP } from '../../stages/stage3';

/** Rota das bolas como perigo (§9 item 8): casa → ticks até a bola chegar. Ignora as viradas. */
export const stage3Ai: AiStageHints = {
  danger(s) {
    const out = new Map<number, number>();
    const put = (c: number, t: number) => { const o = out.get(c); if (o === undefined || t < o) out.set(c, t); };
    for (const o of st3(s).orbs) {
      if (!o.alive) continue;
      let dir: number, first: number, n: number;
      if (o.rolling) { dir = o.dir; first = o.stepLeft; n = o.cellsLeft; }
      else if (o.flamedAt >= 0) { const d = triggerDir(s, o); if (d === null) continue; dir = d; first = 17; n = 8; }
      else continue;
      let c = o.cell;
      for (let k = 0; k < n; k++) {
        c += ORB_STEP[dir];
        const g = s.grid[c] ?? CODE.HARD;
        if (g & 0xc000 || (g & 0xefc0) === CODE.BOMB) break;
        put(c, first + 16 * k);
      }
    }
    return out;
  },
};
