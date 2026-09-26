import type { ExtraGlyph } from '../types';
/** H próprio (desenho original): traço de 1 px com a mesma rampa por linha das letras da ROM (f, e, d, c, b), contorno 1,
 *  sombra 2 e a mesma inclinação (1 px a cada ~3 linhas) de L/T/A de BATTLE START!. */
export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'H', rows: [
    '...1.....1.',
    '..1f1...1f1',
    '.1f12..1f12',
    '.1e1...1e1.',
    '1e12..1e12.',
    '1e11111e1..',
    '1ddddddd1..',
    '1d11111d12.',
    '1c12221c1..',
    '1c1...1c1..',
    '1b1...1b1..',
    '1b1...1b1..',
    '212...212..',
    '.2.....2...',
  ] },
];
