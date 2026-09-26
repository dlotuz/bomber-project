import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo banner (altura 8, mesmos 4 índices de cor da ROM: 0 vazio, 1 sombra verde-escura,
// 2 preenchimento verde, 3 contorno/brilho branco). D, O, G e B não existem em PAUSE!/HURRY!!/TIME UP!, então são
// desenho nosso (formas em negrito só com os índices da ROM, sem tentar imitar o traço cursivo exato — a arte
// original é pintada à mão, não dá para reproduzir por regra). Á reaproveita o A recortado da ROM (`base: 'A'`,
// mecanismo do T18) com um acento agudo próprio na linha de cima, que na faixa de "PAUSE!" fica quase toda livre.
export const EXTRA: readonly ExtraGlyph[] = [
  { ch: 'O', rows: ['...33...', '.333331.', '.322221.', '33222211', '33222211', '.322221.', '.111111.', '...11...'] },
  { ch: 'D', rows: ['323333..', '32...31.', '32...21.', '32...21.', '32...21.', '32...21.', '32...11.', '321111..'] },
  { ch: 'G', rows: ['...33...', '.333331.', '.32222..', '332222..', '3322221.', '.32222..', '.111111.', '...11...'] },
  { ch: 'B', rows: ['323333..', '3222223.', '3222221.', '322222..', '322222..', '3222222.', '3222221.', '321111..'] },
  { ch: 'Á', base: 'A', rows: ['..3.3...', '...3....', '........', '........', '........', '........', '........', '........'] },
];
