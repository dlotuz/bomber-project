import type { StyleRomDef } from '../types';
/** BATTLE START! (seleção de fase, depois do A): 9 OBJ 16×16 em y = 8, paleta OBJ 1. Os tiles já estão na VRAM da cena
 *  `stagesel` (dados crus de $E0:0021 em $C000; nenhum DMA novo entre f62 e f72 da captura). Letras isoladas por colunas
 *  vazias; as coladas (TT de BATTLE, TA de START) não são usadas. x = 0 na faixa = OBJ em x 56. */
export const DEF: StyleRomDef = {
  strips: { t: { kind: 'grid16', scene: 'stagesel', region: 'obj', cells: [[0x0e, 0x20, 0x22, 0x24, 0x26, 0x28, 0x2a, 0x2c, 0x2e]] } },
  cuts: [
    { ch: 'B', strip: 't', x: 5, w: 9 },
    { ch: 'A', strip: 't', x: 15, w: 11 },
    { ch: 'L', strip: 't', x: 48, w: 10 },
    { ch: 'E', strip: 't', x: 59, w: 10 },
    { ch: 'S', strip: 't', x: 77, w: 10 },
    { ch: 'R', strip: 't', x: 110, w: 9 },
    { ch: 'T', strip: 't', x: 120, w: 11 },
    { ch: '!', strip: 't', x: 132, w: 5 },
  ],
  height: 14, spacing: 1, spaceWidth: 6,                               // 1 coluna vazia entre letras; E→S: 8 colunas
  palette: { kind: 'scene', scene: 'stagesel', row: 9, size: 16 },   // OBJ paleta 1 = linha 9 ($D6:3DFD)
};
