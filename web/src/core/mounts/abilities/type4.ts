import type { MountAbility } from '../types';
import { BTN } from '../../types';
import { moveStep } from '../../movement';
import { speedLevel } from '../../disease';
import { cellAt } from '../../units';
import { STAGES } from '../../stages';

/** Investida: 4 px por tick ($C2:26E0 simula o direcional da face, $C2:47C1, e chama o movimento normal $C2:2F3A). */
export const DASH_SPEED = 4 * 256;
/** Teto da investida: $C2:4697 grava $58 = $38; $C2:2776 decrementa depois de cada movimento e sai no zero. */
export const DASH_TICKS = 0x38;
const FACE_BTN = [BTN.UP, 0, BTN.RIGHT, 0, BTN.DOWN, 0, BTN.LEFT];

/** Tipo 4: Y dispara a investida ($C2:4691). Sem bomba nem virar durante; atravessa jogadores. Termina ($C2:2776-2785,
 *  volta à rotina normal $C2:22F0 no mesmo tick, sem pose nem espera: no tick seguinte já anda, vira e usa o Y):
 *  - no tick em que não sai do lugar (parede, bloco, bomba parada ou deslizando: a colisão é a do movimento normal);
 *  - no 56º tick andando (teto $58);
 *  - quando outra rotina a substitui: os ganchos depois do movimento ($C2:4B4E/4C54/4AD8/416F/17A7/16FE, os mesmos da
 *    rotina normal) ou qualquer trava/desmonte. A ROM nunca volta à investida: a volta é sempre para $C2:22F0. Aqui,
 *    um tick sem `drive` (trava de `tickAct`, desmonte, mão da luva) encerra a investida. */
export const ABILITY_4: MountAbility = {
  type: 0x4,
  onY(s, _p, r) { r.dash = true; r.dashLeft = DASH_TICKS; r.dashT = s.tick; return true; },
  drive(s, p, r, ev) {
    if (!r.dash) return false;
    if (r.dashT !== s.tick - 1) { r.dash = false; return false; }   // a rotina foi substituída no meio
    r.dashT = s.tick;
    const x = p.x, y = p.y, before = cellAt(x, y);
    moveStep(s, p, FACE_BTN[p.face & 6], speedLevel(s, p), DASH_SPEED);
    p.moveDir = 8;   // medido: a montaria fica na animação parada durante a investida
    // ganchos de arena, como em movePlayer (gangorra da arena 9, pisos da arena 6)
    const now = cellAt(p.x, p.y);
    const st = STAGES[s.stage];
    if (now !== before && now >= 0) st?.onEnterCell?.(s, p, now, ev);
    if (now >= 0) st?.onStand?.(s, p, now, ev);
    if (p.actLeft > 0 || p.push.left > 0) { r.dash = false; return true; }   // o gancho trocou a rotina
    r.dashLeft = (r.dashLeft ?? DASH_TICKS) - 1;
    if (r.dashLeft <= 0 || (p.x === x && p.y === y)) r.dash = false;
    return true;
  },
};
