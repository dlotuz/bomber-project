import type { ExtraGlyph } from '../types';
/** Glifos próprios da fonte cursiva dos menus (a mesma de `menuTitle`; ver maps/menuItem.ts). Só o que não existe em
 * nenhuma frase da ROM das cenas de menu: E, J, q, j, º e ∞; e os acentos PT-BR por cima das letras da ROM (`base`,
 * sem pixel delas aqui). Desenhados na regra da fonte medida nas letras da ROM: traço de 1 px inclinado, cor por
 * LINHA (f nas linhas 1–2, e 3–5, d 6–7, c 8–9, b 10–11, a 12–14 da perna de baixo), aro 1 em volta do traço; a
 * sombra 2 sai do `outline.below` da frase, como nas letras recortadas. Minúsculas com topo na linha 4 (aro) e
 * base na 12; maiúsculas da linha 0 à 12. Acentos nas linhas 0–3, encostados no aro da letra (linha 4), com aro
 * próprio — como o pingo do i da ROM. */
const W = (n: number): string => '.'.repeat(n);
/** 16 linhas de largura `w`: `lines` a partir da linha `top`, o resto vazio. */
function rows16(w: number, top: number, lines: readonly string[]): string[] {
  return Array.from({ length: 16 }, (_, y) => lines[y - top] ?? W(w));
}

export const CURSIVE_EXTRA: readonly ExtraGlyph[] = [
  { ch: 'E', rows: rows16(10, 0, [
    '...11111..',
    '..1fffff1.',
    '.1f11111f1',
    '.1e1....1.',
    '.1e1......',
    '.1e1111...',
    '1dddddd1..',
    '1d111111..',
    '1c1.......',
    '1c1.......',
    '1b1111111.',
    '1bbbbbbbb1',
    '.11111111.',
  ]) },
  // b (título "Jogabilidade" das Opções): haste como a do E e bojo fechado embaixo, cor por linha como nas demais
  { ch: 'b', rows: rows16(9, 0, [
    '..11.....',
    '.1ff1....',
    '.1f1.....',
    '.1e1.....',
    '.1e1111..',
    '1eeeeee1.',
    '1d1111d1.',
    '1d1..1d1.',
    '1c1..1c1.',
    '1c1.1cc1.',
    '1b111b1..',
    '1bbbb1...',
    '.1111....',
  ]) },
  { ch: 'J', rows: rows16(10, 0, [
    '....11111.',
    '...1fffff1',
    '....11f11.',
    '.....1e1..',
    '.....1e1..',
    '.....1e1..',
    '....1d1...',
    '....1d1...',
    '.1..1c1...',
    '1c1.1c1...',
    '1b111b1...',
    '.1bbb1....',
    '..111.....',
  ]) },
  { ch: 'q', rows: rows16(9, 4, [
    '....111..',
    '...1eee1.',
    '..1d111d1',
    '11d1..1d1',
    '1c1..1cc1',
    '1c111c1c1',
    '11bbb11b1',
    '.11111b1.',
    '....1a1..',
    '....1aa1.',
    '.....11..',
  ]) },
  { ch: 'j', rows: rows16(7, 0, [
    '....11.',
    '...1ff1',
    '..1f1f1',
    '..1ee1.',
    '...11..',
    '...1e1.',
    '..1dd1.',
    '..11d1.',
    '...1c1.',
    '...1c1.',
    '...1b1.',
    '..11b1.',
    '1a11a1.',
    '.1aa1..',
    '..11...',
  ]) },
  { ch: 'º', rows: rows16(6, 1, [
    '..11..',
    '.1ff1.',
    '1e11e1',
    '1e11e1',
    '.1ee1.',
    '..11..',
    '.1111.',
    '1cccc1',
    '.1111.',
  ]) },
  { ch: '∞', rows: rows16(11, 5, [
    '.1111.1111.',
    '11dd111dd11',
    '1d11d1d11d1',
    '1c111c111c1',
    '1c11c1c11c1',
    '11bb111bb11',
    '.1111.1111.',
  ]) },
  // acentos (linhas 0–3) e cedilha (linhas 12–15) sobre a letra da ROM
  { ch: 'í', base: 'ı', rows: rows16(5, 0, [
    '..111',
    '.11f1',
    '.1f11',
    '.111.',
  ]) },
  { ch: 'ú', base: 'u', rows: rows16(9, 0, [
    '.....111.',
    '....11f1.',
    '....1f11.',
    '....111..',
  ]) },
  { ch: 'ô', base: 'o', rows: rows16(9, 0, [
    '....111..',
    '...11f11.',
    '...1f1f1.',
    '...11111.',
  ]) },
  { ch: 'ã', base: 'a', rows: rows16(9, 0, [
    '..1111111',
    '.11ff11f1',
    '.1f11ff11',
    '.1111111.',
  ]) },
  { ch: 'õ', base: 'o', rows: rows16(9, 0, [
    '..1111111',
    '.11ff11f1',
    '.1f11ff11',
    '.1111111.',
  ]) },
  { ch: 'ç', base: 'c', rows: rows16(9, 12, [
    '...1a1...',
    '...11a1..',
    '..1aa11..',
    '..1111...',
  ]) },
];

export const EXTRA: readonly ExtraGlyph[] = CURSIVE_EXTRA;
