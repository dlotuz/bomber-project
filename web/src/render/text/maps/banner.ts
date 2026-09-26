import type { GlyphCut, StyleRomDef } from '../types';
// Faixa "PAUSE!/HURRY!/TIME UP!" [CAT §3 "Comum a todas as partidas"]: $D0:F57B, VRAM BG3 $A400 (word $5200), 1024
// bytes, 2bpp, 64 tiles. A VRAM é uma grade de 16 tiles por linha e cada letra tem 16 px de altura: a metade de cima
// vem do tile T e a de baixo do tile T+16 (conferido pixel a pixel contra a tela real de PAUSA/TIME UP na rodada 1).
// Por isso a faixa vira DUAS imagens de 128×16:
//   top    = tiles 0-15 (cima) + 16-31 (baixo): "PAUSE!" em x 8-72 e o começo de "HURRY" (H U R + metade do 2º R) em x 87-127
//   bottom = tiles 32-47 (cima) + 48-63 (baixo): o resto de "HURRY!" (fim do 2º R, Y e o "!") em x 0-23 e "TIME UP!" em
//            x 32-102 (71 px: `meta.timeUpWidth`, igual à largura medida na captura g3_TIMEUP)
// A fonte é cursiva: as letras encostam umas nas outras (o contorno branco de uma toca o corpo verde-escuro da outra)
// e não há coluna vazia entre elas. Cada divisa entre duas letras é medida LINHA A LINHA (a letra da direita começa em
// colunas diferentes em cada uma das 16 linhas): tracei o contorno branco (índice 3) de cada letra, dei cada pedaço de
// contorno à sua letra e pus a divisa logo depois do contorno da esquerda (+ a sombra escura dele), ajustando à mão
// onde o corpo de uma letra (ex.: a barra do meio do E) passava do contorno. As divisas vizinhas são iguais, então os
// recortes (`spans`) particionam a palavra: "PAUSE!" remontado com `spacing` é a faixa original pixel a pixel.
// O `spacing` −4 é a maior sobreposição entre caixas vizinhas; a largura `w` de cada recorte = avanço até a letra
// seguinte na palavra original − spacing (a coluna a mais à direita fica vazia pela máscara).
// Letras cortadas: P A U S E ! de PAUSE!, T I M de TIME UP! e o 1º R de HURRY!. Na faixa, HURRY tem um "!" só (depois
// do Y, em bottom x 16-23); o "!" usado é o de PAUSE!, que é o mesmo desenho e fica no fim da palavra.
// D, O, G e B não existem na faixa: glifos próprios em extra/banner.ts no mesmo traço/índices.
// Paleta: $D6:9172 (4 cores; 1 verde-escuro, 2 verde, 3 branco), batida com a CGRAM da pausa real.
const BASE = 0xd0f57b;
const tile = (t: number): number => BASE + t * 16;

/** Divisas por linha (16 números = coluna da faixa onde começa a letra da direita em cada linha). */
const PAUSE_B = [
  [21, 21, 22, 22, 22, 21, 21, 21, 21, 21, 21, 20, 20, 21, 22, 22], // P|A
  [31, 31, 32, 32, 33, 32, 32, 32, 32, 32, 32, 33, 34, 36, 33, 33], // A|U
  [44, 44, 45, 44, 43, 43, 43, 43, 42, 42, 44, 44, 45, 44, 43, 43], // U|S
  [55, 55, 55, 55, 56, 56, 55, 54, 54, 55, 56, 56, 55, 55, 55, 55], // S|E
  [68, 68, 67, 66, 65, 65, 64, 64, 64, 64, 64, 64, 65, 66, 66, 68], // E|!
];
const TIME_B = [
  [46, 46, 46, 45, 45, 43, 41, 41, 41, 41, 42, 42, 43, 44, 44, 44], // T|I
  [51, 51, 51, 50, 50, 49, 49, 50, 50, 50, 49, 51, 50, 51, 52, 52], // I|M
  [64, 64, 65, 64, 63, 64, 62, 63, 63, 62, 64, 63, 64, 65, 65, 65], // M|E
];
const HURRY_B = [
  [111, 111, 113, 113, 112, 110, 110, 111, 111, 110, 110, 112, 111, 112, 111, 111], // U|R
  [121, 121, 123, 124, 123, 121, 121, 122, 122, 122, 121, 123, 124, 123, 123, 123], // R|R
];
const flat = (x: number): number[] => Array.from({ length: 16 }, () => x);

/** Recortes de uma palavra: letra i vai da divisa i−1 à divisa i em cada linha; `rects` = [x, w] da caixa de cada letra. */
function word(strip: string, chars: string, bounds: readonly (readonly number[])[], rects: readonly (readonly [number, number])[]): GlyphCut[] {
  return [...chars].flatMap((ch, i) => {
    if (ch === '_') return [];
    const [x, w] = rects[i];
    const l = bounds[i], r = bounds[i + 1];
    return [{ ch, strip, x, w, spans: l.map((a, y) => [a, r[y]] as const) }];
  });
}

export const DEF: StyleRomDef = {
  strips: {
    top: { kind: 'raw', rows: [tile(0), tile(16)], tiles: 16, bpp: 2 },
    bottom: { kind: 'raw', rows: [tile(32), tile(48)], tiles: 16, bpp: 2 },
  },
  cuts: [
    ...word('top', 'PAUSE!', [flat(8), ...PAUSE_B, flat(73)], [[8, 16], [20, 16], [32, 14], [42, 16], [54, 14], [64, 9]]),
    ...word('bottom', 'TIM', [flat(32), ...TIME_B], [[32, 15], [43, 10], [49, 17]]),
    ...word('top', '_R', [flat(84), ...HURRY_B], [[0, 0], [110, 15]]),
  ],
  height: 16,
  spacing: -4,
  spaceWidth: 10,
  palette: { kind: 'rom', addr: 0xd69172, size: 4 },
  tones: { green: 0xd69172 },
  meta: { timeUpWidth: 71 },  // largura de "TIME UP!" na faixa (x 32-102) = captura g3_TIMEUP; R27
};
