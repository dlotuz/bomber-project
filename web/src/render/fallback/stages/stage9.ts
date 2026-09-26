import { registerFallbackLayer } from '../../battle-layers';
import { colOf, linOf } from '../../../core/units';
import { st9, upEnd } from '../../../core/stages/stage9';
import { cellLeft, cellTop } from './geom';

// Prancha de 3 casas inclinada para o lado da ponta de baixo.
registerFallbackLayer({
  id: 'stage9',
  draw(s, ctx) {
    if (s.stage !== 9) return;
    ctx.save();
    ctx.strokeStyle = '#c08040';
    ctx.lineWidth = 3;
    for (const w of st9(s).saws) {
      const x0 = cellLeft(colOf(w.a)) + 2, x1 = cellLeft(colOf(w.b)) + 14, y = cellTop(linOf(w.a)) + 8;
      const aUp = upEnd(w) === w.a;
      ctx.beginPath();
      ctx.moveTo(x0, y + (aUp ? -5 : 5)); ctx.lineTo(x1, y + (aUp ? 5 : -5));
      ctx.stroke();
    }
    ctx.restore();
  },
});
