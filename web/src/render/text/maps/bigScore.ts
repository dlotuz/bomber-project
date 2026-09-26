import type { StyleRomDef } from '../types';
/** SCORE BOARD: BG1 da cena `scoreboard` (paleta 7), blocos 16×16 do mapa nas linhas 18–19, colunas 19–29 (x = 0 na
 *  faixa = x 304, y = 0 = y 288). As letras se encostam (contorno preto compartilhado): cada recorte fica só com a letra
 *  das sementes — preenchimento (1–10, um par de cores por letra) + 2 camadas de contorno (preto e lilás). */
export const DEF: StyleRomDef = {
  strips: {
    t: {
      kind: 'grid16', scene: 'scoreboard', region: 'bg', cells: [
        [0x100, 0x102, 0x104, 0x120, 0x122, 0x124, 0x126, 0x128, 0x12a, 0x12c, 0x12e],
        [0x08a, 0x08c, 0x08e, 0x140, 0x142, 0x144, 0x146, 0x148, 0x14a, 0x14c, 0x14e],
      ],
    },
  },
  cuts: [
    { ch: 'S', strip: 't', x: 15, w: 16, y: 2, seeds: [[19, 4]] },
    { ch: 'C', strip: 't', x: 26, w: 17, y: 2, seeds: [[33, 4]] },
    { ch: 'O', strip: 't', x: 39, w: 16, y: 2, seeds: [[44, 4]] },
    { ch: 'R', strip: 't', x: 52, w: 18, y: 2, seeds: [[54, 4]] },
    { ch: 'E', strip: 't', x: 65, w: 14, y: 2, seeds: [[67, 4]] },
    { ch: 'B', strip: 't', x: 85, w: 17, y: 2, seeds: [[87, 4]] },
    { ch: 'A', strip: 't', x: 109, w: 19, y: 2, seeds: [[118, 4]] },
    { ch: 'D', strip: 't', x: 135, w: 17, y: 2, seeds: [[137, 4]] },
  ],
  height: 23, spacing: -3, spaceWidth: 4,
  palette: { kind: 'scene', scene: 'scoreboard', row: 7, size: 16 },   // $D6:7EFC
  mask: { fill: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], edge: [11, 12, 13, 14, 15], grow: 2 },
};
