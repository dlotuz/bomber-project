import type { StyleRomDef } from '../types';
/** Itens dos menus (cena `vsmode`, BG1, cursivo vermelho/laranja): "Battle Royale" / "Championship" /
 * "Bombermania" — as 3 opções da tela "Select a VS mode!" (mesmo tom usado pelas outras listas de itens do
 * jogo). Fonte em bloco 16×16 com contorno contínuo entre letras vizinhas, mas o CORPO (índices 1 = aro
 * colorido, 10–15 = degradê) não encosta no da vizinha, só o contorno preto (índice 2) — confirmado por
 * componentes conexos por índice. Cada corte usa `bodyOnly` (mantém só 1/10–15) e o estilo redesenha o contorno
 * com `outline` depois de montar a frase inteira: medindo pixel a pixel contra a faixa original (ver
 * task-16-report.md, Fix report 2), o contorno preto só existe embaixo do corpo (o resto da borda já é o
 * próprio aro colorido, mantido em `bodyOnly` — não precisa de pixel extra). Limites de cada letra medidos
 * pelo perfil de tinta por coluna (não só x/w uniforme) e `spaceWidth` = o espaço medido entre "Battle" e
 * "Royale". `t`/`l`/`e` de "Battle" aparecem 2× no original com larguras um pouco diferentes por causa do
 * kerning cursivo (ex.: os dois `t` medem 7 e 6 px); como o glifo é UM só (reusado em qualquer texto novo,
 * não dá pra ter dois `t` diferentes), `l` ficou com a largura ajustada (4, não os 5 "corretos" da letra em si)
 * pra absorver essa diferença e realinhar "Royale" — sem isso a segunda metade da palavra desalinhava e caía
 * pra ~56% de acerto. Com esse ajuste, `layoutText(..., 'Battle Royale')` bate **90,2% dos pixels (82,8% só a
 * união de pixels não-zero)** com a faixa original de verdade (teste em tests/screens/glyphs-menus.test.ts,
 * describe "fidelidade da reconstrução") — não dá pra chegar a 100% com um glifo por letra porque o próprio
 * desenho da ROM varia o kerning entre as duas ocorrências. Tons: linhas da CGRAM da própria cena (0 = azul do
 * título, 3 = verde, 7 = vermelho/padrão, 9 = cinza). */
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
    { ch: 'B', strip: 'items', x: 0, y: 0, w: 9 },
    { ch: 'a', strip: 'items', x: 9, y: 0, w: 8 },
    { ch: 't', strip: 'items', x: 17, y: 0, w: 7 },
    { ch: 'l', strip: 'items', x: 30, y: 0, w: 4 },
    { ch: 'e', strip: 'items', x: 35, y: 0, w: 8 },
    { ch: 'R', strip: 'items', x: 47, y: 0, w: 9 },
    { ch: 'o', strip: 'items', x: 56, y: 0, w: 8 },
    { ch: 'y', strip: 'items', x: 64, y: 0, w: 7 },
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
  height: 16, spacing: 0, spaceWidth: 4,
  palette: { kind: 'scene', scene: 'vsmode', row: 7, size: 16 },
  tones: { gray: 9, green: 3, red: 7, blue: 0 },
  bodyOnly: [1, 10, 11, 12, 13, 14, 15],
  // Achado medindo "Battle Royale" pixel a pixel contra a faixa original (task-16-report.md, Fix report 2):
  // o contorno preto só existe embaixo do corpo (índice 2, 4 vizinhos) — não em cima nem do lado, porque ali
  // o próprio aro colorido (índice 1, mantido em `bodyOnly`) já é a borda visível. `index: 0` = não desenha
  // nada fora do caso `below` (0 já é o pixel vazio, então "preenchê-lo com 0" não muda nada).
  outline: { index: 0, conn: 4, below: 2 },
};
