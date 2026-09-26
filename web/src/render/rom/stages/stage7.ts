import { registerRomLayer } from '../../battle-layers';
import { CODE } from '../../../core/types';
import { colOf, linOf } from '../../../core/units';
import { ARROWS } from '../../../core/stages/stage7';

// As setas não estão no mapa de piso: a ROM as repõe por gancho ($C1:534F). Sob chama/bomba, o plano 7 desenha o resto.
registerRomLayer({
  id: 'stage7',
  draw(s, b) {
    if (s.stage !== 7) return;
    for (const a of ARROWS) if (s.grid[a.cell] === CODE.ARROW) b.setBg2(colOf(a.cell), linOf(a.cell), a.word);
  },
});
