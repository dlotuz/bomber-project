import { SCREEN_H, SCREEN_W, type Display } from '../display';
import { drawFx } from './draw';
import type { FxFrame } from './state';

const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Base ampliada (com tremor) e, na batalha, os efeitos por cima (spec §3.1). `fade` = brilho do App / 15. */
export function present(d: Display, frame: FxFrame | null, fade: number): void {
  const { out } = d, s = d.scale();
  const shake = frame && !reduced?.matches;
  const ox = shake ? frame.state.dx * s : 0, oy = shake ? frame.state.dy * s : 0;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  if (ox || oy) { out.fillStyle = '#000'; out.fillRect(0, 0, SCREEN_W * s, SCREEN_H * s); }
  out.drawImage(d.ctx.canvas, ox, oy, SCREEN_W * s, SCREEN_H * s);
  if (!frame) return;
  out.setTransform(s, 0, 0, s, ox, oy);   // os efeitos desenham em pixels de base, rasterizados em resolução nativa
  drawFx(out, frame, d.ctx, fade);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
}
