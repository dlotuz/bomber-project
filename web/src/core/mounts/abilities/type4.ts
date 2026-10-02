import type { MountAbility } from '../types';
import { BTN, type Bomb } from '../../types';
import { moveStep } from '../../movement';
import { speedLevel } from '../../disease';
import { redirectRoller } from '../../kick';

/** Investida: 4 px por tick ($C2:26E0 simula o direcional da face, $C2:47C1, e chama o movimento normal $C2:2F3A). */
export const DASH_SPEED = 4 * 256;
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];

/** Tipo 4: Y dispara a investida ($C2:4691). Sem bomba nem virar durante; para no tick em que não sai do lugar
 *  (parede, bloco, bomba; atravessa jogadores) e o Y já vale de novo no tick seguinte. */
export const ABILITY_4: MountAbility = {
  type: 0x4,
  onY(_s, _p, r) { r.dash = true; return true; },
  drive(s, p, r, ev) {
    if (!r.dash) return false;
    const x = p.x, y = p.y;
    const hit: { roller?: Bomb } = {};
    moveStep(s, p, FACE_BTN[p.face & 6], speedLevel(s, p), DASH_SPEED, hit);   // $C2:26E0 → $C2:2F3A: a bomba rolando barra
    if (hit.roller) redirectRoller(s, p, hit.roller, ev);
    if (p.x === x && p.y === y) r.dash = false;
    p.moveDir = 8;   // medido: a montaria fica na animação parada durante a investida
    return true;
  },
};
