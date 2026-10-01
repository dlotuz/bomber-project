import { SCREEN_H, SCREEN_W } from '../display';
import { entX, entY } from './coords';
import { groundMask } from './mask';
import { shadowBlob } from './sprites';
import type { FxFrame } from './state';

/** Quadro de base e máscara de chão (alfa 0 onde há ator) do quadro atual, em pixels de base. */
export interface ActorMask { base: Uint8ClampedArray; ground: Uint8ClampedArray; canvas: HTMLCanvasElement }

let noAct: CanvasRenderingContext2D | null = null, mask: CanvasRenderingContext2D | null = null, maskImg: ImageData | null = null;
let layer: CanvasRenderingContext2D | null = null;
const canvas2d = (w: number, h: number, read = false) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c.getContext('2d', { willReadFrequently: read })!;
};

/** Compara o quadro atual com o "sem atores" (spec §4.4): onde batem é chão à vista. */
export function actorMask(frame: FxFrame, base: CanvasRenderingContext2D): ActorMask {
  noAct ??= canvas2d(SCREEN_W, SCREEN_H, true);
  mask ??= canvas2d(SCREEN_W, SCREEN_H);
  maskImg ??= mask.createImageData(SCREEN_W, SCREEN_H);
  noAct.clearRect(0, 0, SCREEN_W, SCREEN_H);
  frame.drawNoActors(noAct);
  const baseData = base.getImageData(0, 0, SCREEN_W, SCREEN_H).data;
  groundMask(baseData, noAct.getImageData(0, 0, SCREEN_W, SCREEN_H).data, maskImg.data);
  mask.putImageData(maskImg, 0, 0);
  return { base: baseData, ground: maskImg.data, canvas: mask.canvas };
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  const k = Math.max(0.3, 1 - height / 48);
  g.globalAlpha = k;
  g.drawImage(shadowBlob(), x - 7 * k, y - 3 * k, 14 * k, 6 * k);
}

/** Sombras sob jogadores, bombas e objetos em voo, recortadas pela máscara de chão (spec §4.4). */
export function drawShadows(out: CanvasRenderingContext2D, frame: FxFrame, m: ActorMask, fade: number, s: number): void {
  if (!layer || layer.canvas.width !== SCREEN_W * s) layer = canvas2d(SCREEN_W * s, SCREEN_H * s);
  const g = layer, r = frame.round;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  for (const p of r.players) if (p.present && p.state === 'alive') blob(g, entX(p.x), entY(p.y) + 6, p.z);
  for (const b of r.bombs) if (b.state === 'idle' || b.state === 'kicked') blob(g, entX(b.x), entY(b.y) + 5, 0);
  for (const f of r.flyers) if (f.kind !== 'player') blob(g, entX(f.x), entY(f.y) + 5, -f.z);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = false;
  g.drawImage(m.canvas, 0, 0, SCREEN_W, SCREEN_H);

  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = fade;
  out.drawImage(g.canvas, 0, 0, SCREEN_W, SCREEN_H);
}
