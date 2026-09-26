import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo spriteBlue: as 8 faixas de texto cru da cena `stagesel` só têm "Select a stage!",
// "BATTLE START!" e os 10 nomes de fase em inglês — não cobrem várias letras maiúsculas (C D F G H M N O P),
// minúsculas (b d f h i m n o p q r u v x), dígitos, hífen e acentos usados nos nomes de fase em PT-BR. Em vez de
// caçar cada uma nas 10 faixas de nomes (fora do tempo da tarefa), são desenho nosso: traço único, mas na MESMA
// rampa de sombra das letras vizinhas da ROM, não uma cor lisa. Medi o índice de cor dominante por linha nas letras
// recortadas (S e l c t a s g ! de "Select a stage!"): linha 0 sem tinta, linha 1 índice 15 (branco/realce, moda em
// 7 amostras), linhas 2-3 transição 14/15, linhas 4-5 índice 14 (moda), linhas 6-7 índice 13 (moda) — um degradê
// de cima (mais claro) para baixo (um pouco mais escuro), com contorno 1 (mais escuro) por baixo/fora do traço.
// Uso esse perfil por linha (1,15,15,14,14,14,13,13) no traço de cada glifo próprio, altura 8, dígitos em estilo
// "relógio digital" (7 segmentos) e letras em blocos simples.
// Acentos (á ã ç, minúsculos — só assim aparecem nos nomes de fase) reaproveitam a letra recortada da ROM com
// `base` (mecanismo do T18, só vale quando a letra-base tem corte da ROM — ver `glyphChars` em text.ts): á/ã ficam
// em cima do "a" da ROM (linhas 0-3 do corte já vêm em branco, cabe sem encolher nada). ç é a exceção correta (vai
// embaixo por convenção do português) — o "c" da ROM não deixa uma linha 7 totalmente livre, então o gancho da
// cedilha ocupa 1 px na linha 7 que já era só contorno (índice 1, o de menor peso visual) da letra. í não tem
// letra-base da ROM (o "i" também é glifo próprio), então sai inteiro (traço + acento) como os demais.
export const EXTRA: readonly ExtraGlyph[] = [
  { ch: '-', rows: ['........', '........', '........', '........', '..eeee..', '........', '........', '........'] },
  { ch: '0', rows: ['........', '..ffff..', '..f..f..', '..e..e..', '..e..e..', '..e..e..', '..d..d..', '..dddd..'] },
  { ch: '1', rows: ['........', '.....f..', '.....f..', '.....e..', '.....e..', '.....e..', '.....d..', '.....d..'] },
  { ch: '2', rows: ['........', '..ffff..', '.....f..', '.....e..', '..eeee..', '..e.....', '..d.....', '..dddd..'] },
  { ch: '3', rows: ['........', '..ffff..', '.....f..', '.....e..', '..eeee..', '.....e..', '.....d..', '..dddd..'] },
  { ch: '4', rows: ['........', '..f..f..', '..f..f..', '..e..e..', '..eeee..', '.....e..', '.....d..', '.....d..'] },
  { ch: '5', rows: ['........', '..ffff..', '..f.....', '..e.....', '..eeee..', '.....e..', '.....d..', '..dddd..'] },
  { ch: '6', rows: ['........', '..ffff..', '..f.....', '..e.....', '..eeee..', '..e..e..', '..d..d..', '..dddd..'] },
  { ch: '7', rows: ['........', '..ffff..', '.....f..', '.....e..', '.....e..', '.....e..', '.....d..', '.....d..'] },
  { ch: '8', rows: ['........', '..ffff..', '..f..f..', '..e..e..', '..eeee..', '..e..e..', '..d..d..', '..dddd..'] },
  { ch: '9', rows: ['........', '..ffff..', '..f..f..', '..e..e..', '..eeee..', '.....e..', '.....d..', '..dddd..'] },
  { ch: 'C', rows: ['........', '...fff..', '..f.....', '..e.....', '..e.....', '..e.....', '..d.....', '...ddd..'] },
  { ch: 'D', rows: ['........', '..fff...', '..f..f..', '..e..e..', '..e..e..', '..e..e..', '..d..d..', '..ddd...'] },
  { ch: 'F', rows: ['........', '..ffff..', '..f.....', '..e.....', '..eee...', '..e.....', '..d.....', '..d.....'] },
  { ch: 'G', rows: ['........', '...fff..', '..f.....', '..e.....', '..e.ee..', '..e..e..', '..d..d..', '...ddd..'] },
  { ch: 'H', rows: ['........', '..f..f..', '..f..f..', '..e..e..', '..eeee..', '..e..e..', '..d..d..', '..d..d..'] },
  { ch: 'M', rows: ['........', '..f..f..', '..ffff..', '..e..e..', '..e..e..', '..e..e..', '..d..d..', '..d..d..'] },
  { ch: 'N', rows: ['........', '..f..f..', '..f..f..', '..ee.e..', '..e..e..', '..e.ee..', '..d..d..', '..d..d..'] },
  { ch: 'O', rows: ['........', '...ff...', '..f..f..', '..e..e..', '..e..e..', '..e..e..', '..d..d..', '...dd...'] },
  { ch: 'P', rows: ['........', '..ffff..', '..f..f..', '..e..e..', '..eeee..', '..e.....', '..d.....', '..d.....'] },
  { ch: 'b', rows: ['........', '..f.....', '..f.....', '..eee...', '..e..e..', '..e..e..', '..d..d..', '..ddd...'] },
  { ch: 'd', rows: ['........', '.....f..', '.....f..', '...eee..', '..e..e..', '..e..e..', '..d..d..', '...ddd..'] },
  { ch: 'f', rows: ['........', '...fff..', '...f....', '..eee...', '...e....', '...e....', '...d....', '...d....'] },
  { ch: 'h', rows: ['........', '..f.....', '..f.....', '..eee...', '..e..e..', '..e..e..', '..d..d..', '..d..d..'] },
  { ch: 'i', rows: ['........', '...f....', '........', '...e....', '...e....', '...e....', '...d....', '...d....'] },
  { ch: 'm', rows: ['........', '........', '........', '.eeeee..', '.e.e.e..', '.e.e.e..', '.d.d.d..', '.d.d.d..'] },
  { ch: 'n', rows: ['........', '........', '........', '..eee...', '..e..e..', '..e..e..', '..d..d..', '..d..d..'] },
  { ch: 'o', rows: ['........', '........', '........', '...ee...', '..e..e..', '..e..e..', '..d..d..', '...dd...'] },
  { ch: 'p', rows: ['........', '........', '........', '..eee...', '..e..e..', '..e..e..', '..dddd..', '..d.....'] },
  { ch: 'q', rows: ['........', '........', '........', '...eee..', '..e..e..', '..e..e..', '..dddd..', '.....d..'] },
  { ch: 'r', rows: ['........', '........', '........', '..eeee..', '..e.....', '..e.....', '..d.....', '..d.....'] },
  { ch: 'u', rows: ['........', '........', '........', '..e..e..', '..e..e..', '..e..e..', '..d..d..', '...ddd..'] },
  { ch: 'v', rows: ['........', '........', '........', '..e..e..', '..e..e..', '..e..e..', '...dd...', '........'] },
  { ch: 'x', rows: ['........', '........', '........', '..e..e..', '...ee...', '...ee...', '..d..d..', '........'] },
  { ch: 'á', base: 'a', rows: ['........', '........', '........', '...f....', '........', '........', '........', '........'] },
  { ch: 'ã', base: 'a', rows: ['........', '........', '........', '..f.f...', '........', '........', '........', '........'] },
  { ch: 'ç', base: 'c', rows: ['........', '........', '........', '........', '........', '........', '........', '.f......'] },
  { ch: 'í', rows: ['...f....', '..f.....', '........', '...e....', '...e....', '...e....', '...d....', '...d....'] },
];
