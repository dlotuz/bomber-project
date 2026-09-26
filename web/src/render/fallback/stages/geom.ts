// Casa e ponto → tela do fallback (conferido com o plano 6 T19 na Task 1, item 12: `tileX`/`tileY` de draw-game.ts).
export const CELL_PX = 16;
export const cellLeft = (col: number): number => 16 * col - 8;
export const cellTop = (lin: number): number => 16 * lin + 24;
/** Ponto em px de tela do núcleo (centro da casa = 16·col − 1) → canto do pixel no canvas. */
export const scrX = (xpx: number): number => xpx + 1;
export const scrY = (ypx: number): number => ypx + 1;
