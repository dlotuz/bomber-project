import { coverRect, type ScreenLayout } from '../display';
import { hdBgThumb } from '../hd-menu';

/** Miniatura da imagem do jogo (proporção da base 256×224) e quanto ela é desfocada e escurecida. */
const TW = 64, TH = 56, BLUR_PX = 2, MARGIN = 4, DARK = 0.55;
/** Degrau intermediário da ampliação (4× a miniatura): duas passadas bilineares saem lisas como uma bicúbica, que em
 *  tela cheia custava ~0,9 ms por quadro. */
const MW = TW * 4, MH = TH * 4;

let tiny: CanvasRenderingContext2D | null = null;
let soft: CanvasRenderingContext2D | null = null;
let med: CanvasRenderingContext2D | null = null;
const small = (w: number, h: number): CanvasRenderingContext2D => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
  return g;
};

/**
 * Fundo das bordas (16:9 e janelas mais altas): a própria imagem do jogo ampliada para cobrir a tela inteira,
 * desfocada e escurecida, por trás da imagem nítida. Barato por quadro: a base 256×224 (canvas na CPU) e, nos menus
 * HD, a miniatura do fundo HD são reduzidas para 64×56, desfocadas nesse tamanho e só então ampliadas em duas passadas
 * bilineares — nada de ler pixels (`getImageData`) nem de desfocar em resolução cheia. Sem bordas, não desenha nada.
 */
export function drawBackdrop(out: CanvasRenderingContext2D, base: HTMLCanvasElement, L: ScreenLayout): void {
  if (L.w - L.gw < 2 && L.h - L.gh < 2) return;
  tiny ??= small(TW, TH);
  soft ??= small(TW, TH);
  med ??= small(MW, MH);
  tiny.clearRect(0, 0, TW, TH);
  tiny.imageSmoothingQuality = 'high';   // a redução 256 → 64 é na CPU e pequena: aqui a qualidade sai de graça
  const bg = hdBgThumb(TW, TH);   // menus: fundo HD por baixo da base transparente (a imagem final do menu)
  if (bg) tiny.drawImage(bg, 0, 0);
  tiny.drawImage(base, 0, 0, TW, TH);
  soft.clearRect(0, 0, TW, TH);
  // ampliada um pouco além da miniatura: o desfoque não puxa transparência (escuro) para dentro pelas beiradas
  soft.filter = `blur(${BLUR_PX}px)`;
  soft.drawImage(tiny.canvas, -MARGIN, -MARGIN, TW + 2 * MARGIN, TH + 2 * MARGIN);
  soft.filter = 'none';
  med.clearRect(0, 0, MW, MH);
  med.drawImage(soft.canvas, 0, 0, MW, MH);
  const r = coverRect(L.w, L.h, L.gw, L.gh);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = 'low';
  out.drawImage(med.canvas, r.x, r.y, r.w, r.h);
  out.fillStyle = `rgba(0,0,0,${DARK})`;
  out.fillRect(0, 0, L.w, L.h);
  out.imageSmoothingEnabled = false;
}
