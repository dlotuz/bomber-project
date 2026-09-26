// Geometria da cena "charsel" (Escolha o personagem), spec §6.6, brief T10. Medida em `charsel.oam`/`charsel.vram`
// (SB4_CAPTURES, dump-capture) e conferida por `tests/screens/characters-teams.test.ts` (mapMatch ≥ 97 % fora do
// título e da grade) — nenhum mapa é copiado por inteiro, só os pedaços medidos (ícone, corda) e a fórmula do
// quebra-cabeça já existente em `MENU_GEO` (T5), do mesmo jeito que `menuMaps` monta as outras cenas de menu.
// `screens/characters.ts` e `screens/teams.ts` (que reaproveita esta mesma cena — não tem captura própria, A1)
// montam a `PpuFrame` com `sceneGfx`/`sceneMaps`/`sceneFrame` (T5) daqui; retratos, cursores e "VS" são conteúdo
// dinâmico desenhado por cima, depois do `PpuCanvas.draw`, com `drawCharselTitle` pondo o nosso título dentro do
// vão que a ROM deixava para "Select a character!" (`CHARSEL_TITLE_PX`). `MAP_SOURCES.charsel` (T19, já
// mesclada) fornece o mapa de verdade da ROM — `sceneMaps(a, 'charsel', charselMaps)` (T5) já escolhe sozinho,
// e `charselMaps` (geometria nossa) só entra em cena nos testes/telas sem essa origem.
import type { SpriteBank } from '../sprite-bank';
import type { RomAssets } from '../../app/rom-api';
import { box, MENU_GEO, newMap, pattern, put, type SceneMaps } from './scene';

/** Grade 3×2 dos 6 personagens (`render/art/bomber.ts` `CHARACTERS`), medida no `charsel.oam`. */
export const CHARSEL_GRID = { cols: 3, rows: 2, x: [80, 128, 176] as const, y: [88, 136] as const, cellW: 48, cellH: 48 };

/** Coluna de retratos à esquerda (conteúdo nosso, não existe na ROM original — ver nota em `screens/characters.ts`):
 *  um por jogador ativo, de cima a baixo. */
export const CHARSEL_PORTRAIT = { x: 24, w: 32, y0: 36, dy: 32 };

/** Endereços do CAT (bank:offset) dos OBJ do cursor "[ ]" + etiqueta nP na cena `charsel` (brief T10, §6.6):
 *  $CE:53D7, $CE:5BBB, $CE:60F5. Documentados para quando uma extração dedicada (T19+) precisar deles de verdade —
 *  não consumidos por este desenho, que sintetiza o próprio cursor colorido por jogador (é conteúdo dinâmico:
 *  muda de posição e de cor por jogador, o que a ROM resolveria com no máximo 3 variantes fixas). */
export const CHARSEL_CURSOR_CAT_ADDR: readonly number[] = [0xce53d7, 0xce5bbb, 0xce60f5];

/** OBJ 32×32 dos 6 bonecos parados na grade [`charsel.oam`, entradas #0–#5], indexado pelo personagem (`k`, não
 *  pelo slot): posição = `CHARSEL_GRID.x[k % 3]`, `CHARSEL_STANDEE_Y[k / 3 | 0]`. Todos prio 3, sem flip. */
export const CHARSEL_STANDEE_Y: readonly [number, number] = [96, 144];
export const CHARSEL_STANDEE: readonly { tile: number; pal: number }[] = [
  { tile: 0x040, pal: 5 },   // 0 BLANCO
  { tile: 0x044, pal: 5 },   // 1 GEAR
  { tile: 0x048, pal: 5 },   // 2 TIGRA
  { tile: 0x04c, pal: 5 },   // 3 AERO
  { tile: 0x080, pal: 5 },   // 4 VERDI
  { tile: 0x084, pal: 6 },   // 5 RUBI
];

/** Moldura de corda da cena (BG1, mesma família das outras cenas de menu — T5 `MENU_GEO.rope` — mas `charsel` não
 *  está lá porque esse arquivo não é desta tarefa; os tiles abaixo são os medidos no `charsel-bg1.txt`
 *  (dump-capture), colunas/linhas em endereço de palavra tile16 (c0..c1, l0..l1)). */
export const CHARSEL_ROPE = {
  c0: 3, l0: 2, c1: 13, l1: 11,
  tl: 0x1402, top: 0x1404, tr: 0x1424, left: 0x1426, right: 0x1442, bl: 0x1444, bottom: 0x5404, br: 0x1446,
  topRight: 0x5404, titleEnds: [0x1406, 0x1422] as [number, number],
};
/** "Select a character!" ocupa 2 linhas de tile (fonte da ROM) nas colunas 6–10: essas células ficam em branco
 *  no mapa montado (o texto é nosso — `drawCharselTitle` o desenha exatamente nesse vão, `CHARSEL_TITLE_PX`),
 *  e o teste de captura ignora esse retângulo. */
export const CHARSEL_TITLE_TILES = { l0: 2, l1: 3, c0: 6, c1: 10 };
/** Ícone decorativo à esquerda da corda (colunas 1–2, linhas 2–11): 20 palavras medidas no `charsel-bg1.txt`, sem
 *  fórmula (não é um padrão geométrico) — igual em espírito a `MENU_GEO.rope` guardar tiles específicos por cena. */
