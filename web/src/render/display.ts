export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Largura a mais da imagem na TV: o SNES gera 256×224 (8:7), mas a TV mostrava a imagem em 4:3 → 7/6. */
export const TV_ASPECT = (SCREEN_H * 4) / 3 / SCREEN_W;

/** `ctx` = canvas de base 256×224 (fora da tela), onde todo o jogo desenha; `out` = o #screen (a janela inteira) em
 *  resolução nativa. `scale()` = escala vertical; `scaleX()` = horizontal (= `scale()` × 7/6 com a proporção da TV);
 *  `layout()` = onde a imagem do jogo fica no #screen. */
export interface Display {
  ctx: CanvasRenderingContext2D; out: CanvasRenderingContext2D; scale(): number; scaleX(): number; layout(): ScreenLayout;
}

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

/** O #screen ocupa a janela toda (`w × h` px de dispositivo); a imagem do jogo (`gw × gh`, escalas `sx`/`sy`) fica
 *  centrada nele, a partir de (`ox`, `oy`). O resto (laterais no 16:9) é a borda: preta ou o fundo borrado. */
export interface ScreenLayout { w: number; h: number; sx: number; sy: number; gw: number; gh: number; ox: number; oy: number }

/** Layout para uma janela de `w × h` px de dispositivo. Pura (testes). */
export function screenLayout(w: number, h: number, o: FitOptions): ScreenLayout {
  const { sx, sy } = fitScale(w, h, o);
  const gw = Math.round(SCREEN_W * sx), gh = Math.round(SCREEN_H * sy);
  const cw = Math.max(Math.round(w), gw), ch = Math.max(Math.round(h), gh);
  return { w: cw, h: ch, sx, sy, gw, gh, ox: Math.floor((cw - gw) / 2), oy: Math.floor((ch - gh) / 2) };
}

/** Retângulo que cobre a tela `w × h` inteira com uma imagem `gw × gh` ampliada por igual e centrada (o resto sai
 *  pelas bordas), como `object-fit: cover`. Pura (testes). */
export function coverRect(w: number, h: number, gw: number, gh: number): { x: number; y: number; w: number; h: number } {
  const c = Math.max(w / gw, h / gh), cw = gw * c, ch = gh * c;
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

/** Como a tela é apresentada: `blur` = bordas com a imagem do jogo borrada e escurecida (senão, pretas). */
export interface ScreenMode { blur: boolean }

/** O que a URL força: `?bordas=preto|borrado` (sem o parâmetro, valem as Opções). */
export function screenModeFromUrl(search: string): Partial<ScreenMode> {
  const q = new URLSearchParams(search), r: Partial<ScreenMode> = {};
  const b = q.get('bordas');
  if (b === 'preto' || b === 'preta' || b === 'pretas') r.blur = false;
  else if (b === 'borrado' || b === 'borradas') r.blur = true;
  return r;
}

/** Modo efetivo: a URL manda; sem ela, as Opções. */
export function resolveScreenMode(url: Partial<ScreenMode>, opts: { blurBorders: boolean }): ScreenMode {
  return { blur: url.blur ?? opts.blurBorders };
}

let base: CanvasRenderingContext2D | null = null;

/** Canvas visível = a janela inteira (× DPR); a base ampliada por `fitScale` fica centrada nele (`present()`). */
export function createDisplay(canvas: HTMLCanvasElement, opts: FitOptions = { fill: true, tv: true }): Display {
  const b = document.createElement('canvas');
  b.width = SCREEN_W; b.height = SCREEN_H;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  base = ctx;
  const out = canvas.getContext('2d')!;
  let lay = screenLayout(SCREEN_W, SCREEN_H, opts);
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    lay = screenLayout(window.innerWidth * dpr, window.innerHeight * dpr, opts);
    canvas.width = lay.w;
    canvas.height = lay.h;
    canvas.style.width = `${lay.w / dpr}px`;
    canvas.style.height = `${lay.h / dpr}px`;
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
  return { ctx, out, scale: () => lay.sy, scaleX: () => lay.sx, layout: () => lay };
}

/** Cor 0xRRGGBB de um pixel do canvas de base (`dflt` fora do navegador). */
export function sampleBase(x: number, y: number, dflt: number): number {
  if (!base) return dflt;
  const d = base.getImageData(x, y, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
