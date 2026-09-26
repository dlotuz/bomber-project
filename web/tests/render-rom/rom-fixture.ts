import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';
import type { RomAssets } from '../../src/rom/types';

/** RomAssets da ROM real (SB4_ROM) ou null: os testes de ROM usam describe.skipIf(!ASSETS). */
export const ASSETS: RomAssets | null = ROM ? createRomAssets(ROM) : null;
