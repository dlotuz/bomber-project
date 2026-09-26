import { registerFallbackLayer } from '../../battle-layers';
import { cellLeft, cellTop } from './geom';

// Cerca elétrica em volta do campo, piscando a cada 9 ticks (ritmo do pilar animado da ROM).
registerFallbackLayer({
  id: 'stage5',
  draw(s, ctx) {
    if (s.stage !== 5) return;
    ctx.save();
    ctx.strokeStyle = (s.tick / 9) & 1 ? '#fff27a' : '#7ad8ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellLeft(2) - 1, cellTop(1) - 1, 13 * 16 + 2, 11 * 16 + 2);
    ctx.restore();
  },
});
