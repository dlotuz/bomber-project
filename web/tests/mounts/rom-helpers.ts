import { ROM } from '../rom/helpers';
import { createRomAssets } from '../../src/rom/assets';   // fábrica real do plano 5
export { ROM };
export const ASSETS = ROM ? createRomAssets(ROM) : null;
