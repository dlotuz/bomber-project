import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { ARROWS } from '../../../core/stages/stage7';
import { cellLeft, cellTop } from './geom';

/** Moitas (spec §4.6), em (col, lin): 36 casas. */
export const BUSHES: [number, number][] = [
  // (7–9, 2–3) + (8, 4)
  [7, 2], [8, 2], [9, 2], [7, 3], [8, 3], [9, 3], [8, 4],
  // (3–5, 5–7) + (3, 4) e (5, 4)
  [3, 5], [4, 5], [5, 5], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [3, 4], [5, 4],
  // (11–13, 5–7) + (11, 4) e (13, 4)
  [11, 5], [12, 5], [13, 5], [11, 6], [12, 6], [13, 6], [11, 7], [12, 7], [13, 7], [11, 4], [13, 4],
  // (7–9, 8–9) + (8, 10)
  [7, 8], [8, 8], [9, 8], [7, 9], [8, 9], [9, 9], [8, 10],
];

registerFallbackLayer({
  id: 'stage7',
  draw(s, ctx) {
    if (s.stage !== 7) return;
    for (const a of ARROWS) {
      if (s.grid[a.cell] !== CODE.ARROW) continue;
      const x = cellLeft(colOf(a.cell)) + 8, y = cellTop(linOf(a.cell)) + 8;
      const ang = (a.face / 2) * (Math.PI / 2);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = '#ffe070';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#2f7a2f';
    for (const [c, l] of BUSHES) ctx.fillRect(cellLeft(c), cellTop(l), 16, 16);
    ctx.restore();
  },
});
