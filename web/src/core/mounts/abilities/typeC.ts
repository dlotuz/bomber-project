import type { MountAbility } from '../types';
import { cellAt, placeBombAt } from '../core-api';
import { mev } from '../events';

const STEP: Readonly<Record<number, number>> = { 0: -17, 2: 1, 4: 17, 6: -1 };

/** Tipo C: Y = todas as bombas disponíveis em linha ($C2:47D3, objeto $C1:1E75). */
export const ABILITY_C: MountAbility = {
  type: 0xc,
  onY(s, p, _r, ev) {
    if (p.disease === 0x24 || p.disease === 0x25) return true;
    let cell = cellAt(p.x, p.y), n = 0;
    while (p.bombsFree > 0 && cell >= 0 && cell < s.grid.length && s.grid[cell] === 0) {
      if (!placeBombAt(s, p, cell, ev)) break;
      cell += STEP[p.face]; n++;
    }
    if (n > 0) ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xc }));
    return true;
  },
};
