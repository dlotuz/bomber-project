import type { SpriteBank } from '../render/sprite-bank';
import { drawTextCentered, SCREEN_W, SCREEN_H } from '../render/draw-game';
import type { MenuList } from './menu';

export { PLAYER_COLORS } from '../render/draw-game';

export const COLORS = {
  title: '#ffd23f', text: '#ffffff', dim: '#6f7a99', value: '#6ad0ff', error: '#ff5f5f', ok: '#5fe07a',
  bgA: '#141a3a', bgB: '#18204a', panel: '#0b1f3d', panelEdge: '#ffd23f', panelShadow: '#050b18',
};

export const ROW_H = 16;
/** Linha de base do painel dos menus (o rodapé fica logo abaixo). */
export const MENU_BOTTOM = 202;

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

export function drawText(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, x: number, y: number, color: string): void {
  ctx.drawImage(bank.text(text, color), x, y);
}

export function drawTextRight(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, right: number, y: number, color: string): void {
  const img = bank.text(text, color);
  ctx.drawImage(img, right - img.width, y);
}

/** Setinha que aponta para a opção selecionada (pisca de leve). */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, color = COLORS.title): void {
  const dx = (frame >> 3) & 1;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + dx + i, y + i, 1, 7 - 2 * i);
}

export function drawTitleBar(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string): void {
  drawTextCentered(ctx, bank, text, COLORS.title, 12, 2);
}

/** Desenha a lista: rótulo à esquerda, valor alinhado à direita, cursor na linha atual. */
export function drawMenu(ctx: CanvasRenderingContext2D, bank: SpriteBank, list: MenuList, x: number, y: number, w: number, frame: number, rowH = ROW_H): void {
  list.items.forEach((it, i) => {
    const ry = y + i * rowH;
    const color = it.disabled ? COLORS.dim : COLORS.text;
    drawText(ctx, bank, it.label, x, ry, color);
    if (it.value) drawTextRight(ctx, bank, it.value(), x + w, ry, it.disabled ? COLORS.dim : (it.valueColor?.() ?? COLORS.value));
    if (i === list.cursor) drawCursor(ctx, x - 10, ry + 3, frame);
  });
}

/** Onde o painel de uma página de menu fica: abaixo do título e acima do rodapé. */
export function menuPanelRect(items: number, width = 200, rowH = ROW_H): { x: number; y: number; w: number; h: number } {
  const h = items * rowH + 14;
  const x = Math.floor((SCREEN_W - width) / 2);
  const y = Math.max(44, Math.min(Math.floor((SCREEN_H - h) / 2) + 8, MENU_BOTTOM - h));
  return { x, y, w: width, h };
}

/** Página padrão de menu: fundo, título e painel central com a lista. */
export function drawMenuPage(ctx: CanvasRenderingContext2D, bank: SpriteBank, frame: number, title: string, list: MenuList, width = 200, rowH = ROW_H): void {
  drawBackground(ctx, frame);
  drawTitleBar(ctx, bank, title);
  const r = menuPanelRect(list.items.length, width, rowH);
  drawPanel(ctx, r.x, r.y, r.w, r.h);
  drawMenu(ctx, bank, list, r.x + 16, r.y + 7, r.w - 26, frame, rowH);
}

/** Linha de ajuda ou de erro no rodapé. */
export function drawFooter(ctx: CanvasRenderingContext2D, bank: SpriteBank, text: string, color = COLORS.dim): void {
  drawTextCentered(ctx, bank, text, color, SCREEN_H - 16, 1);
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

/**
 * Cores do fallback por tom (spec §6.14), para as linhas desativadas etc. das telas sem ROM.
 * Não está no Step 4 do brief (só listado em "Produces"); mantido igual ao `TONE_COLORS` da T4
 * (`render/text/text.ts`) para não haver duas paletas de tom divergentes quando a T4 mesclar.
 */
export const FB_TONE: Record<'default' | 'gray' | 'green' | 'red' | 'blue' | 'white' | 'orange' | 'yellow', string> = {
  default: '', gray: '#8a8a8a', green: '#3fb24a', red: '#e8402a', blue: '#3a6ae0', white: '#ffffff', orange: '#ff8c1a', yellow: '#ffd23f',
};
