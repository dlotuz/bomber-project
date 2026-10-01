import type { MountAbility } from '../types';
import { CODE } from '../../types';
/** Tipo 1: atravessa bombas como o item $0B ($C2:4339/$C2:4EB0) e, por isso, nunca chuta ($C2:33B6). */
export const ABILITY_1: MountAbility = { type: 0x1, passes: (_p, code) => code === CODE.BOMB };
