import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo spriteBlue (16 px). O bloco de texto da ROM (maps/spriteBlue.ts) não tem N, G, q, v, x nem
// acentos. Desenho no mesmo esquema das letras da ROM: traço de 1 px da rampa azul com a cor POR LINHA igual à das
// letras vizinhas (f nas linhas 1-2, e em 3-5, d em 6-7, c em 8-9, b em 10-11, a no descendente 12-15), contorno 1 em
// volta, sombra 2 embaixo/à esquerda, a mesma inclinação (o traço anda 1 px para a esquerda a cada ~4 linhas) e as
// mesmas alturas (maiúscula linhas 0-13, minúscula 4-13).
// G = C da ROM + a barra de dentro; q = a da ROM + a haste descendo à direita; á/ã = a da ROM + acento nas linhas 0-3
// (livres acima do a); ç = c da ROM + cedilha nas linhas 13-15; í = i da ROM com o pingo virado acento agudo.
const blank = (w: number, n: number): string[] => Array.from({ length: n }, () => '.'.repeat(w));

export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'N', rows: [
    '...1....1..',
    '..1f1..1f1.',
    '..1ff1.1f1.',
    '.1e1e1.1e1.',
    '.1e11e11e1.',
    '.1e1.1e1e1.',
    '.1d1..1dd1.',
    '1d12...1d1.',
    '1c1....1c1.',
    '1c1....1c1.',
    '1b1....1b1.',
    '1b1...1b12.',
    '212...212..',
    '.2.....2...',
    ...blank(11, 2),
  ] },
  { ch: 'v', rows: [
    ...blank(9, 4),
    '..1....1.',
    '.1e1..1e1',
    '1d12..1d1',
    '1d1...1d1',
    '1c1..1c12',
    '1c1.1c12.',
    '1b11b12..',
    '21bb12...',
    '.2112....',
    '..22.....',
    ...blank(9, 2),
  ] },
  { ch: 'x', rows: [
    ...blank(9, 4),
    '..1....1.',
    '.1e1..1e1',
    '.21d11d12',
    '..21dd12.',
    '..1cc12..',
    '.1c121c1.',
    '1b12.1b1.',
    '1b1..21b1',
    '212...212',
    '.2.....2.',
    ...blank(9, 2),
  ] },
  { ch: 'G', base: 'C', rows: [
    ...blank(9, 6),
    '....1111.',
    '...1ddd1.',
    ...blank(9, 8),
  ] },
  { ch: 'q', base: 'a', rows: [
    ...blank(8, 11),
    '......b1',
    '......a1',
    '.....1a1',
    '.....1a2',
    '......2.',
  ] },
  { ch: 'á', base: 'a', rows: ['.....11.', '....1f1.', '...1f1..', '...11...', ...blank(8, 12)] },
  { ch: 'ã', base: 'a', rows: ['........', '..11..1.', '.1ff11f1', '..1..11.', ...blank(8, 12)] },
  { ch: 'ç', base: 'c', rows: [...blank(7, 13), '...1a1.', '....1a1', '..1112.'] },
  { ch: 'í', base: 'i', rows: ['...1', '..1f', '.1f1', '1f11', ...blank(4, 12)] },
];
