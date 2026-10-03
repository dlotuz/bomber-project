import type { MountAbility } from '../types';
import { punchBomb } from '../../flyers';
/** Tipo 9: Y soca a bomba da frente mesmo montado e sem o item ($C2:48E3), sem a pose de soco ($C2:4914). */
export const ABILITY_9: MountAbility = {
  type: 0x9,
  yEndsTick: true,   // $C2:4939: SEC com ou sem bomba na frente — o chute ($C2:4307) não roda neste tick
  onY(s, p, _r, ev) { punchBomb(s, p, ev, true); return true; },
};
