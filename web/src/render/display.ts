export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Canvas de 256×224 escalado pelo maior inteiro que cabe na janela. */
export function createDisplay(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const fit = () => {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H)));
    canvas.style.width = `${SCREEN_W * s}px`;
    canvas.style.height = `${SCREEN_H * s}px`;
  };
  window.addEventListener('resize', fit);
  fit();
  return ctx;
}
