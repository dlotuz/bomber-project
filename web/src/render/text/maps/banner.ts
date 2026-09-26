import type { GlyphCut, StyleRomDef } from '../types';
// Faixa "PAUSE!/HURRY!!/TIME UP!" [CAT §3 "Comum a todas as partidas"]: $D0:F57B, VRAM BG3 $A400 (word $5200), 1024
// bytes, 2bpp, 64 tiles. Fato confirmado por pixel (não medido a olho): cada letra tem uma METADE DE CIMA (tile T)
// e uma METADE DE BAIXO (tile T+16) — comparei, pixel a pixel, os índices de cor de 3 palavras reconstruídas da ROM
// contra capturas reais do jogo (savestate `tt_battle2.bin` do core `analise/ferramentas/emu.py`, poke em $1ED0/
// $1ED2 para o relógio como `hurry3.py`, PAUSA via START; diff de frame antes/depois para isolar os pixels da
// faixa da tela em meio ao resto da partida) e a combinação (tile T linhas 0-7) + (tile T+16 linhas 0-7) bate
// 98-99% com a tela real (o resto é ruído de anti-serrilhado/color math nas bordas). Isso resolve a dúvida do
// plano ("2 linhas de tile" = 16 px por letra) sem adivinhar o pareamento.
// Três faixas de 8-9 tiles, cada uma com sua própria metade de cima e de baixo (+16 tiles):
//   PAUSE!  → topo tiles 1-8   ($D0:F58B), base tiles 17-24 ($D0:F68B): P A U S E ! (tiles 7-8 = cauda decorativa)
//   TIME UP!→ topo tiles 36-44 ($D0:F7BB), base tiles 52-60 ($D0:F8BB): T I M E U P ! (só T,I,M são novos; E,U,P,!
//             já saem da faixa do PAUSE! acima, mesmo desenho)
//   HURRY!! → topo tiles 9-16  ($D0:F60B), base tiles 25-32 ($D0:F70B): (tile em branco) H U R R Y (só R é novo)
const cut = (ch: string, strip: string, tile: number, w = 8): GlyphCut => ({ ch, strip, x: tile * 8, w });

export const DEF: StyleRomDef = {
  strips: {
    pause: { kind: 'raw', rows: [0xd0f58b, 0xd0f68b], tiles: 8, bpp: 2 },
    timeup: { kind: 'raw', rows: [0xd0f7bb, 0xd0f8bb], tiles: 9, bpp: 2 },
    hurry: { kind: 'raw', rows: [0xd0f60b, 0xd0f70b], tiles: 8, bpp: 2 },
  },
  cuts: [
    cut('P', 'pause', 0), cut('A', 'pause', 1), cut('U', 'pause', 2), cut('S', 'pause', 3), cut('E', 'pause', 4),
    cut('!', 'pause', 5, 16),   // inclui a tile 6 (cauda do !)
    cut('T', 'timeup', 0), cut('I', 'timeup', 1), cut('M', 'timeup', 2),
    cut('R', 'hurry', 3),
  ],
  height: 16,
  spacing: 0,
  spaceWidth: 6,
  palette: { kind: 'rom', addr: 0xd69172, size: 4 },
  tones: { green: 0xd69172 },
  meta: { timeUpWidth: 70 },  // largura de "TIME UP!" com estes cortes (T+I+M+E+espaço+U+P+!); ver Step 5 do brief
};
