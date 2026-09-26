import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo ascii8 (8×8). Acentos: `base` reaproveita a letra recortada da ROM em tempo de execução
// (maps/ascii8.ts) — nenhum pixel dela é guardado aqui. Regra do plano (§1.2 item 3): acento sempre EM CIMA da letra
// em PT-BR; como as letras da ROM já ocupam as 8 linhas inteiras (só a linha 7 vem em branco, sem sobra no topo),
// os 5 acentos de cima (Ã Ê Ó Õ Ú) usam `shrinkTop: 1`: a letra-base perde 1 linha REPETIDA (igual à de cima, a mais
// perto do meio — ex.: no A some a 2ª linha das pernas de cima, não a barra) e desce 1 linha, abrindo a linha 0 para o
// acento. A cedilha de Ç é a exceção correta (vai embaixo por convenção) e não precisa encolher: a letra C já deixa a
// linha 7 livre sozinha.
const til = '13131311';
const circunflexo = '11311311';
const agudo = '11111311';
const cedilha = '11133111';

const blank7 = ['........', '........', '........', '........', '........', '........', '........'];

export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'Ã', base: 'A', shrinkTop: 1, rows: [til, ...blank7] },
  { ch: 'Ê', base: 'E', shrinkTop: 1, rows: [circunflexo, ...blank7] },
  { ch: 'Ó', base: 'O', shrinkTop: 1, rows: [agudo, ...blank7] },
  { ch: 'Õ', base: 'O', shrinkTop: 1, rows: [til, ...blank7] },
  { ch: 'Ú', base: 'U', shrinkTop: 1, rows: [agudo, ...blank7] },
  { ch: 'Ç', base: 'C', rows: ['........', '........', '........', '........', '........', '........', '........', cedilha] },
  // Sem base na ROM (não existe em PAUSE!/HURRY!/TIME UP! nem no ASCII 8×8): desenho próprio no mesmo estilo (2
  // traços diagonais de 1 px, cor 3 sobre fundo 1), usado só em "CARREGADA ✓" (romOk).
  { ch: '✓', rows: ['11111111', '11111111', '11111113', '11111131', '13111311', '11313111', '11131111', '11111111'] },
];
