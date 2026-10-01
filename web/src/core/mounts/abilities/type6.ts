import type { MountAbility } from '../types';
import { MAX_CAPS } from '../../tables/misc';
/** Tipo 6: bomba com fogo MAX_CAPS.fire − 1 = 7, o do fogo total ($C2:510C grava bomba+$23 = [$C0:0B48] − 1). */
export const ABILITY_6: MountAbility = { type: 0x6, fire: () => MAX_CAPS.fire - 1 };
