import { invisibleVisible, type Player, type RoundState } from '../../core';
import { rider } from '../../core/mounts/types';
import { invincibleHidden } from '../anim/effects';
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

/** Onde vai cada sombra suave: centro (px de base) e altura acima do chão (encolhe e clareia no alto). */
export interface ShadowSpot { x: number; y: number; height: number }

/** O sprite do jogador está escondido neste quadro (doença invisível $29 ou piscando da invencibilidade) — o mesmo
 *  critério dos três desenhos (rom/sprites.ts, draw-game.ts, hdart/draw.ts): a sombra some junto com ele. */
const spriteHidden = (p: Player): boolean => !invisibleVisible(p) || invincibleHidden(p.inv);

/** Centro da sombra do jogador abaixo de `entY` (px de base). Arte própria: sob os pés do desenho dela (+6). Sprites
 *  da ROM: no meio da elipse que o sprite trazia (rom/baked-shadow.ts) — linhas 24–28 do quadro em Y − 24, isto é
 *  Y+0..Y+4 a pé (+1), e 26–31 na montaria, Y+2..Y+7 (+4). */
function footDy(p: Player, rom: boolean): number {
  if (!rom) return 6;
  return rider(p)?.phase === 'riding' ? 4 : 1;
}

/** Sombras sob jogadores vivos e à vista, bombas paradas/chutadas e objetos em voo. `rom`: os atores saíram dos
 *  sprites da ROM neste quadro. Pura (testes). */
export function shadowSpots(r: RoundState, rom = false): ShadowSpot[] {
  const out: ShadowSpot[] = [];
  for (const p of r.players) if (p.present && p.state === 'alive' && !spriteHidden(p)) out.push({ x: entX(p.x), y: entY(p.y) + footDy(p, rom), height: p.z });
  for (const b of r.bombs) if (b.state === 'idle' || b.state === 'kicked') out.push({ x: entX(b.x), y: entY(b.y) + 5, height: 0 });
  for (const f of r.flyers) if (f.kind !== 'player') out.push({ x: entX(f.x), y: entY(f.y) + 5, height: -f.z });
  return out;
}

function blob(g: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  const k = Math.max(0.3, 1 - height / 48);
  g.globalAlpha = k;
  g.drawImage(shadowBlob(), x - 7 * k, y - 3 * k, 14 * k, 6 * k);
}

/** Sombras sob jogadores, bombas e objetos em voo, recortadas pela máscara de chão (spec §4.4). */
export function drawShadows(out: CanvasRenderingContext2D, frame: FxFrame, m: ActorMask, fade: number, s: number): void {
  if (!layer || layer.canvas.width !== SCREEN_W * s) layer = canvas2d(SCREEN_W * s, SCREEN_H * s);
  const g = layer;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(s, 0, 0, s, 0, 0);
  for (const p of shadowSpots(frame.round, !!frame.rom)) blob(g, p.x, p.y, p.height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = false;
  g.drawImage(m.canvas, 0, 0, SCREEN_W, SCREEN_H);

  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = fade;
  out.drawImage(g.canvas, 0, 0, SCREEN_W, SCREEN_H);
}
