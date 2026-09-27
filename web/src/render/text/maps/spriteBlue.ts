import type { GlyphCut, StyleRomDef } from '../types';
// Texto OBJ 4bpp cru da cena `stagesel` [CAT §5 stagesel]: um bloco contínuo a partir de $E0:0021 (os oito endereços do
// CAT — $E0:0021, 0819, 1011, 1809, 2001, 27F9, 2FF1, 37E9 — são pedaços desse mesmo bloco, DMA para VRAM $6000..). A
// VRAM dos OBJ é uma grade de 16 tiles por linha e as letras têm 16 px (tile T em cima, T+16 embaixo), em largura
// proporcional. Decodificado como 32 linhas de 16 tiles (uma a cada $200 bytes), o bloco vira 16 linhas de texto de 16 px:
//    0 "Select a stage! B"   1 "ATTLE START!"   2 "Sta  1 2 3 4 5"   3 "6 7 8 9 10  11"   4 "12  The Classic"
//    5 "Fast 'n' Slow Orb-"  6 "ital Bombardment"  7 "Don't Push MeSc"  8 "hool of Hard Shock"  9 "ks Totally Floored"
//   10 "d Hide and Blow"  11 "Seek Spinny Slot"  12 "ts Seesaw Yeehaw"  13 "w Sartorial Shena"  14 "nigens Sheer Cart"
//   15 "AttackFlag Tag"
// Cortes proporcionais pelo perfil de colunas: o CORPO das letras (índices 10-15, a rampa azul) tem colunas vazias
// entre letras; o contorno (1) e a sombra (2) encostam. Cada recorte = colunas do corpo + 1 coluna de cada lado (o
// contorno), então a letra sai inteira; dentro das palavras minúsculas da ROM os corpos ficam a 1 coluna um do outro
// (a coluna de contorno é dividida), daí `spacing` −1: "stage!" e "Select" remontados saem iguais à faixa. Nas
// maiúsculas a ROM às vezes deixa 2-3 colunas (ex.: "START"), que aqui ficam 1-2 px mais juntas. Onde dois corpos se
// tocam (P|u em "Push", i|n em "Spinny") a divisa é a coluna do contorno entre eles (x 63 e x 73), conferida na imagem.
// De cada letra repetida usei a ocorrência dentro de palavra mais limpa; "Select a stage!" inteiro vem da linha 0.
// Não existem no bloco: N, G, q, v, x (e os acentos) — em extra/spriteBlue.ts, com a mesma rampa por linha.
// Paleta: `stagesel`, CGRAM linha 9 (OBJ 1): 1 = azul (0,16,248) do contorno, 2 = preto da sombra, 10-15 = rampa
// (56,136,248) … branco — as cores do título na captura.
const cut = (ch: string, line: number, x: number, w: number): GlyphCut => ({ ch, strip: 'f', x, w, y: line * 16, h: 16 });

export const DEF: StyleRomDef = {
  strips: { f: { kind: 'raw', rows: Array.from({ length: 32 }, (_, k) => 0xe00021 + k * 0x200), tiles: 16, bpp: 4 } },
  cuts: [
    cut('S', 0, 1, 10), cut('l', 0, 18, 5), cut('c', 0, 30, 9), cut('s', 0, 64, 9), cut('t', 0, 72, 9),
    cut('a', 0, 80, 9), cut('g', 0, 88, 9), cut('e', 0, 96, 9), cut('!', 0, 104, 5), cut('L', 1, 32, 10),
    cut('E', 1, 43, 10), cut('T', 1, 72, 11), cut('A', 1, 82, 11), cut('R', 1, 94, 9), cut('1', 2, 50, 10),
    cut('2', 2, 66, 10), cut('3', 2, 82, 10), cut('4', 2, 98, 10), cut('5', 2, 114, 10), cut('6', 3, 2, 10),
    cut('7', 3, 18, 10), cut('8', 3, 34, 10), cut('9', 3, 50, 10), cut('0', 3, 75, 10), cut('C', 4, 70, 10),
    cut('O', 5, 96, 10), cut('r', 5, 105, 9), cut('-', 5, 121, 7), cut('m', 6, 45, 13), cut('b', 6, 57, 9),
    cut('D', 7, 14, 10), cut('o', 7, 23, 9), cut('n', 7, 31, 9), cut('P', 7, 55, 9), cut('u', 7, 63, 8),
    cut('h', 7, 78, 9), cut('M', 7, 91, 14), cut('f', 8, 42, 9), cut('F', 9, 78, 10), cut('d', 10, 79, 9),
    cut('B', 10, 92, 9), cut('p', 11, 61, 9), cut('i', 11, 69, 4),
  ],
  height: 16,
  spacing: -1,     // letras vizinhas dividem 1 coluna de contorno (como nas palavras minúsculas da ROM)
  spaceWidth: 6,   // + 2 × spacing = vão de 4 px entre palavras, igual à linha 0 ("Select|a|stage!")
  palette: { kind: 'scene', scene: 'stagesel', row: 9, size: 16 },
};
