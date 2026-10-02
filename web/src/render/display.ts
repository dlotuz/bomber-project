export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Largura a mais da imagem na TV: o SNES gera 256×224 (8:7), mas a TV mostrava a imagem em 4:3 → 7/6. */
export const TV_ASPECT = (SCREEN_H * 4) / 3 / SCREEN_W;

/** `ctx` = canvas de base 256×224 (fora da tela), onde todo o jogo desenha; `out` = o #screen em resolução nativa.
 *  `scale()` = escala vertical; `scaleX()` = horizontal (= `scale()` × 7/6 com a proporção da TV). */
export interface Display { ctx: CanvasRenderingContext2D; out: CanvasRenderingContext2D; scale(): number; scaleX(): number }

/** Como a base vira imagem na tela: `fill` ocupa a janela com escala quebrada; `int` só usa múltiplos inteiros (como
 *  antes); `tv` alarga para 4:3 como a TV, `pixel` mantém os pixels quadrados (8:7). */
export interface FitOptions { fill: boolean; tv: boolean }

/** Escalas (sx, sy) para a base caber em `w × h` pixels de dispositivo. Pura (testes). */
export function fitScale(w: number, h: number, o: FitOptions): { sx: number; sy: number } {
  const ax = o.tv ? TV_ASPECT : 1;
  let sy = Math.min(h / SCREEN_H, w / (SCREEN_W * ax));
  if (!o.fill) sy = Math.floor(sy);
  sy = Math.max(1, sy);
  return { sx: sy * ax, sy };
}

/** Opções vindas da URL: `?tela=inteiro` volta aos múltiplos inteiros; `?proporcao=pixel` desliga o 4:3. */
export function fitOptionsFromUrl(search: string): FitOptions {
  const q = new URLSearchParams(search);
  return { fill: q.get('tela') !== 'inteiro', tv: q.get('proporcao') !== 'pixel' };
}

let base: CanvasRenderingContext2D | null = null;

/** Canvas visível = a base ampliada por `fitScale` (× DPR) para ocupar a janela; `present()` desenha nele. */
export function createDisplay(canvas: HTMLCanvasElement, opts: FitOptions = { fill: true, tv: true }): Display {
  const b = document.createElement('canvas');
  b.width = SCREEN_W; b.height = SCREEN_H;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  base = ctx;
  const out = canvas.getContext('2d')!;
  let sx = 1, sy = 1;
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    ({ sx, sy } = fitScale(window.innerWidth * dpr, window.innerHeight * dpr, opts));
    canvas.width = Math.round(SCREEN_W * sx);
    canvas.height = Math.round(SCREEN_H * sy);
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    out.imageSmoothingEnabled = false;   // redimensionar o canvas reseta o contexto
  };
  window.addEventListener('resize', fit);
  fit();
  // Tela cheia: Alt+Enter ou duplo clique na imagem (F11 do navegador também serve)
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  window.addEventListener('keydown', e => { if (e.key === 'Enter' && e.altKey) { e.preventDefault(); toggleFull(); } });
  canvas.addEventListener('dblclick', toggleFull);
  return { ctx, out, scale: () => sy, scaleX: () => sx };
}

/** Cor 0xRRGGBB de um pixel do canvas de base (`dflt` fora do navegador). */
export function sampleBase(x: number, y: number, dflt: number): number {
  if (!base) return dflt;
  const d = base.getImageData(x, y, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
