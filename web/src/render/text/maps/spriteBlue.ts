import type { GlyphCut, StyleRomDef } from '../types';
// Texto OBJ 4bpp cru da cena `stagesel` [CAT §5 stagesel]: oito faixas de 64 tiles (8×8, 32 bytes/tile) coladas uma
// depois da outra pelo jogo (nomes das fases, "Select a stage!", "Stage N", DMA direto $E0:401B.. → VRAM $6000..).
// Só a 1ª faixa ($E0:0021) tem os textos fixos "Select a stage!" e "BATTLE START!" (as demais são os 10 nomes de
// fase em inglês). Decodificando essa faixa como 64 tiles 8×8 lado a lado (`raw`, 1 endereço, sem grade de
// caractere pré-definida) e medindo colunas sem tinta, achamos limites limpos por letra (ao contrário do `banner`,
// aqui cada letra ocupa 1 tile inteiro): tiles 0-5 = "Select", 6 = "a", 8-13 = "stage!", 24-29 = "BATTLE",
// 31-35 = "START". Cortamos daí S e T e i c l a s g ! B A T L E R.
// As letras que não aparecem em nenhuma das 8 faixas nessa busca (C D F G H M N O P maiúsculas; b d f h i m n o p q
// r u v x minúsculas; dígitos; acentos) ganham glifos próprios em extra/spriteBlue.ts — desenho simples (traço único,
// cor 15 = branco/realce, a mais clara da rampa azul da ROM) em vez de tentar reproduzir a rampa de sombreado
// completa (índices 1-15) letra a letra à mão; ver comentário lá.
// Paleta: `stagesel`, paleta de OBJ linha 10 (16 cores) — rampa cinza-azulada de preto a branco, batida contra a
// CGRAM real da captura `stagesel` (linha 10 do bloco OBJ, offsets 128+10*16). É a única das 8 linhas de OBJ da cena
// que forma uma rampa contínua (as outras têm cores de HUD/menu sem relação com o texto).
const cut = (ch: string, tile: number): GlyphCut => ({ ch, strip: 'f', x: tile * 8, w: 8 });

export const DEF: StyleRomDef = {
  strips: { f: { kind: 'raw', rows: [0xe00021], tiles: 64, bpp: 4 } },
  cuts: [
    cut('S', 0), cut('e', 1), cut('l', 2), cut('c', 4), cut('t', 5), cut('a', 6),
    cut('s', 8), cut('g', 11), cut('!', 13),
    cut('B', 24), cut('A', 25), cut('T', 26), cut('L', 28), cut('E', 29), cut('R', 34),
  ],
  height: 8,
  spacing: 0,
  spaceWidth: 6,
  palette: { kind: 'scene', scene: 'stagesel', row: 10, size: 16 },
};
