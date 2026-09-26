import type { SceneId, RomAssets } from '../../app/rom-api';
import type { SceneMaps } from './scene';
/** Origem dos mapas de BG na ROM (A14), preenchida pela T19. Cena ausente = geometria do nosso código. */
export const MAP_SOURCES: Partial<Record<SceneId, (a: RomAssets) => SceneMaps>> = {};
