import { SCREEN_H, SCREEN_W } from '../display';
import { entX, entY } from './coords';
import { groundMask } from './mask';
import { shadowBlob } from './sprites';
import type { FxFrame } from './state';

/** Máscara de chão do quadro atual (alfa 0 onde há ator), em pixels de base, num canvas para recortar as sombras. */
export interface ActorMask { canvas: HTMLCanvasElement }

let mask: CanvasRenderingContext2D | null = null, maskImg: ImageData | null = null;
let layer: CanvasRenderingContext2D | null = null;
const canvas2d = (w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c.getContext('2d')!;
};

/** Compara o quadro atual com o "sem atores" (spec §4.4): onde batem é chão à vista. */
export function actorMask(base: Uint8ClampedArray, noActors: Uint8ClampedArray): ActorMask {
  mask ??= canvas2d(SCREEN_W, SCREEN_H);
  maskImg ??= mask.createImageData(SCREEN_W, SCREEN_H);
  groundMask(base, noActors, maskImg.data);
  mask.putImageData(maskImg, 0, 0);
  return { canvas: mask.canvas };
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
