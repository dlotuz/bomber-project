import type { StyleRomDef } from '../types';
/** Itens dos menus (cena `vsmode`, BG1, cursivo vermelho/laranja): "Battle Royale" / "Championship" /
 * "Bombermania" — as 3 opções da tela "Select a VS mode!" (mesmo tom usado pelas outras listas de itens do
 * jogo). Fonte em bloco 16×16 com contorno contínuo entre letras vizinhas, mas o CORPO (índices 1 = aro
 * colorido, 10–15 = degradê) não encosta no da vizinha, só o contorno preto (índice 2) — confirmado por
 * componentes conexos por índice (ver task-16-report.md, Fix report: reconstruir "Battle Royale" a partir destes
 * cortes bate ~66% pixel a pixel com a faixa original, e a diferença é quase só o contorno sintético 1 px
 * diferente do desenhado à mão). Cada corte usa `bodyOnly` (mantém só 1/10–15) e o estilo redesenha o contorno
 * com `outline` depois de montar a frase (`conn: 4` bateu mais que 8 contra a faixa original). Tons: linhas da
 * CGRAM da própria cena (0 = azul do título, 3 = verde, 7 = vermelho/padrão, 9 = cinza). */
export const DEF: StyleRomDef = {
  strips: {
    items: {
      kind: 'grid16', scene: 'vsmode', region: 'bg', cells: [
        [0x040, 0x042, 0x044, 0x046, 0x048, 0x04a],   // Battle Royale
        [0x04c, 0x04e, 0x060, 0x062, 0x064, 0x066],   // Championship
        [0x068, 0x06a, 0x06c, 0x06e, 0x080, 0x082],   // Bombermania
      ],
    },
  },
  cuts: [
    { ch: 'B', strip: 'items', x: 0, y: 0, w: 8 },
    { ch: 'a', strip: 'items', x: 8, y: 0, w: 7 },
    { ch: 't', strip: 'items', x: 15, y: 0, w: 7 },
    { ch: 'l', strip: 'items', x: 29, y: 0, w: 7 },
    { ch: 'e', strip: 'items', x: 36, y: 0, w: 7 },
    { ch: 'R', strip: 'items', x: 47, y: 0, w: 9 },
    { ch: 'o', strip: 'items', x: 55, y: 0, w: 8 },
    { ch: 'y', strip: 'items', x: 63, y: 0, w: 7 },
    { ch: 'C', strip: 'items', x: 0, y: 16, w: 8 },
    { ch: 'h', strip: 'items', x: 8, y: 16, w: 8 },
    { ch: 'm', strip: 'items', x: 24, y: 16, w: 8 },
    { ch: 'p', strip: 'items', x: 32, y: 16, w: 8 },
    { ch: 'i', strip: 'items', x: 40, y: 16, w: 8 },
    { ch: 'n', strip: 'items', x: 56, y: 16, w: 8 },
    { ch: 's', strip: 'items', x: 64, y: 16, w: 8 },
    { ch: 'b', strip: 'items', x: 25, y: 32, w: 9 },
    { ch: 'r', strip: 'items', x: 42, y: 32, w: 8 },
  ],
  height: 16, spacing: 0, spaceWidth: 6,
  palette: { kind: 'scene', scene: 'vsmode', row: 7, size: 16 },
  tones: { gray: 9, green: 3, red: 7, blue: 0 },
  bodyOnly: [1, 10, 11, 12, 13, 14, 15],
  outline: { index: 2, conn: 4 },
};
