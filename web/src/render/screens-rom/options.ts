// Opções e remapeamento (T15): a cena reaproveitada é `rules` (moldura de corda igual, HDMA do BG1 igual — não há
// cena própria no original para uma tela que ele não tem). `menuMaps`/`menuBg1Vofs` (T5) já sabem desenhar essa
// moldura; aqui só faltava recortar a faixa em bandas (uma por trecho de `MENU_GEO.rulesBg1Bands`) para o `PpuFrame`
// respeitar o "salto" de VOFS por HDMA linha a linha, e posicionar a mão parada na linha do cursor.
import type { RomAssets, PpuFrame, ScanBand } from '../../app/rom-api';
import type { SpriteBank } from '../sprite-bank';
import type { TextStyleId } from '../text/types';
import { drawText, textWidth } from '../text/text';
import { romState } from '../../app/rom-api';
import { drawFallbackFrame, drawStaticBackground, drawStaticCursor } from '../../screens/ui';
import { sceneGfx, sceneFrame, menuMaps, menuBg1Vofs, handCursor, MENU_GEO, PpuCanvas, type SceneMaps } from './scene';

export { PpuCanvas };

/** Moldura (7,15)–(248,218) e geometria fixa das linhas (spec T15 §6.13). */
export const OPTIONS_FRAME = { x0: 7, y0: 15, x1: 248, y1: 218 } as const;
export const ROW_X = 24, VALUE_X = 232, ROW_Y0 = 28, ROW_STEP = 10, HAND_X = 8;
export const TITLE_X = 128, TITLE_Y = 8, FOOTER_Y = 208;

export interface OptionsRow { label: string; value: string; disabled?: boolean }

/** Uma banda por trecho de `MENU_GEO.rulesBg1Bands`, cada uma com o VOFS do BG1 daquele trecho (via `menuBg1Vofs`). */
function optionsBands(maps: SceneMaps): ScanBand[] {
  const main = (maps.bg1 ? 1 : 0) | (maps.bg2 ? 2 : 0) | (maps.bg3 ? 4 : 0) | 16;
  const starts = MENU_GEO.rulesBg1Bands.map(b => b[0]);
  return starts.map((y0, i) => ({
    y0, y1: starts[i + 1] ?? 224, bg1Tile16: true, bg1: [0, menuBg1Vofs('rules', y0)] as [number, number],
    main, sub: 0, math: 'none' as const,
  }));
}

/** Quadro ROM da tela: moldura de corda da cena `rules` com o título recortado nela e a mão na linha do cursor. */
export function optionsPpuFrame(a: RomAssets, title: string, titleStyle: TextStyleId, handY: number): PpuFrame {
  const gfx = sceneGfx(a, 'rules');
  const w = textWidth(titleStyle, title);
  const half = Math.floor(w / 2);
  const maps = menuMaps(OPTIONS_FRAME, 'rules', { x0: TITLE_X - half, x1: TITLE_X - half + w - 1 });
  const frame = sceneFrame(gfx, maps);
  frame.bands = optionsBands(maps);
  frame.oam = [handCursor(HAND_X, handY)];
  return frame;
}

/**
 * Página das Opções e do remapeamento: moldura fixa (ROM ou fallback nas mesmas posições — `drawText` já escolhe
 * a fonte certa), título no topo, linhas em `ascii8` (rótulo em x = 24, valor alinhado à direita em x = 232, passo
 * de 10 px a partir de y = 28) e uma linha de rodapé opcional (pergunta de "esquecer ROM" ou aviso de captura de
 * tecla/botão), em y = 208.
 */
export function drawOptionsPage(
  ctx: CanvasRenderingContext2D, bank: SpriteBank, canvas: PpuCanvas, title: string, rows: readonly OptionsRow[],
  cursor: number, footer?: string, titleStyle: TextStyleId = 'menuTitle',
): void {
  const a = romState.assets;
  const handY = ROW_Y0 + cursor * ROW_STEP;
  if (a) canvas.draw(ctx, optionsPpuFrame(a, title, titleStyle, handY));
  else {
    drawStaticBackground(ctx);
    drawFallbackFrame(ctx, OPTIONS_FRAME);
    drawStaticCursor(ctx, HAND_X, handY);
  }
  drawText(ctx, bank, titleStyle, title, TITLE_X, TITLE_Y, { align: 'center' });
  rows.forEach((r, i) => {
    const y = ROW_Y0 + i * ROW_STEP;
    const tone = r.disabled ? 'gray' : undefined;
    drawText(ctx, bank, 'ascii8', r.label, ROW_X, y, { tone });
    if (r.value) drawText(ctx, bank, 'ascii8', r.value, VALUE_X, y, { align: 'right', tone });
  });
  if (footer) drawText(ctx, bank, 'ascii8', footer, TITLE_X, FOOTER_Y, { align: 'center' });
}
