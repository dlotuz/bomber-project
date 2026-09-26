import { registerRomLayer } from '../../battle-layers';
import { A10_PAL } from '../../../core/stages/tables';
import { assetsOf, writePaletteFrame } from './romkit';

registerRomLayer({
  id: 'stage10',
  draw(s, b, a0) { if (s.stage !== 10) return; writePaletteFrame(b, assetsOf(a0), A10_PAL, 4, 15, s.tick, 80); },
});
