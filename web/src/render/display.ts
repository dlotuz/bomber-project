export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Largura a mais da imagem na TV: o SNES gera 256×224 (8:7), mas a TV mostrava a imagem em 4:3 → 7/6. */
export const TV_ASPECT = (SCREEN_H * 4) / 3 / SCREEN_W;

/** `ctx` = canvas de base 256×224 (fora da tela), onde todo o jogo desenha; `out` = o #screen (a janela inteira) em
 *  resolução nativa. `scale()` = escala vertical; `scaleX()` = horizontal (= `scale()` × 7/6 com a proporção da TV);
 *  `layout()` = onde a imagem do jogo fica no #screen. */
export interface Display {
  ctx: CanvasRenderingContext2D; out: CanvasRenderingContext2D; scale(): number; scaleX(): number; layout(): ScreenLayout;
  /** Recalcula o layout se o modo de tela (Opções/URL) mudou desde a última vez; barato, pode ser chamado a cada quadro. */
  refit(): void;
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

/** Modo de tela das Opções: `hd` = imagem na altura toda (escala quebrada) em 4:3 como a TV, laterais com o fundo
 *  borrado; `classic` = como o SNES: só múltiplos inteiros, pixel quadrado (8:7) e bordas pretas. */
export type ScreenKind = 'hd' | 'classic';
export const SCREEN_KINDS: readonly ScreenKind[] = ['hd', 'classic'];

/** O que a URL força na tela: `?tela=hd|classica` escolhe o modo; `?tela=inteiro` e `?proporcao=pixel` ajustam só o
 *  encaixe; `?bordas=preto|borrado` só o fundo. Pura (testes). */
export function screenFromUrl(search: string): { kind?: ScreenKind; fill?: false; tv?: false } {
  const q = new URLSearchParams(search), t = q.get('tela'), r: { kind?: ScreenKind; fill?: false; tv?: false } = {};
  if (t === 'hd') r.kind = 'hd';
  else if (t === 'classica' || t === 'clássica' || t === 'classico') r.kind = 'classic';
  else if (t === 'inteiro') r.fill = false;
  if (q.get('proporcao') === 'pixel') r.tv = false;
  return r;
}

/** Modo efetivo: a URL manda; sem ela, as Opções. */
export const resolveScreenKind = (search: string, opt: ScreenKind): ScreenKind => screenFromUrl(search).kind ?? opt;

/** Encaixe do modo (`?tela=inteiro` / `?proporcao=pixel` ainda afinam o HD para testes). */
export function fitOptionsFor(kind: ScreenKind, search = ''): FitOptions {
  const u = screenFromUrl(search), k = u.kind ?? kind;
  if (k === 'classic') return { fill: false, tv: false };
  return { fill: u.fill ?? true, tv: u.tv ?? true };
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

/** Como a tela é apresentada: `blur` = laterais com a imagem do jogo borrada e escurecida (modo HD; senão, pretas); `smooth` =
 *  filtro suave (pixel art ampliada com bordas lisas, em WebGL) no lugar da ampliação nítida. */
export interface ScreenMode { blur: boolean; smooth: boolean }

/** O que a URL força: `?bordas=preto|borrado` e `?filtro=suave|nitido` (sem o parâmetro, valem as Opções). */
export function screenModeFromUrl(search: string): Partial<ScreenMode> {
  const q = new URLSearchParams(search), r: Partial<ScreenMode> = {};
  const b = q.get('bordas'), f = q.get('filtro');
  if (b === 'preto' || b === 'preta' || b === 'pretas') r.blur = false;
  else if (b === 'borrado' || b === 'borradas') r.blur = true;
  if (f === 'suave') r.smooth = true;
  else if (f === 'nitido' || f === 'nítido') r.smooth = false;
  return r;
}

/** Modo efetivo: a URL manda; sem ela, as Opções. */
export function resolveScreenMode(url: Partial<ScreenMode>, opts: { screen: ScreenKind; smooth: boolean }, kind: ScreenKind = opts.screen): ScreenMode {
  return { blur: url.blur ?? kind === 'hd', smooth: url.smooth ?? opts.smooth };
}

let base: CanvasRenderingContext2D | null = null;

/** Canvas visível = a janela inteira (× DPR); a base ampliada por `fitScale` fica centrada nele (`present()`). */
export function createDisplay(canvas: HTMLCanvasElement, getOpts: () => FitOptions = () => ({ fill: true, tv: true })): Display {
  const b = document.createElement('canvas');
  b.width = SCREEN_W; b.height = SCREEN_H;
  const ctx = b.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  base = ctx;
  const out = canvas.getContext('2d')!;
  let opts = getOpts();
  let lay = screenLayout(SCREEN_W, SCREEN_H, opts);
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    opts = getOpts();
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
  const refit = () => { const n = getOpts(); if (n.fill !== opts.fill || n.tv !== opts.tv) fit(); };
  return { ctx, out, scale: () => lay.sy, scaleX: () => lay.sx, layout: () => lay, refit };
}

/** Cor 0xRRGGBB de um pixel do canvas de base (`dflt` fora do navegador). */
export function sampleBase(x: number, y: number, dflt: number): number {
  if (!base) return dflt;
  const d = base.getImageData(x, y, 1, 1).data;
  return (d[0] << 16) | (d[1] << 8) | d[2];
}
