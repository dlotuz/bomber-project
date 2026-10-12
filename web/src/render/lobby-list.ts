import type { SpriteBank } from './sprite-bank';
import { hdMenu, hdPanel } from './hd-menu';
import { drawText } from './text/text';
import type { Tone } from './text/types';
import { TITLE_X, TITLE_Y, FOOTER_Y } from './screens-rom/options';

/** Uma linha da lista: rótulo à esquerda, valor à direita. `capturing`: esperando tecla/botão (laranja, "..."). */
export interface LobbyItem { label: string; value?: string; capturing?: boolean; disabled?: boolean; tone?: Tone }

/** Quantas linhas cabem numa coluna larga (acima disso, a lista vai para duas colunas estreitas). */
export const LOBBY_ONE_COL_MAX = 10;
const STRIP_H = 14, STEP = 17, TOP = 26;
const NARROW = { w: 108, x: [14, 134] as const, perCol: 9 };
const WIDE = { w: 228, x: [14] as const };

/** Posição (px da base 256×224) da linha `i` de uma lista de `n` linhas. */
export function lobbyListAt(i: number, n: number): { x: number; y: number; w: number } {
  if (n <= LOBBY_ONE_COL_MAX) return { x: WIDE.x[0], y: TOP + i * STEP, w: WIDE.w };
  return { x: NARROW.x[i < NARROW.perCol ? 0 : 1], y: TOP + (i % NARROW.perCol) * STEP, w: NARROW.w };
}

/**
 * Lista de faixas no visual das telas do online (fundo azul, faixas arredondadas, mão), usada nas Opções e nos
 * controles. Até 10 linhas: uma coluna larga; mais que isso: duas colunas de 9.
 */
export function drawLobbyList(
  ctx: CanvasRenderingContext2D, bank: SpriteBank, title: string, items: readonly LobbyItem[], cursor: number, footer?: string,
): void {
  const n = items.length;
  const cur = lobbyListAt(cursor, n);
  hdMenu(ctx, [cur.x - 8, cur.y + 2], { hand: 0.9, item: 12, small: 7.5 }, 'lobby');
  drawText(ctx, bank, 'menuTitle', title, TITLE_X, TITLE_Y, { align: 'center', bare: true });
  items.forEach((it, i) => {
    const p = lobbyListAt(i, n), focus = i === cursor;
    hdPanel({ x: p.x, y: p.y, w: p.w, h: STRIP_H, fill: focus ? 'rgba(16,40,112,0.92)' : 'rgba(10,30,90,0.6)',
      stroke: it.capturing ? '#ff9a4a' : focus ? '#ffe46b' : '#8fd8ff', glow: focus ? 'rgba(255,220,90,0.9)' : undefined });
    const tone = it.disabled ? 'gray' : focus ? 'yellow' : 'white';
    drawText(ctx, bank, 'ascii8', it.label, p.x + 7, p.y + 4, { tone, bare: true });
    const v = it.capturing ? '...' : it.value;
    if (v) drawText(ctx, bank, 'ascii8', v, p.x + p.w - 6, p.y + 4, { align: 'right', tone: it.capturing ? 'orange' : it.tone ?? 'yellow', bare: true });
  });
  if (footer) drawText(ctx, bank, 'ascii8', footer, 128, FOOTER_Y, { align: 'center', tone: 'white', bare: true });
}
