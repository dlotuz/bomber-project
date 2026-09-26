import { registerRomLayer } from '../../battle-layers';
import { colOf, linOf } from '../../../core/units';
import { st9, sawWords } from '../../../core/stages/stage9';
import { A9_PAL } from '../../../core/stages/tables';
import { assetsOf, writePaletteFrame } from './romkit';

registerRomLayer({
  id: 'stage9',
  draw(s, b, a0) {
    if (s.stage !== 9) return;
    for (const w of st9(s).saws) {
      const words = sawWords(w, s.tick);
      [w.a, w.a + 1, w.b].forEach((c, i) => b.setBg2(colOf(c), linOf(c), words[i]));
    }
    writePaletteFrame(b, assetsOf(a0), A9_PAL, 6, 14, s.tick, 80);   // paleta 5: 6 quadros, 14 ticks, ciclo 84
  },
});
