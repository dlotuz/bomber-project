import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo banner (altura 16, mesmos 4 índices de cor da ROM: 0 vazio, 1 sombra verde-escura,
// 2 preenchimento verde, 3 contorno/brilho branco). D, O, G e B não existem em PAUSE!/HURRY!!/TIME UP!, então são
// desenho nosso (formas em negrito arredondadas nos mesmos índices — a arte original é pintada à mão letra por
// letra, então não dá pra reproduzir o traço cursivo exato por regra, só a paleta/altura/espessura). Á reaproveita
// o A recortado da ROM (`base: 'A'`, mecanismo do T18): a linha 0 do corte do A vem toda em branco (0), então o
// acento entra ali sem tocar a letra.
export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'O', rows: [
    '........', '...33...', '..3333..', '.332231.', '.322221.', '.322221.', '.222222.', '32222221',
    '32222221', '32222221', '32222221', '.222222.', '.322221.', '.322221.', '.312211.', '..1111..',
  ] },
  { ch: 'D', rows: [
    '3233333..', '32333333.', '32222221.', '32222221.', '32222221.', '32222221.', '32222221.', '32222221.',
    '32222221.', '32222221.', '32222221.', '32222221.', '32222221.', '32222221.', '32111111.', '3211111..',
  ] },
  { ch: 'G', rows: [
    '........', '...33...', '..3333..', '.332231.', '.322221.', '.322221.', '.322222.', '3222222.',
    '32222221', '3222222.', '3222222.', '.3222221', '.322221.', '.322221.', '.312211.', '..1111..',
  ] },
  { ch: 'B', rows: [
    '323333..', '322223..', '322222..', '322222..', '322222..', '322222..', '322222..', '322222..',
    '322222..', '322221..', '322221..', '322221..', '322221..', '322221..', '322221..', '321111..',
  ] },
  { ch: 'Á', base: 'A', rows: [
    '..3.3...', '........', '........', '........', '........', '........', '........', '........',
    '........', '........', '........', '........', '........', '........', '........', '........',
  ] },
];
