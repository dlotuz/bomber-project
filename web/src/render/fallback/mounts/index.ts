import { registerFallbackLayer } from '../../battle-layers';
import { fallbackMountLayer, fallbackMountFrontLayer } from './layer';
import { fallbackCostumeLayer } from './costume';

export { fallbackMountLayer, fallbackMountFrontLayer, fallbackCostumeLayer };

// Registro (efeito colateral, mecanismo do layers-index do plano 6). A frente da montaria vai para a lista `over`.
registerFallbackLayer(fallbackMountLayer);
registerFallbackLayer(fallbackCostumeLayer);
registerFallbackLayer(fallbackMountFrontLayer);
