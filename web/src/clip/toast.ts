// Aviso do CLIPE ("CLIPE SALVO!") por cima da imagem já apresentada: desenhado no #screen depois da cópia para o
// clipe, então não entra nas gravações seguintes. Texto da fonte ascii8 (a mesma das listas), numa faixa escura logo
// abaixo do placar, ampliada junto com a imagem do jogo.
import type { ScreenLayout } from '../render/display';
import type { SpriteBank } from '../render/sprite-bank';
import { drawText, textWidth } from '../render/text/text';

/** Linha (px da base 256×224) e altura da faixa. */
export const TOAST_Y = 30;
const TOAST_H = 14;
let scratch: CanvasRenderingContext2D | null = null;

export function drawClipToast(out: CanvasRenderingContext2D, L: ScreenLayout, bank: SpriteBank, text: string): void {
  scratch ??= (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = TOAST_H;
    return c.getContext('2d')!;
  })();
  const g = scratch, w = Math.min(252, textWidth('ascii8', text) + 14), x = Math.round((256 - w) / 2);
  g.clearRect(0, 0, 256, TOAST_H);
  g.fillStyle = 'rgba(8,16,48,0.88)';
  g.fillRect(x, 0, w, TOAST_H);
  g.fillStyle = '#ffe46b';
  g.fillRect(x, 0, w, 1); g.fillRect(x, TOAST_H - 1, w, 1);
  drawText(g, bank, 'ascii8', text, 128, 3, { align: 'center', tone: 'yellow', bare: true });
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = false;
  out.drawImage(g.canvas, L.ox, L.oy + TOAST_Y * L.sy, L.gw, TOAST_H * L.sy);
  out.restore();
}
