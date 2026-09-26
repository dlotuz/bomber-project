// Reconstrução da cena `stagesel` ["Escolha a fase!", $C1:A901/$C1:A262] a partir da captura real (SB4_CAPTURES).
//
// Confirmado por captura (ver `web/tests/screens/stage.test.ts`, describe.skipIf):
// - BG2 (quebra-cabeça de fundo) é byte a byte o mesmo padrão 6×6 dos outros menus (`MENU_GEO.bgPattern`,
//   T5) — nenhuma cena nova precisou ser medida para o fundo.
// - BG1 guarda 3 prévias lado a lado (anterior/atual/seguinte), cada uma num bloco de 7×7 casas (112 px) a
//   cada 128 px (colunas 0–6, 8–14, 16–22 do mapa; 1 coluna de vão entre elas), tile16. A rolagem do jogo
//   desloca o hofs do BG1 (não o conteúdo do mapa).
//
// Não confirmado: as prévias de cada uma das 10 fases (o bloco de 7×7 acima é só o da fase 1, medido na
// captura `stagesel`). Reconstruir as outras 9 exigiria capturar cada uma no emulador (`stage_scroll.py`) e
// decidir como `$C1:A262` escolhe qual gráfico carregar em qual dos slots — pesquisa não concluída nesta
// tarefa (ver o relatório da T11). `buildStageScene` aplica R29 nesse caso: repete o ícone da fase 1.
import type { RomAssets } from '../../app/rom-api';
import { newMap, put, pattern, MENU_GEO, type SceneMaps } from './scene';

/** Ícone da fase 1 (7×7 casas, tile16), medido em `$4000` col 8–14, lin 2–8 da captura `stagesel`. */
export const STAGE1_ICON: readonly (readonly number[])[] = [
  [0x0404, 0x0404, 0x0404, 0x0404, 0x0404, 0x0404, 0x0404],
  [0x0404, 0x0408, 0x0408, 0x0408, 0x0408, 0x0408, 0x0404],
  [0x0404, 0x0406, 0x0402, 0x0406, 0x0402, 0x0406, 0x0404],
  [0x0404, 0x0406, 0x0408, 0x0406, 0x0408, 0x0406, 0x0404],
  [0x0404, 0x0406, 0x0402, 0x0406, 0x0402, 0x0406, 0x0404],
  [0x0404, 0x0406, 0x0406, 0x0406, 0x0406, 0x0406, 0x0404],
  [0x0404, 0x0404, 0x0404, 0x0404, 0x0404, 0x0404, 0x0404],
];
/** Colunas/linha do slot central (128 px de passo, igual a `STAGE.scrollPx * STAGE.scrollFrames`). */
export const STAGE_ICON_COL = 8, STAGE_ICON_ROW = 2;
/** Registrador de HOFS do BG1 que deixa o slot central em x = 72; `stageScreen.scroll()` soma-se a isto. */
export const STAGE_ICON_HOFS_BASE = 56;

function placeIcon(m: Uint16Array, col0: number, row0: number, icon: readonly (readonly number[])[]): void {
  icon.forEach((row, gy) => row.forEach((w, gx) => put(m, col0 + gx, row0 + gy, w)));
}

/** Reconstrói os mapas de `stagesel` com `stage` no slot central. `hofs` é o mesmo valor de
 *  `stageScreen.scroll()` (0 parado); a rolagem em si é o registrador de HOFS do BG1 (`STAGE_ICON_HOFS_BASE -
 *  hofs`), não uma mudança no mapa — o parâmetro só existe para a assinatura combinar com o resto da tela. */
export function buildStageScene(_a: RomAssets, _stage: number, hofs = 0): SceneMaps {
  void hofs;
  const bg2 = newMap();
  pattern(bg2, 0, 0, 32, 32, MENU_GEO.bgPattern);
  const bg1 = newMap();
  placeIcon(bg1, STAGE_ICON_COL, STAGE_ICON_ROW, STAGE1_ICON);   // R29: só a fase 1 foi reconstruída da captura
  return { bg1, bg2 };
}
