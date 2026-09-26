import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo ascii8 (8×8). Acentos: `base` reaproveita a letra recortada da ROM em tempo de execução
// (maps/ascii8.ts) — nenhum pixel dela é guardado aqui (mecanismo do T18, `text.ts` `overlay`/`ExtraGlyph.base`).
// Nas letras da ROM só a linha 7 (a última) vem em branco (linhas 0-6 têm a letra inteira); como `overlay` não desloca
// nem encolhe a base, não há espaço livre em cima para o acento "correto" sem apagar parte da letra — os 5 acentos
// (Ã Ê Ó Õ Ú) e a cedilha de Ç saem todos na linha 7 (a única linha livre em todas), com traços de 1 px na cor 3
// (tinta branca, igual ao resto da fonte) para não colidir com a letra. Formas simplificadas por causa da resolução
// 8×8 (tônico = 1 traço, circunflexo = 2 traços, til = 3 traços, cedilha = gancho), mas cada um tem um padrão
// diferente para não se confundirem.
const til = '13131311';
const circunflexo = '11311311';
const agudo = '11111311';
const cedilha = '11133111';

export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'Ã', base: 'A', rows: ['........', '........', '........', '........', '........', '........', '........', til] },
  { ch: 'Ê', base: 'E', rows: ['........', '........', '........', '........', '........', '........', '........', circunflexo] },
  { ch: 'Ó', base: 'O', rows: ['........', '........', '........', '........', '........', '........', '........', agudo] },
  { ch: 'Õ', base: 'O', rows: ['........', '........', '........', '........', '........', '........', '........', til] },
  { ch: 'Ú', base: 'U', rows: ['........', '........', '........', '........', '........', '........', '........', agudo] },
  { ch: 'Ç', base: 'C', rows: ['........', '........', '........', '........', '........', '........', '........', cedilha] },
  // Sem base na ROM (não existe em PAUSE!/HURRY!/TIME UP! nem no ASCII 8×8): desenho próprio no mesmo estilo (2
  // traços diagonais de 1 px, cor 3 sobre fundo 1), usado só em "CARREGADA ✓" (romOk).
  { ch: '✓', rows: ['11111111', '11111111', '11111113', '11111131', '13111311', '11313111', '11131111', '11111111'] },
];
