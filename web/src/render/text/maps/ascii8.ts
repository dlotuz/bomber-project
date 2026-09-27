import type { GlyphCut, StyleRomDef } from '../types';
// Fonte ASCII 8×8 crua (2bpp, 64 tiles lado a lado) [CAT §3 "Comum a todas as partidas"]: $D1:BC16, VRAM BG3 $A000
// (word $5000), confirmada por bater byte a byte com a captura arena01 (offset $A000..$A3FF). Layout: tile 0 = bloco
// sólido (não é caractere, cor 2, provável cursor/preenchimento; sem uso em STRING_USES), tiles 1..63 = ASCII $21..$5F
// (tileIndex = charCode - 0x20), confirmado desenho a desenho contra o alfabeto e dígitos. Símbolos não usados pelo
// jogo (#, $, %, &, \, ^) saem em branco na ROM e não entram nos cortes.
// Paleta: 4 cores em $D6:918A (cinza 0/80/160/248), lidas do grupo de paleta 0 do BG do script de CADA uma das 10
// arenas (arenaRecord + ponteiro de paleta, offset das cores 12-15 de 16); as 10 apontam para o MESMO endereço
// $D6:918A (verificado programaticamente) e batem com a CGRAM capturada em arena01..10 nas posições 12-15.
// Acentos (Ã Ç Ê Ó Õ Ú) ficam em extra/ascii8.ts com `base` (letra da ROM reaproveitada em tempo de execução,
// mecanismo do T18) — nenhum pixel delas é armazenado aqui nem lá.
const cut = (ch: string, tile: number): GlyphCut => ({ ch, strip: 'f', x: tile * 8, w: 8 });

const DIGITS: GlyphCut[] = Array.from({ length: 10 }, (_, i) => cut(String(i), 16 + i));
const LETTERS: GlyphCut[] = Array.from({ length: 26 }, (_, i) => cut(String.fromCharCode(65 + i), 33 + i));

export const DEF: StyleRomDef = {
  strips: { f: { kind: 'raw', rows: [0xd1bc16], tiles: 64, bpp: 2 } },
  cuts: [
    cut('!', 1), cut('"', 2), cut("'", 7), cut('(', 8), cut(')', 9), cut('*', 10), cut('+', 11), cut(',', 12),
    cut('-', 13), cut('.', 14), cut('/', 15),
    ...DIGITS,
    cut(':', 26), cut(';', 27), cut('<', 28), cut('=', 29), cut('>', 30), cut('?', 31),
    ...LETTERS,
    cut('[', 59), cut(']', 61), cut('_', 63),
  ],
  height: 8,
  spacing: 0,
  spaceWidth: 8,
  palette: { kind: 'rom', addr: 0xd6918a, size: 4 },
  // Índice 1 = campo cinza 80 da casa do HUD (opaco). Com `bare` (M1: Opções/remapeamento, texto sobre o quebra-cabeça)
  // ele some e a letra (índices 2/3) ganha 1 px de contorno nesse mesmo cinza escuro. Os glifos não mudam.
  field: 1,
  fieldOutline: 1,
};
