import type { StyleRomDef } from '../types';
/** DRAW GAME: textura Modo 7 (8 bits; a faixa é o canto 240×160 da textura, em coordenadas da textura). Fundo = índices
 *  1/17/33; cada letra usa uma rampa (verde 5–15, laranja 21–31, amarelo 37–47; o 1º índice da rampa é o contorno).
 *  Letras separadas pelas sementes (fundo fora). DRAW nas linhas 32–84, GAME nas linhas 96–148. */
export const DEF: StyleRomDef = {
  strips: { t: { kind: 'mode7', x: 0, y: 0, w: 240, h: 160 } },
  cuts: [
    { ch: 'D', strip: 't', x: 35, w: 41, y: 32, seeds: [[51, 33]] },
    { ch: 'R', strip: 't', x: 82, w: 41, y: 32, seeds: [[100, 33]] },
    { ch: 'A', strip: 't', x: 129, w: 44, y: 32, seeds: [[146, 33]] },
    { ch: 'W', strip: 't', x: 176, w: 42, y: 32, seeds: [[207, 34]] },
    { ch: 'G', strip: 't', x: 32, w: 43, y: 96, seeds: [[46, 97]] },
    { ch: 'M', strip: 't', x: 128, w: 42, y: 96, seeds: [[135, 98]] },
    { ch: 'E', strip: 't', x: 176, w: 39, y: 96, seeds: [[190, 99]] },
  ],
  height: 53, spacing: 3, spaceWidth: 16,          // vão de ~3 px como A→W do original; EMPATE = 255 px
  palette: { kind: 'scene', scene: 'draw2', row: 0, size: 256 },
  mask: {
    fill: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47],
    edge: [5, 21, 37], grow: 1,
  },
};
