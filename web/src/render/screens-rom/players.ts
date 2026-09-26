import type { RomAssets, PpuFrame } from '../../app/rom-api';
import { sceneGfx, sceneMaps, sceneFrame, menuMaps, handCursor, type MenuRect } from './scene';

/** Moldura e faixa do título medidas [MNT §B.2] (mesmos números do teste de geometria da T5). */
export const PLAYERS_FRAME: MenuRect = { x0: 7, y0: 19, x1: 248, y1: 218 };
export const PLAYERS_TITLE = { x0: 50, x1: 204 };

export function playersMaps(a: RomAssets) {
  return sceneMaps(a, 'players', () => menuMaps(PLAYERS_FRAME, 'players', PLAYERS_TITLE));
}

export interface PlayersSceneOpts { cursor?: number }

/** Cena "Defina os jogadores!" (fundo + corda + mão). Sem `cursor`, desenha a mão nas 5 linhas (§6.4). */
export function buildPlayersScene(a: RomAssets, o: PlayersSceneOpts = {}): PpuFrame {
  const g = sceneGfx(a, 'players');
  const rows = o.cursor === undefined ? [0, 1, 2, 3, 4] : [o.cursor];
  return sceneFrame(g, playersMaps(a), { oam: rows.map(i => handCursor(24, 48 + 32 * i)) });
}
