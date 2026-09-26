import type { StyleRomDef } from '../types';
/** VICTORY!: BG1 (paleta 6) montado por mapa de blocos 16×16 (linhas 2–6, colunas 2–14; x = 0 na faixa = x 32,
 *  y = 0 = y 32). Tiles na VRAM da cena `victory`; o laranja da tela final vem de $D6:7CDC (a cena ainda tem o azul de
 *  $D6:7E7C). As letras se sobrepõem (I sob o V, O sobre o T): cada recorte fica só com a letra das sementes. */
export const DEF: StyleRomDef = {
  strips: {
    t: {
      kind: 'grid16', scene: 'victory', region: 'bg', cells: [
        [0x200, 0x202, 0x204, 0x206, 0x208, 0x20a, 0x20c, 0x20e, 0x260, 0x262, 0x286, 0x288, 0x28a],
        [0x220, 0x222, 0x224, 0x226, 0x228, 0x22a, 0x22c, 0x22e, 0x280, 0x282, 0x2a4, 0x2a6, 0x2a8],
        [0x240, 0x242, 0x244, 0x246, 0x248, 0x24a, 0x24c, 0x24e, 0x2a0, 0x2a2, 0x28c, 0x28e, 0x2aa],
        [-1, -1, 0x264, 0x266, -1, 0x26a, 0x26c, 0x26e, 0x2c0, 0x2c2, -1, 0x268, -1],
        [-1, -1, 0x284, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
      ],
    },
  },
  cuts: [
    { ch: 'V', strip: 't', x: 2, w: 41, y: 1, seeds: [[9, 6]] },
    { ch: 'I', strip: 't', x: 29, w: 24, y: 1, seeds: [[36, 25]] },
    { ch: 'C', strip: 't', x: 41, w: 34, y: 1, seeds: [[54, 13]] },
    { ch: 'T', strip: 't', x: 68, w: 45, y: 1, seeds: [[74, 3]] },
    { ch: 'O', strip: 't', x: 93, w: 35, y: 1, seeds: [[113, 16]] },
    { ch: 'R', strip: 't', x: 119, w: 39, y: 1, seeds: [[134, 10]] },
    { ch: 'Y', strip: 't', x: 145, w: 44, y: 1, seeds: [[147, 7]] },
    { ch: '!', strip: 't', x: 179, w: 28, y: 1, seeds: [[193, 8], [183, 42]] },
  ],
  height: 65, spacing: -8, spaceWidth: 12,
  kern: { 'TÓ': -20 },                                  // a barra do T entra no entalhe do O, como na ROM
  palette: { kind: 'rom', addr: 0xd67cdc, size: 16 },
  mask: { fill: [3, 4, 5, 6], edge: [1, 2], grow: 2 },
};
