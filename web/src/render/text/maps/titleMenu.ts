import type { StyleRomDef } from '../types';
/** Tela-título: "PUSH START BUTTON! / NORMAL GAME / BATTLE GAME / PASSWORD" (patch em inglês, cena `title`).
 * Fonte "bolha" em bloco 16×16 do BG1 (mapa reconstruído do CAT §5); letras encostadas (fonte cursiva), sem
 * separação limpa por coluna dentro de cada palavra — os cortes usam a divisão medida pelo espaço de tinta de
 * cada palavra (aproximação por espaçamento uniforme, não recorte por pixel exato de cada letra; ver
 * task-16-report.md). Só `normalgame`/`battlegame`/`password` (a família de índices "ciano" da linha 0):
 * `pushstart` (PUSH START BUTTON!) usa outra família de índices ("amarelo") da mesma linha — misturar as duas
 * numa frase nova pintava letras vizinhas em tons diferentes, então U, H e ! (que só existem em PUSH/BUTTON!)
 * são glifos próprios (EXTRA) na família ciano, e `pushstart` fica sem uso aqui. */
export const DEF: StyleRomDef = {
  strips: {
    normalgame: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x0e0, 0x0e2, 0x0e4, 0x0e6, 0x0e8, 0x1ae, 0x1ce, 0x386]] },
    battlegame: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x0ea, 0x0ec, 0x0ee, 0x1e0, 0x1e2, 0x1ae, 0x1ce, 0x386]] },
    password: { kind: 'grid16', scene: 'title', region: 'bg', cells: [[0x1e4, 0x1e6, 0x1e8, 0x1ea, 0x1ec, 0x1ee]] },
  },
  cuts: [
    { ch: 'N', strip: 'normalgame', x: 7, w: 11 },
    { ch: 'O', strip: 'normalgame', x: 18, w: 11 },
    { ch: 'R', strip: 'normalgame', x: 29, w: 11 },
    { ch: 'M', strip: 'normalgame', x: 40, w: 11 },
    { ch: 'A', strip: 'normalgame', x: 51, w: 11 },
    { ch: 'L', strip: 'normalgame', x: 62, w: 10 },
    { ch: 'G', strip: 'normalgame', x: 81, w: 12 },
    { ch: 'E', strip: 'normalgame', x: 116, w: 11 },
    { ch: 'B', strip: 'battlegame', x: 7, w: 11 },
    { ch: 'T', strip: 'battlegame', x: 29, w: 10 },
    { ch: 'P', strip: 'password', x: 7, w: 11 },
    { ch: 'S', strip: 'password', x: 29, w: 11 },
    { ch: 'W', strip: 'password', x: 51, w: 11 },
    { ch: 'D', strip: 'password', x: 84, w: 9 },
  ],
  height: 16, spacing: 0, spaceWidth: 8,
  palette: { kind: 'scene', scene: 'title', row: 0, size: 16 },
  tones: { gray: 8 },
};
