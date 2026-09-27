import type { GlyphCut, StyleRomDef } from '../types';
/** Tela-título: "NORMAL GAME / BATTLE GAME / PASSWORD / PUSH START BUTTON!" (patch em inglês, cena `title`), fonte
 * "bolha" em blocos 16×16 do BG1 (linhas $0A/$0B/$0C/$09 do mapa reconstruído do CAT §5; as faixas cruas $E2:3F4F…
 * citadas no plano são a decoração ondulada, não texto).
 *
 * Cada letra é um componente 4-conexo do miolo (índices 12–15, `fill`) — medido nas 4 frases: 1 componente por letra
 * (+ 1 px solto dentro do W e o ponto do !). O recorte vai do miolo −1 ao miolo +1 com `spacing: −1` e `mask`
 * (semente no miolo, 1 camada 8-vizinha de borda 1/10/11): sem lasca da vizinha nem borda aparada. `under`: onde duas
 * letras se encostam, o miolo da vizinha vence a borda desta, como na arte.
 *
 * Kerning: vão entre miolos de 1 coluna, exceto OR RM MA GA BA TL PA SS WO (vão 0 → −1). Espaço: 11 colunas depois
 * de NORMAL, 13 depois de BATTLE → `spaceWidth: 12` com "L " −1 e "E " +1.
 *
 * H e ! só existem em PUSH START BUTTON!, pintada com a família "amarela" da mesma linha de paleta (5 = borda,
 * 6–9 = miolo, mesmas posições relativas da família ciana 11, 12–15): `remap` troca 5→11, 6→12, 7→13, 8→14, 9→15 e a
 * letra sai na cor das outras. Glifos próprios (extra/titleMenu.ts): J e Ç (não existem em nenhuma das frases) e o
 * til do Õ sobre o O da ROM.
 *
 * Cinza (item desabilitado): nenhuma paleta da ROM tem esta família de índices em cinza — a linha 0 em luma
 * (`grayscale`). */
const YELLOW = { 5: 11, 6: 12, 7: 13, 8: 14, 9: 15 } as const;
const c = (ch: string, strip: string, lo: number, hi: number, seeds: readonly (readonly [number, number])[],
  remap?: Readonly<Record<number, number>>): GlyphCut => ({ ch, strip, x: lo - 1, w: hi - lo + 3, seeds, ...(remap ? { remap } : {}) });

export const DEF: StyleRomDef = {
  strips: {
    normalgame: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x0e0, 0x0e2, 0x0e4, 0x0e6, 0x0e8, 0x1ae, 0x1ce, 0x386]] },
    battlegame: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x0ea, 0x0ec, 0x0ee, 0x1e0, 0x1e2, 0x1ae, 0x1ce, 0x386]] },
    password: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x1e4, 0x1e6, 0x1e8, 0x1ea, 0x1ec, 0x1ee]] },
    pushstart: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x3c0, 0x3c2, 0x3c4, 0x3c6, 0x3c8, 0x3ca, 0x3cc, 0x3ce, 0x3e0, 0x3e2, 0x3e4, 0x3e6]] },
  },
  cuts: [
    c('N', 'normalgame', 8, 18, [[12, 3]]),
    c('O', 'normalgame', 20, 29, [[24, 3]]),
    c('R', 'normalgame', 30, 39, [[35, 3]]),
    c('M', 'normalgame', 40, 50, [[43, 3]]),
    c('A', 'battlegame', 18, 27, [[25, 3]]),
    c('L', 'normalgame', 62, 70, [[65, 3]]),
    c('G', 'normalgame', 82, 91, [[85, 3]]),
    c('E', 'battlegame', 115, 125, [[118, 3]]),
    c('B', 'battlegame', 8, 17, [[13, 3]]),
    c('T', 'battlegame', 39, 47, [[40, 3]]),
    c('P', 'password', 8, 17, [[13, 3]]),
    c('S', 'password', 29, 38, [[33, 3]]),
    c('W', 'password', 50, 60, [[51, 3], [56, 5]]),   // sem uso nas frases PT-BR; entra para o teste remontar PASSWORD
    c('D', 'password', 82, 91, [[86, 3]]),
    c('H', 'pushstart', 38, 47, [[41, 3]], YELLOW),
    c('!', 'pushstart', 176, 183, [[180, 3], [175, 11]], YELLOW),
  ],
  height: 16, spacing: -1, spaceWidth: 12,
  kern: { OR: -1, RM: -1, MA: -1, GA: -1, BA: -1, TL: -1, PA: -1, SS: -1, WO: -1, 'L ': -1, 'E ': 1 },
  mask: { fill: [12, 13, 14, 15], edge: [1, 10, 11], grow: 1 },
  under: [1, 10, 11],
  palette: { kind: 'scene', scene: 'title', row: 0, size: 16 },
  tones: { gray: 0 },
  grayscale: ['gray'],
  // Amarelo (M2): a família de "PUSH START BUTTON!" na mesma linha — o inverso de `YELLOW` (11→5, 12–15→6–9).
  toneRemap: { yellow: Object.fromEntries(Object.entries(YELLOW).map(([k, v]) => [v, Number(k)])) },
};
