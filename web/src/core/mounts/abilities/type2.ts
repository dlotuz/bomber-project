import type { MountAbility } from '../types';
/** Tipo 2: atravessa soft blocks ($C2:1631). */
export const ABILITY_2: MountAbility = { type: 0x2, passes: (_p, code) => code === 0xcc80 };
