import type { StyleRomDef } from '../types';
/** Título dos menus (cena `vsmode`, BG1, "Select a VS mode!" — cursivo azul): fonte em bloco 16×16 com contorno
 * contínuo entre letras vizinhas (nem sementes + máscara isolam bem cada letra — ver task-16-report.md), mas o
 * CORPO (índices 1 = brilho/aro colorido, 10–15 = degradê) de cada letra não encosta no da vizinha, só o
 * contorno preto (índice 2) — confirmado por componentes conexos por índice (task-16-report.md, Fix report).
 * Por isso cada corte usa `bodyOnly` (mantém só 1/10–15, zera o 2 compartilhado) e o estilo redesenha o contorno
 * com `outline` depois de montar a frase inteira (`conn: 4` bateu mais pixel a pixel que 8 contra a faixa
 * original — teste em tests/screens/glyphs-menus.test.ts). `items`: mesmas faixas do estilo `menuItem`
 * (Championship/Bombermania) — só a forma de C, h, i, n, p, s, r que "Select a VS mode!" não tem; a cor sai da
 * paleta deste estilo (linha 0), não da vermelha. Paleta: linha 0 da cena `vsmode` (o mesmo azul visto em
 * VS/FFA/jogadores/regras/personagem). */
export const DEF: StyleRomDef = {
  strips: {
    vstitle: { kind: 'grid16', scene: 'vsmode', region: 'bg', cells: [[0x008, 0x00a, 0x00c, 0x00e, 0x020, 0x022, 0x024, 0x026]] },
    items: {
      kind: 'grid16', scene: 'vsmode', region: 'bg', cells: [
        [0x04c, 0x04e, 0x060, 0x062, 0x064, 0x066],   // Championship
        [0x068, 0x06a, 0x06c, 0x06e, 0x080, 0x082],   // Bombermania
      ],
    },
  },
  cuts: [
    { ch: 'S', strip: 'vstitle', x: 0, w: 9 },
    { ch: 'e', strip: 'vstitle', x: 9, w: 8 },
    { ch: 'l', strip: 'vstitle', x: 17, w: 6 },
    { ch: 'c', strip: 'vstitle', x: 29, w: 8 },
    { ch: 't', strip: 'vstitle', x: 37, w: 9 },
    { ch: 'a', strip: 'vstitle', x: 50, w: 9 },
    { ch: 'V', strip: 'vstitle', x: 63, w: 10 },
    { ch: 'm', strip: 'vstitle', x: 86, w: 9 },
    { ch: 'o', strip: 'vstitle', x: 95, w: 10 },
    { ch: 'd', strip: 'vstitle', x: 106, w: 8 },
    { ch: '!', strip: 'vstitle', x: 122, w: 5 },
    { ch: 'C', strip: 'items', x: 0, y: 0, w: 8 },
    { ch: 'h', strip: 'items', x: 8, y: 0, w: 8 },
    { ch: 'i', strip: 'items', x: 40, y: 0, w: 8 },
    { ch: 'n', strip: 'items', x: 56, y: 0, w: 8 },
    { ch: 'p', strip: 'items', x: 32, y: 0, w: 8 },
    { ch: 's', strip: 'items', x: 64, y: 0, w: 8 },
    { ch: 'r', strip: 'items', x: 42, y: 16, w: 8 },
  ],
  height: 16, spacing: 0, spaceWidth: 4,
  palette: { kind: 'scene', scene: 'vsmode', row: 0, size: 16 },
  bodyOnly: [1, 10, 11, 12, 13, 14, 15],
  // Achado medindo "Battle Royale" pixel a pixel contra a faixa original (task-16-report.md, Fix report 2):
  // o contorno preto só existe embaixo do corpo (índice 2, 4 vizinhos) — o aro colorido (índice 1, mantido em
  // `bodyOnly`) já é a borda visível em cima/do lado. `index: 0` = não desenha nada fora do caso `below`.
  outline: { index: 0, conn: 4, below: 2 },
};
