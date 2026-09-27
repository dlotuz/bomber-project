import type { RomAssets, PpuFrame, ScanBand } from '../../app/rom-api';
import { sceneGfx, sceneMaps, menuMaps, menuBg1Vofs, menuShade, shadeBand, shadeLayer, handCursor, MENU_GEO, type MenuRect, type SceneMaps } from './scene';

/** Moldura e faixa do título medidas [MNT §B.2] (mesmos números do teste de geometria da T5). */
export const RULES_FRAME: MenuRect = { x0: 7, y0: 27, x1: 248, y1: 210 };
export const RULES_TITLE = { x0: 56, x1: 198 };

/** Mapas da cena com o miolo escurecido (I7): o BG1/BG2 da ROM (`MAP_SOURCES.rules`) não traz o BG3 do miolo. */
export function rulesMaps(a: RomAssets): SceneMaps {
  return { ...sceneMaps(a, 'rules', () => menuMaps(RULES_FRAME, 'rules', RULES_TITLE)), shade: menuShade(RULES_FRAME) };
}

export interface RulesSceneOpts { cursor?: number }

/**
 * Cena "Configure as regras!". O BG1 muda de VOFS por faixa (HDMA [MNT §B.4]): uma `ScanBand` por
 * entrada de `MENU_GEO.rulesBg1Bands`, cada uma com o próprio `bg1: [0, vofs]` (via `menuBg1Vofs`),
 * senão a corda desalinha da moldura fora da 1ª faixa. Sem `cursor`, desenha a mão nas 6 linhas (§6.5).
 */
export function buildRulesScene(a: RomAssets, o: RulesSceneOpts = {}): PpuFrame {
  const g = sceneGfx(a, 'rules');
  const maps = rulesMaps(a);
  const bg1Vofs0 = menuBg1Vofs('rules', RULES_FRAME.y0);
  const bg1 = maps.bg1 ? { map: maps.bg1, mapW: 32 as const, tiles: g.bgTiles, tile16: true, hofs: 0, vofs: bg1Vofs0 } : undefined;
  const bg2 = maps.bg2 ? { map: maps.bg2, mapW: 32 as const, tiles: g.bgTiles, tile16: true, hofs: 0, vofs: MENU_GEO.scroll.bg2[1] } : undefined;
  const bg3 = shadeLayer(g, maps);
  const main = (bg1 ? 1 : 0) | (bg2 ? 2 : 0) | (bg3 ? 4 : 0) | 16;
  const bandsSpec = MENU_GEO.rulesBg1Bands;
  const bands: ScanBand[] = bandsSpec.map(([y0, vofs], i) => ({
    y0, y1: bandsSpec[i + 1]?.[0] ?? 224, bg1Tile16: true, bg1: [0, vofs], main, ...shadeBand(maps),
  }));
  const rows = o.cursor === undefined ? [0, 1, 2, 3, 4, 5] : [o.cursor];
  return { cgram: g.cgram, bg1, bg2, bg3, bands, objTiles: g.objTiles, oam: rows.map(i => handCursor(16, 56 + 24 * i)) };
}
