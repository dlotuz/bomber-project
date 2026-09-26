import { SCREEN_W, SCREEN_H } from '../render/draw-game';

export { PLAYER_COLORS } from '../render/draw-game';

export const COLORS = {
  title: '#ffd23f', text: '#ffffff', dim: '#6f7a99', value: '#6ad0ff', error: '#ff5f5f', ok: '#5fe07a',
  bgA: '#141a3a', bgB: '#18204a', panel: '#0b1f3d', panelEdge: '#ffd23f', panelShadow: '#050b18',
};

/** Fundo xadrez que desliza na diagonal. */
export function drawBackground(ctx: CanvasRenderingContext2D, frame: number): void {
  const off = (frame >> 1) % 32;
  ctx.fillStyle = COLORS.bgA;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = COLORS.bgB;
  for (let y = -32; y < SCREEN_H + 32; y += 16) for (let x = -32; x < SCREEN_W + 32; x += 16) {
    if (((x + y) / 16) % 2 === 0) ctx.fillRect(x + off, y + off, 16, 16);
  }
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLORS.panelShadow;
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

/** Fundo do fallback, fixo (o xadrez atual sem deslizar; spec §6.14). */
export function drawStaticBackground(ctx: CanvasRenderingContext2D): void { drawBackground(ctx, 0); }
/** Cursor do fallback, parado (a setinha atual, sem balançar), com a ponta em (x+3, y+3) como a mão 16×16. */
export function drawStaticCursor(ctx: CanvasRenderingContext2D, x: number, y: number, color = COLORS.title): void {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y + 4 + i, 1, 7 - 2 * i);
}
/** Moldura do fallback no retângulo medido do original (px inclusivos). */
export function drawFallbackFrame(ctx: CanvasRenderingContext2D, r: { x0: number; y0: number; x1: number; y1: number }): void {
  drawPanel(ctx, r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
}
