import { registerFallbackLayer } from '../../battle-layers';
import { st3 } from '../../../core/stages/stage3';
import { scrX, scrY } from './geom';

registerFallbackLayer({
  id: 'stage3',
  draw(s, ctx) {
    if (s.stage !== 3) return;
    for (const o of st3(s).orbs) {
      if (!o.alive) continue;
      ctx.fillStyle = o.rolling ? '#ffb040' : '#c0c8d8';
      ctx.beginPath();
      ctx.arc(scrX(o.x), scrY(o.y), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
});
