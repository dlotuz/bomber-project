import type { MountAbility } from '../types';
import { MAX_CAPS } from '../../tables/misc';
/** Tipo B: anda no nível MAX_CAPS.speed = 6, 2 px por tick, acima de patins e doença ($C2:2F40 lê $C0:0B50). */
export const ABILITY_B: MountAbility = { type: 0xb, speed: () => MAX_CAPS.speed };
