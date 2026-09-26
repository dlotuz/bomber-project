// Geometria da cena "charsel" (Escolha o personagem), spec §6.6, brief T10. Medidas a partir de `charsel.oam` e da
// captura (dump-capture): retratos na coluna esquerda, grade 3×2 de personagens, cursores "[ ]" com etiqueta nP.
// Sem SB4_CAPTURES nesta árvore para conferir tile a tile contra a captura real; por ora só a disposição em pixels,
// compartilhada pelo desenho ROM e pelo fallback de `screens/characters.ts` (nenhuma tela irmã já mesclada — players/
// rules/stage/title/vs — monta a cena de verdade via `PpuCanvas` ainda; `MAP_SOURCES.charsel`, T19, troca o fundo
// por um de verdade quando existir, sem mudar este layout).

/** Grade 3×2 dos 6 personagens (`render/art/bomber.ts` `CHARACTERS`). */
export const CHARSEL_GRID = { cols: 3, rows: 2, x: [80, 128, 176] as const, y: [88, 136] as const, cellW: 48, cellH: 48 };

/** Coluna de retratos à esquerda: um por jogador ativo, de cima a baixo. */
export const CHARSEL_PORTRAIT = { x: 24, w: 32, y0: 36, dy: 32 };

/** Endereços do CAT (bank:offset) dos OBJ do cursor "[ ]" + etiqueta nP na cena `charsel` (brief T10, §6.6):
 *  $CE:53D7, $CE:5BBB, $CE:60F5. Documentados para quando uma extração dedicada (T19+) precisar deles de verdade —
 *  não consumidos por este desenho, que sintetiza o próprio cursor colorido por jogador. */
export const CHARSEL_CURSOR_CAT_ADDR: readonly number[] = [0xce53d7, 0xce5bbb, 0xce60f5];
