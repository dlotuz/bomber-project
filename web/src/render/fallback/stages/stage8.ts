import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { st8, PADS, sym, PAD_LIT } from '../../../core/stages/stage8';
import { cellLeft, cellTop, scrX, scrY } from './geom';

const SYM_COLOR = ['#e04040', '#40c040', '#4080ff', '#ffd040'];

registerFallbackLayer({
  id: 'stage8',
  draw(s, ctx) {
    if (s.stage !== 8) return;
    const a = st8(s);
    for (const c of PADS) {
      if (s.grid[c] !== CODE.PAD) continue;
      ctx.fillStyle = s.floor[c] === PAD_LIT ? '#ffe060' : '#806020';
      ctx.fillRect(cellLeft(colOf(c)) + 3, cellTop(linOf(c)) + 3, 10, 10);
    }
    a.reels.forEach((r, i) => {                         // 3 janelas na parede de cima, cols 7..9
      ctx.fillStyle = '#101010';
      ctx.fillRect(cellLeft(7 + i), cellTop(0), 16, 16);
      ctx.fillStyle = SYM_COLOR[sym(r)];
      ctx.fillRect(cellLeft(7 + i) + 4, cellTop(0) + 4, 8, 8);
    });
    for (const f of a.falls) {
      ctx.fillStyle = f.kind === 'bomb' ? '#202020' : '#f0f0f0';
      ctx.beginPath(); ctx.arc(scrX(f.x), scrY(f.y), 5, 0, Math.PI * 2); ctx.fill();
    }
  },
});
