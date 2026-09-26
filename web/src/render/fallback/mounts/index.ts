import { registerFallbackLayer } from '../../battle-layers';
import { fallbackMountLayer } from './layer';
import { fallbackCostumeLayer } from './costume';

export { fallbackMountLayer, fallbackCostumeLayer };

// Registro (efeito colateral, mecanismo do layers-index do plano 6).
registerFallbackLayer(fallbackMountLayer);
registerFallbackLayer(fallbackCostumeLayer);
