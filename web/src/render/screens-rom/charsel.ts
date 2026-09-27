// Geometria da cena "charsel" (Escolha o personagem), spec §6.6, brief T10. Medida em `charsel.oam`/`charsel.vram`
// (SB4_CAPTURES, dump-capture) e conferida por `tests/screens/characters-teams.test.ts` (mapMatch ≥ 97 % fora do
// título e da grade) — nenhum mapa é copiado por inteiro, só os pedaços medidos (corda) e a fórmula do
// quebra-cabeça já existente em `MENU_GEO` (T5), do mesmo jeito que `menuMaps` monta as outras cenas de menu.
// Revisão final do plano 10: a coluna à esquerda da corda é a dos retratos (I6, `portraits.ts`), e o BG1 tem
// HOFS −8 (I8, `CHARSEL_SCROLL`).
// `screens/characters.ts` e `screens/teams.ts` (que reaproveita esta mesma cena — não tem captura própria, A1)
// montam a `PpuFrame` com `sceneGfx`/`sceneMaps`/`sceneFrame` (T5) daqui; retratos, cursores e "VS" são conteúdo
// dinâmico desenhado por cima, depois do `PpuCanvas.draw`, com `drawCharselTitle` pondo o nosso título dentro do
// vão que a ROM deixava para "Select a character!" (`CHARSEL_TITLE_PX`). `MAP_SOURCES.charsel` (T19, já
// mesclada) fornece o mapa de verdade da ROM — `sceneMaps(a, 'charsel', charselMaps)` (T5) já escolhe sozinho,
// e `charselMaps` (geometria nossa) só entra em cena nos testes/telas sem essa origem.
import type { SpriteBank } from '../sprite-bank';
import type { RomAssets, ObjEntry, PpuFrame } from '../../app/rom-api';
import { box, MENU_GEO, newMap, pattern, put, sceneFrame, sceneGfx, sceneMaps, tileWord, type SceneMaps } from './scene';
import { drawText } from '../text/text';
import { charselPortraitTile, NO_CHAR, withPortraitPalettes } from './portraits';

/** Grade 3×2 dos 6 personagens (`render/art/bomber.ts` `CHARACTERS`), medida no `charsel.oam`. */
export const CHARSEL_GRID = { cols: 3, rows: 2, x: [80, 128, 176] as const, y: [88, 136] as const, cellW: 48, cellH: 48 };

/** Coluna de retratos do **fallback** (sem ROM): um por jogador ativo, de cima a baixo. Com ROM os retratos são o
 *  BG1 da própria cena (`charselPortraitWords`). */
export const CHARSEL_PORTRAIT = { x: 24, w: 32, y0: 36, dy: 32 };

/** Scrolls [hofs, vofs] (registrador) da cena, medidos por pixel em `charsel.png` (o `.ppu` só guarda o byte alto,
 *  `$FF` no BG1HOFS): BG1 (corda, título e retratos) casa 100 % com HOFS −8; o BG2 (quebra-cabeça) não rola. */
export const CHARSEL_SCROLL = { bg1: [-8, 0] as [number, number], bg2: [0, 0] as [number, number] };

/** Retratos no BG1 (I6): colunas 1–2, linhas 2+2·slot (tile16 `$200 + desl` da folha `$CD:E585`), com a paleta de
 *  BG da linha `CHARSEL_PORTRAIT_PAL[slot]` — onde a ROM grava as cores do retrato do slot (captura: 2/3/4/0/7). Slot
 *  desligado: o "×" da folha (entrada 6 da tabela de paletas `$C1:B3C3`, reservada a "sem personagem"). */
export const CHARSEL_PORTRAIT_PAL: readonly number[] = [2, 3, 4, 0, 7];
export const CHARSEL_PORTRAIT_CELL = { col: 1, row0: 2 };
export function charselPortraitWords(chars: readonly (number | null)[]): { col: number; row: number; w: number }[] {
  const out: { col: number; row: number; w: number }[] = [];
  chars.forEach((c, slot) => {
    const t = charselPortraitTile(c ?? NO_CHAR), pal = CHARSEL_PORTRAIT_PAL[slot];
    const col = CHARSEL_PORTRAIT_CELL.col, row = CHARSEL_PORTRAIT_CELL.row0 + 2 * slot;
    out.push({ col, row, w: tileWord(t, pal) }, { col: col + 1, row, w: tileWord(t + 2, pal) },
      { col, row: row + 1, w: tileWord(t + 0x20, pal) }, { col: col + 1, row: row + 1, w: tileWord(t + 0x22, pal) });
  });
  return out;
}

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
/** Retângulo em px (mapa) da moldura, para as áreas a ignorar no teste (título) e para o desenho. */
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
/** Coluna dos retratos (colunas 1–2, linhas 2–11 do mapa), em px do mapa. A origem de BG1 da ROM
 *  (`MAP_SOURCES.charsel`) não a tem porque é conteúdo dinâmico: `charselFrame` a acrescenta. */
