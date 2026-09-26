import { registerFallbackLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { cellLeft, cellTop } from './geom';

const TINT: Record<number, string> = { 0x1c0a: '#e0c040', 0x1c0c: '#c040e0', 0x1c08: '#40c0e0' };

// Piso repintado: listras (amarelo), caveira (roxo), caveirinhas (ciano), meio transparente sobre o piso.
registerFallbackLayer({
  id: 'stage6',
  draw(s, ctx) {
    if (s.stage !== 6) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    s.floor.forEach((w, c) => {
      const t = TINT[w];
      if (!t || s.grid[c] !== CODE.FLOOR) return;
      ctx.fillStyle = t;
      ctx.fillRect(cellLeft(colOf(c)), cellTop(linOf(c)), 16, 16);
    });
    ctx.restore();
  },
});
