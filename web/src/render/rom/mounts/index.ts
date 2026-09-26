import { registerRomLayer, romPlayerHooks } from '../../battle-layers';
import { romMountLayer } from './layer';
import { riderHook } from './rider';
import { costumeHook } from './costume';

export { romMountLayer, riderHook, costumeHook };

// Registro (efeito colateral, mecanismo do layers-index do plano 6).
registerRomLayer(romMountLayer);
romPlayerHooks.push(riderHook, costumeHook);
