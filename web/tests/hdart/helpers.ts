import { makeHdPack } from '../../src/render/hdart/load';
import { stageKey, type HdAnim, type HdManifest, type HdPack } from '../../src/render/hdart/types';
import { ARENA_TILES } from '../../src/render/hdart/cover';

/** Imagens falsas (só identidade): 'a' = folha de 256×256, 'b' = folha 2. */
export const IMG_A = { id: 'img-a', width: 256, height: 256 } as unknown as CanvasImageSource;
export const IMG_B = { id: 'img-b', width: 256, height: 256 } as unknown as CanvasImageSource;

/** Desenho parado de 1 quadro: recorte 64×64 em (x, 0) da imagem `img`, apoio no centro (32, 32). */
export const still = (x = 0, img = 'a', anchor: [number, number] = [32, 32], rect: [number, number, number, number] = [x, 0, 64, 64]): HdAnim =>
  ({ frames: [{ img, rect, anchor }], ticks: [1], loop: false });

/** Animação de `n` quadros (recortes em x = 0, 64, 128…) com `ticks` cada. */
export const anim = (n: number, ticks: number, loop: boolean, img = 'b'): HdAnim =>
  ({ frames: Array.from({ length: n }, (_, i) => ({ img, rect: [64 * i, 0, 64, 64] as const, anchor: [32, 56] as const })), ticks: Array(n).fill(ticks), loop });

export function manifest(anims: Record<string, HdAnim>, cell = 64): HdManifest {
  return { format: 1, name: 'teste', credits: 'testes', license: 'CC0', cell, images: { a: 'a.png', b: 'b.png' }, anims };
}

/** Pacote em memória com as animações dadas (imagens 'a' e 'b' presentes). */
export function testPack(anims: Record<string, HdAnim>, cell = 64): HdPack {
  return makeHdPack(manifest(anims, cell), new Map([['a', IMG_A], ['b', IMG_B]]));
}

/** As peças obrigatórias da arena `stage`, cada uma num recorte diferente da imagem 'a'. */
export function arenaAnims(stage: number): Record<string, HdAnim> {
  return Object.fromEntries(ARENA_TILES.map((t, i) => [stageKey(stage, t), still(64 * i)]));
}

export interface DrawCall { img: unknown; sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }

/** Contexto 2D falso que registra `drawImage` (forma de 9 argumentos), texto e a transformação. */
export function recCtx() {
  const calls: DrawCall[] = [];
  const texts: { text: string; x: number; y: number; color: unknown }[] = [];
  const transforms: number[][] = [];
  const ctx = {
    calls, texts, transforms,
    globalAlpha: 1, filter: 'none', font: '', textAlign: '', textBaseline: '', lineJoin: '', lineWidth: 1,
    strokeStyle: '', fillStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    setTransform(...m: number[]) { transforms.push(m); },
    drawImage(img: unknown, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
      calls.push({ img, sx, sy, sw, sh, dx, dy, dw, dh });
    },
    strokeText() {},
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y, color: ctx.fillStyle }); },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: DrawCall[]; texts: typeof texts; transforms: number[][] };
}
