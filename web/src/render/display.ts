export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** `ctx` = canvas de base 256×224 (fora da tela), onde todo o jogo desenha; `out` = o #screen em resolução nativa. */
export interface Display { ctx: CanvasRenderingContext2D; out: CanvasRenderingContext2D; scale(): number }

let base: CanvasRenderingContext2D | null = null;

/** Canvas visível = 256×224 × o maior inteiro que cabe na janela (× DPR); a base é ampliada nele por `present()`. */
export function createDisplay(canvas: HTMLCanvasElement): Display {
  const b = document.createElement('canvas');
  b.width = SCREEN_W; b.height = SCREEN_H;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  base = ctx;
  const out = canvas.getContext('2d')!;
  let s = 1;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    s = Math.max(1, Math.floor(Math.min((window.innerWidth * dpr) / SCREEN_W, (window.innerHeight * dpr) / SCREEN_H)));
    canvas.width = SCREEN_W * s;
    canvas.height = SCREEN_H * s;
    canvas.style.width = `${(SCREEN_W * s) / dpr}px`;
    canvas.style.height = `${(SCREEN_H * s) / dpr}px`;
    out.imageSmoothingEnabled = false;   // redimensionar o canvas reseta o contexto
  };
  window.addEventListener('resize', fit);
  fit();
  return { ctx, out, scale: () => s };
}

/** Cor 0xRRGGBB de um pixel do canvas de base (`dflt` fora do navegador). */
export function sampleBase(x: number, y: number, dflt: number): number {
  if (!base) return dflt;
  const d = base.getImageData(x, y, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
