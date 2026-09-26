import { registerFallbackLayer } from '../../battle-layers';
import { st2 } from '../../../core/stages/stage2';
import { cellLeft, cellTop } from './geom';

// Véu leve sobre o campo: vermelho no rápido, azul no lento.
registerFallbackLayer({
  id: 'stage2',
  draw(s, ctx) {
    if (s.stage !== 2) return;
    const m = st2(s).mode;
    if (m === 0) return;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = m === 1 ? '#ff4040' : '#4060ff';
    ctx.fillRect(cellLeft(2), cellTop(1), 13 * 16, 11 * 16);
    ctx.restore();
  },
});