export const CHARSEL_ICON: readonly (readonly [number, number])[] = [
  [0x0a00, 0x0a02], [0x0a20, 0x0a22], [0x0e04, 0x0e06], [0x0e24, 0x0e26], [0x1208, 0x120a],
  [0x1228, 0x122a], [0x0244, 0x0246], [0x0264, 0x0266], [0x1e48, 0x1e4a], [0x1e68, 0x1e6a],
];

/** Retângulo em px (tela) da moldura + ícone, para as áreas a ignorar no teste (título) e para o desenho. */
export const CHARSEL_FRAME_PX = {
  x0: CHARSEL_ROPE.c0 * 16, y0: CHARSEL_ROPE.l0 * 16, x1: (CHARSEL_ROPE.c1 + 1) * 16 - 1, y1: (CHARSEL_ROPE.l1 + 1) * 16 - 1,
};
export const CHARSEL_TITLE_PX = {
  x0: CHARSEL_TITLE_TILES.c0 * 16, y0: CHARSEL_TITLE_TILES.l0 * 16,
  x1: (CHARSEL_TITLE_TILES.c1 + 1) * 16 - 1, y1: (CHARSEL_TITLE_TILES.l1 + 1) * 16 - 1,
};
/** Grade dos personagens, para o teste também ignorar essa área (fica em branco no BG1 — os bonecos são OBJ). */
export const CHARSEL_GRID_PX = {
  x0: CHARSEL_GRID.x[0], y0: CHARSEL_STANDEE_Y[0] - 16, x1: CHARSEL_GRID.x[2] + CHARSEL_GRID.cellW - 1, y1: CHARSEL_STANDEE_Y[1] + 32 - 1,
};
/** Ícone (colunas 1–2, linhas 2–11), em px. `MAP_SOURCES.charsel` (T19) reconstrói o BG1 mantendo só a paleta 5
 *  da corda (`keepPalette`), então essas casas saem vazias ali — o teste que compara a origem real da ROM (T19)
 *  ignora essa área pelo mesmo motivo que `tests/screens/map-sources.test.ts` (`DYNAMIC.charsel`); a comparação
 *  do nosso `charselMaps` (sem `MAP_SOURCES`) não precisa dela, porque a reproduz de verdade. */
export const CHARSEL_ICON_PX = { x0: 1 * 16, y0: CHARSEL_ROPE.l0 * 16, x1: 2 * 16 + 15, y1: CHARSEL_ROPE.l1 * 16 + 15 };

/**
 * BG1 (corda + ícone) e BG2 (quebra-cabeça, `MENU_GEO.bgPattern`, igual às outras cenas de menu) da cena `charsel`,
 * geometria pura sem origem na ROM — o "fallback da tela sem `MAP_SOURCES.charsel`" que `sceneMaps` (T5) usa até a
 * T19 preencher `MAP_SOURCES.charsel` com o mapa de verdade (aí `sceneMaps` troca sozinho, sem mexer aqui).
 */
export function charselMaps(_a: RomAssets): SceneMaps {
  const bg2 = newMap();
  pattern(bg2, 0, 0, 32, 32, MENU_GEO.bgPattern);

  const bg1 = newMap();
  CHARSEL_ICON.forEach(([a, b], r) => { put(bg1, 1, CHARSEL_ROPE.l0 + r, a); put(bg1, 2, CHARSEL_ROPE.l0 + r, b); });
  const { c0, l0, c1, l1, ...rope } = CHARSEL_ROPE;
  box(bg1, c0, l0, c1, l1, rope);
  // título: deixa em branco onde a ROM tinha "Select a character!" (o nosso vai por cima, `drawCharselTitle`)
  // e fecha a borda de cima com titleEnds + topRight.
  for (let l = CHARSEL_TITLE_TILES.l0; l <= CHARSEL_TITLE_TILES.l1; l++) {
    for (let c = CHARSEL_TITLE_TILES.c0; c <= CHARSEL_TITLE_TILES.c1; c++) put(bg1, c, l, 0);
  }
  put(bg1, CHARSEL_TITLE_TILES.c0 - 1, l0, rope.titleEnds[0]);
  put(bg1, CHARSEL_TITLE_TILES.c1 + 1, l0, rope.titleEnds[1]);
  for (let c = CHARSEL_TITLE_TILES.c1 + 2; c < c1; c++) put(bg1, c, l0, rope.topRight);

  return { bg1, bg2 };
}

/** Nosso título (PT-BR) dentro do vão que a ROM deixava para "Select a character!" (`CHARSEL_TITLE_PX`, medido
 *  na captura), centralizado — em vez da barra fixa em y=12 usada pelas telas sem cena própria. */
export function drawCharselTitle(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color: string): void {
  const img = bank.text(text, color);
  const scale = 2;
  const w = img.width * scale, h = img.height * scale;
  const cx = (CHARSEL_TITLE_PX.x0 + CHARSEL_TITLE_PX.x1 + 1) / 2, cy = (CHARSEL_TITLE_PX.y0 + CHARSEL_TITLE_PX.y1 + 1) / 2;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}
