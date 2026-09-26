import type { MountAbility } from './types';
import { ABILITY_2 } from './abilities/type2';
import { ABILITY_3 } from './abilities/type3';
import { ABILITY_A } from './abilities/typeA';
import { ABILITY_C } from './abilities/typeC';
import { ABILITY_D } from './abilities/typeD';
import { ABILITY_E } from './abilities/typeE';
import { ABILITY_F } from './abilities/typeF';

/** Os 7 tipos do Battle. Os demais (0, 1, 4–9, B) ficam fora do escopo (spec §5.2). */
export const ABILITIES: Record<number, MountAbility> = {
  0x2: ABILITY_2, 0x3: ABILITY_3, 0xa: ABILITY_A, 0xc: ABILITY_C, 0xd: ABILITY_D, 0xe: ABILITY_E, 0xf: ABILITY_F,
};
