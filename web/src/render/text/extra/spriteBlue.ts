import type { ExtraGlyph } from '../types';
// Glifos próprios do estilo spriteBlue: as 8 faixas de texto cru da cena `stagesel` só têm "Select a stage!",
// "BATTLE START!" e os 10 nomes de fase em inglês — não cobrem várias letras maiúsculas (C D F G H M N O P),
// minúsculas (b d f h i m n o p q r u v x), dígitos, hífen e acentos usados nos nomes de fase em PT-BR. Em vez de
// caçar cada uma nas 10 faixas de nomes (fora do tempo da tarefa), são desenho nosso: traço único cor 15 (`f`, o
// branco/realce mais claro da rampa cinza-azulada da ROM — não a rampa inteira de 1-15 letra a letra à mão) sobre
// fundo transparente, altura 8, dígitos em estilo "relógio digital" (7 segmentos) e letras em blocos simples.
// Acentos (á ã ç, minúsculos — só assim aparecem nos nomes de fase) reaproveitam a letra recortada da ROM com
// `base` (mecanismo do T18, só vale quando a letra-base tem corte da ROM — ver `glyphChars` em text.ts): á/ã sobre
// o "a" da ROM (linhas 0-3 do corte ficam livres), ç sobre o "c" da ROM (sem linha livre embaixo — a cedilha sai em
// cima também, mesma solução do ascii8). í não tem letra-base da ROM (o "i" também é glifo próprio), então sai
// inteiro (traço + acento) como os demais.
export const EXTRA: readonly ExtraGlyph[] = [
  { ch: '-', rows: ['........', '........', '........', '........', '..ffff..', '........', '........', '........'] },
  { ch: '0', rows: ['........', '..ffff..', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..ffff..'] },
  { ch: '1', rows: ['........', '.....f..', '.....f..', '.....f..', '.....f..', '.....f..', '.....f..', '.....f..'] },
  { ch: '2', rows: ['........', '..ffff..', '.....f..', '.....f..', '..ffff..', '..f.....', '..f.....', '..ffff..'] },
  { ch: '3', rows: ['........', '..ffff..', '.....f..', '.....f..', '..ffff..', '.....f..', '.....f..', '..ffff..'] },
  { ch: '4', rows: ['........', '..f..f..', '..f..f..', '..f..f..', '..ffff..', '.....f..', '.....f..', '.....f..'] },
  { ch: '5', rows: ['........', '..ffff..', '..f.....', '..f.....', '..ffff..', '.....f..', '.....f..', '..ffff..'] },
  { ch: '6', rows: ['........', '..ffff..', '..f.....', '..f.....', '..ffff..', '..f..f..', '..f..f..', '..ffff..'] },
  { ch: '7', rows: ['........', '..ffff..', '.....f..', '.....f..', '.....f..', '.....f..', '.....f..', '.....f..'] },
  { ch: '8', rows: ['........', '..ffff..', '..f..f..', '..f..f..', '..ffff..', '..f..f..', '..f..f..', '..ffff..'] },
  { ch: '9', rows: ['........', '..ffff..', '..f..f..', '..f..f..', '..ffff..', '.....f..', '.....f..', '..ffff..'] },
  { ch: 'C', rows: ['........', '...fff..', '..f.....', '..f.....', '..f.....', '..f.....', '..f.....', '...fff..'] },
  { ch: 'D', rows: ['........', '..fff...', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..fff...'] },
  { ch: 'F', rows: ['........', '..ffff..', '..f.....', '..f.....', '..fff...', '..f.....', '..f.....', '..f.....'] },
  { ch: 'G', rows: ['........', '...fff..', '..f.....', '..f.....', '..f.ff..', '..f..f..', '..f..f..', '...fff..'] },
  { ch: 'H', rows: ['........', '..f..f..', '..f..f..', '..f..f..', '..ffff..', '..f..f..', '..f..f..', '..f..f..'] },
  { ch: 'M', rows: ['........', '..f..f..', '..ffff..', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..f..f..'] },
  { ch: 'N', rows: ['........', '..f..f..', '..f..f..', '..ff.f..', '..f..f..', '..f.ff..', '..f..f..', '..f..f..'] },
  { ch: 'O', rows: ['........', '...ff...', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '...ff...'] },
  { ch: 'P', rows: ['........', '..ffff..', '..f..f..', '..f..f..', '..ffff..', '..f.....', '..f.....', '..f.....'] },
  { ch: 'b', rows: ['........', '..f.....', '..f.....', '..fff...', '..f..f..', '..f..f..', '..f..f..', '..fff...'] },
  { ch: 'd', rows: ['........', '.....f..', '.....f..', '...fff..', '..f..f..', '..f..f..', '..f..f..', '...fff..'] },
  { ch: 'f', rows: ['........', '...fff..', '...f....', '..fff...', '...f....', '...f....', '...f....', '...f....'] },
  { ch: 'h', rows: ['........', '..f.....', '..f.....', '..fff...', '..f..f..', '..f..f..', '..f..f..', '..f..f..'] },
  { ch: 'i', rows: ['........', '...f....', '........', '...f....', '...f....', '...f....', '...f....', '...f....'] },
  { ch: 'm', rows: ['........', '........', '........', '.fffff..', '.f.f.f..', '.f.f.f..', '.f.f.f..', '.f.f.f..'] },
  { ch: 'n', rows: ['........', '........', '........', '..fff...', '..f..f..', '..f..f..', '..f..f..', '..f..f..'] },
  { ch: 'o', rows: ['........', '........', '........', '...ff...', '..f..f..', '..f..f..', '..f..f..', '...ff...'] },
  { ch: 'p', rows: ['........', '........', '........', '..fff...', '..f..f..', '..f..f..', '..ffff..', '..f.....'] },
  { ch: 'q', rows: ['........', '........', '........', '...fff..', '..f..f..', '..f..f..', '..ffff..', '.....f..'] },
  { ch: 'r', rows: ['........', '........', '........', '..ffff..', '..f.....', '..f.....', '..f.....', '..f.....'] },
  { ch: 'u', rows: ['........', '........', '........', '..f..f..', '..f..f..', '..f..f..', '..f..f..', '...fff..'] },
  { ch: 'v', rows: ['........', '........', '........', '..f..f..', '..f..f..', '..f..f..', '...ff...', '........'] },
  { ch: 'x', rows: ['........', '........', '........', '..f..f..', '...ff...', '...ff...', '..f..f..', '........'] },
  { ch: 'á', base: 'a', rows: ['...f....', '..f.....', '........', '........', '........', '........', '........', '........'] },
  { ch: 'ã', base: 'a', rows: ['..f.f...', '.f...f..', '........', '........', '........', '........', '........', '........'] },
  { ch: 'ç', base: 'c', rows: ['..f.....', '...f....', '........', '........', '........', '........', '........', '........'] },
  { ch: 'í', rows: ['...f....', '..f.....', '........', '...f....', '...f....', '...f....', '...f....', '...f....'] },
];
