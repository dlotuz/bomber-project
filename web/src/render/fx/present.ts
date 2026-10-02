import { SCREEN_H, SCREEN_W, type Display } from '../display';
import { drawFx } from './draw';
import { drawHdMenu } from '../hd-menu';
import type { FxFrame } from './state';

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Base ampliada por um inteiro `k` sem suavizar (pixels nítidos e todos do mesmo tamanho); depois esse quadro é
 *  levado à escala final, quebrada e/ou 4:3, com suavização — só a borda de cada pixel fica levemente macia, em vez
 *  de linhas e colunas com espessuras desiguais (o "sharp bilinear" dos emuladores). */
let mid: CanvasRenderingContext2D | null = null;
function sharpBase(d: Display): CanvasImageSource {
  const k = Math.max(1, Math.floor(Math.min(d.scale(), d.scaleX())));
  if (k === d.scale() && k === d.scaleX()) return d.ctx.canvas;   // escala inteira e pixel quadrado: direto
  if (!mid || mid.canvas.width !== SCREEN_W * k) {
    const c = document.createElement('canvas');
    c.width = SCREEN_W * k; c.height = SCREEN_H * k;
    mid = c.getContext('2d')!;
  }
  mid.imageSmoothingEnabled = false;
  mid.clearRect(0, 0, mid.canvas.width, mid.canvas.height);
  mid.drawImage(d.ctx.canvas, 0, 0, mid.canvas.width, mid.canvas.height);
  return mid.canvas;
}

/** Base ampliada (com tremor) e, na batalha, os efeitos por cima (spec §3.1). `fade` = brilho do App / 15. */
export function present(d: Display, frame: FxFrame | null, fade: number): void {
  const { out } = d, sy = d.scale(), sx = d.scaleX();
  const shake = frame && !reduced?.matches;
  const ox = shake ? frame.state.dx * sx : 0, oy = shake ? frame.state.dy * sy : 0;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  if (ox || oy) { out.fillStyle = '#000'; out.fillRect(0, 0, out.canvas.width, out.canvas.height); }
  drawHdMenu(out, sx, sy);   // menus: fundo/texto HD por baixo da base transparente
  const src = sharpBase(d);
  out.imageSmoothingEnabled = src !== d.ctx.canvas;
  out.imageSmoothingQuality = 'high';
  out.drawImage(src, ox, oy, SCREEN_W * sx, SCREEN_H * sy);
  out.imageSmoothingEnabled = false;
  if (!frame) return;
  out.setTransform(sx, 0, 0, sy, ox, oy);   // os efeitos desenham em pixels de base, rasterizados em resolução nativa
  drawFx(out, frame, d.ctx, fade);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
}