export const CHARSEL_ICON_PX = { x0: 1 * 16, y0: CHARSEL_ROPE.l0 * 16, x1: 2 * 16 + 15, y1: CHARSEL_ROPE.l1 * 16 + 15 };

/**
 * BG1 (corda + retratos dos personagens padrão 0..4) e BG2 (quebra-cabeça, `MENU_GEO.bgPattern`, igual às outras cenas de menu) da cena `charsel`,
 * geometria pura sem origem na ROM — o "fallback da tela sem `MAP_SOURCES.charsel`" que `sceneMaps` (T5) usa até a
 * T19 preencher `MAP_SOURCES.charsel` com o mapa de verdade (aí `sceneMaps` troca sozinho, sem mexer aqui).
 */
export function charselMaps(_a: RomAssets): SceneMaps {
  const bg2 = newMap();
  pattern(bg2, 0, 0, 32, 32, MENU_GEO.bgPattern);

  const bg1 = newMap();
  for (const p of charselPortraitWords([0, 1, 2, 3, 4])) put(bg1, p.col, p.row, p.w);
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

/** Divide o título em 2 linhas no espaço mais perto do meio (a ROM também usa 2: "Select a" / "character!"). */
export function splitTitle(text: string): [string, string] {
  let best = -1;
  for (let k = 0; k < text.length; k++) if (text[k] === ' ' && (best < 0 || Math.abs(k - text.length / 2) < Math.abs(best - text.length / 2))) best = k;
  return best < 0 ? [text, ''] : [text.slice(0, best), text.slice(best + 1)];
}

/** Miolo escurecido (subtração de cor do plano 10, I7): casas 8×8 do BG3 com a palavra `$1004` na captura
 *  `charsel` (360 casas = colunas 8–27, linhas 5–22; o BG3 não rola). */
export const CHARSEL_SHADE = { c0: 8, l0: 5, c1: 27, l1: 22 };

/** Deslocamento tela − mapa do BG1 com `CHARSEL_SCROLL` (o PPU soma 1 ao VOFS): +8 em x, −1 em y. */
export const CHARSEL_BG1_SHIFT = { x: -CHARSEL_SCROLL.bg1[0], y: -CHARSEL_SCROLL.bg1[1] - 1 };

/** Quadro PPU da cena `charsel` com ROM: corda/quebra-cabeça (`MAP_SOURCES.charsel`, T19), a coluna de retratos
 *  de `chars` (slot → personagem, `null` = desligado) no BG1, as cores de cada retrato nas linhas
 *  `CHARSEL_PORTRAIT_PAL`, o miolo escurecido (`CHARSEL_SHADE`) e os scrolls medidos. `oam` = bonecos da tela. */
export function charselFrame(a: RomAssets, chars: readonly (number | null)[], oam: ObjEntry[] = []): PpuFrame {
  const g = sceneGfx(a, 'charsel');
  const maps = sceneMaps(a, 'charsel', charselMaps);
  const bg1 = (maps.bg1 ?? newMap()).slice();
  for (const p of charselPortraitWords(chars)) put(bg1, p.col, p.row, p.w);
  const frame = sceneFrame(g, { ...maps, bg1, shade: CHARSEL_SHADE }, { ...CHARSEL_SCROLL, oam });
  return { ...frame, cgram: withPortraitPalettes(a, g.cgram, chars.map(c => c ?? NO_CHAR), CHARSEL_PORTRAIT_PAL) };
}

/** Nosso título (PT-BR) dentro do vão que a ROM deixava para "Select a character!" (`CHARSEL_TITLE_PX`, 2 linhas de
 *  16 px medidas na captura), na fonte `menuTitle` (da ROM quando carregada), centrado em x; `color` só vale sem ROM.
 *  `shift` = deslocamento tela − mapa (com ROM, `CHARSEL_BG1_SHIFT`: o vão anda junto com a corda). */
export function drawCharselTitle(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color: string,
  shift: { x: number; y: number } = { x: 0, y: 0 }): void {
  const cx = Math.floor((CHARSEL_TITLE_PX.x0 + CHARSEL_TITLE_PX.x1 + 1) / 2) + shift.x;
  splitTitle(text).forEach((line, k) => {
    if (line) drawText(ctx, bank, 'menuTitle', line, cx, CHARSEL_TITLE_PX.y0 + shift.y + 16 * k, { align: 'center', color });
  });
}
