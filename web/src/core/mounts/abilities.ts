import type { MountAbility } from './types';
import { ABILITY_1 } from './abilities/type1';
import { ABILITY_2 } from './abilities/type2';
import { ABILITY_3 } from './abilities/type3';
import { ABILITY_4 } from './abilities/type4';
import { ABILITY_5 } from './abilities/type5';
import { ABILITY_6 } from './abilities/type6';
import { ABILITY_9 } from './abilities/type9';
import { ABILITY_A } from './abilities/typeA';
import { ABILITY_B } from './abilities/typeB';
import { ABILITY_C } from './abilities/typeC';
import { ABILITY_D } from './abilities/typeD';
import { ABILITY_E } from './abilities/typeE';
import { ABILITY_F } from './abilities/typeF';

/** Os 7 tipos do Battle e os 6 da senha 0164 (1, 4, 5, 6, 9, B). Os tipos 0, 7 e 8 não saem em nenhuma tabela. */
export const ABILITIES: Record<number, MountAbility> = {
  0x1: ABILITY_1, 0x2: ABILITY_2, 0x3: ABILITY_3, 0x4: ABILITY_4, 0x5: ABILITY_5, 0x6: ABILITY_6, 0x9: ABILITY_9,
  0xa: ABILITY_A, 0xb: ABILITY_B, 0xc: ABILITY_C, 0xd: ABILITY_D, 0xe: ABILITY_E, 0xf: ABILITY_F,
};
