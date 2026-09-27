import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';
import type { RomAssets } from '../../src/app/rom-api';

/** RomAssets da ROM de SB4_ROM, ou null (testes com ROM usam describe.skipIf(!ASSETS)). */
export const ASSETS: RomAssets | null = ROM ? createRomAssets(ROM) : null;
