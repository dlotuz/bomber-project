import { coverRect, SCREEN_H, SCREEN_W, type ScreenLayout } from '../display';

/** Miniatura da imagem do jogo (proporção da base 256×224) e quanto ela é desfocada e escurecida. */
const TW = 64, TH = 56, BLUR_PX = 2, MARGIN = 4, DARK = 0.55;
/** Degrau intermediário da ampliação (4× a miniatura): duas passadas bilineares saem lisas como uma bicúbica, que em
 *  tela cheia custava ~0,9 ms por quadro. */
const MW = TW * 4, MH = TH * 4;

let grab: CanvasRenderingContext2D | null = null;
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
 * Fundo das bordas (16:9 e janelas mais altas): a imagem final da área do jogo — base, menus HD, arte HD da partida e
 * efeitos, já no canvas de saída em (`gx`, `gy`) — ampliada para cobrir a tela inteira, desfocada e escurecida. Chamado
 * DEPOIS de desenhar a área do jogo; só pinta fora dela (o recorte deixa a imagem nítida intacta).
 * Barato por quadro: a área do jogo é reduzida para 256×224 (cópia na GPU) e daí para 64×56, desfocada nesse
 * tamanho e só então ampliada em duas passadas bilineares — nada de `getImageData` nem de desfocar em resolução cheia.
 * Sem bordas, não desenha nada.
 */
export function drawBackdrop(out: CanvasRenderingContext2D, L: ScreenLayout, gx = L.ox, gy = L.oy): void {
  if (L.w - L.gw < 2 && L.h - L.gh < 2) return;
  grab ??= small(SCREEN_W, SCREEN_H);
  tiny ??= small(TW, TH);
  soft ??= small(TW, TH);
  med ??= small(MW, MH);
  out.setTransform(1, 0, 0, 1, 0, 0);
  // a área do jogo inteira (a parte fora do canvas fica de fora e a miniatura só a omite)
  const x0 = Math.max(0, gx), y0 = Math.max(0, gy);
  const x1 = Math.min(out.canvas.width, gx + L.gw), y1 = Math.min(out.canvas.height, gy + L.gh);
  if (x1 - x0 < 1 || y1 - y0 < 1) return;
  const kx = SCREEN_W / L.gw, ky = SCREEN_H / L.gh;
  grab.clearRect(0, 0, SCREEN_W, SCREEN_H);
  grab.imageSmoothingQuality = 'medium';   // redução grande (≈ 1/5): com mipmaps, sem serrilhado
  grab.drawImage(out.canvas, x0, y0, x1 - x0, y1 - y0, (x0 - gx) * kx, (y0 - gy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
  tiny.clearRect(0, 0, TW, TH);
  tiny.imageSmoothingQuality = 'high';   // 256 → 64: pequena, a qualidade sai de graça
  tiny.drawImage(grab.canvas, 0, 0, TW, TH);
  soft.clearRect(0, 0, TW, TH);
  // ampliada um pouco além da miniatura: o desfoque não puxa transparência (escuro) para dentro pelas beiradas
  soft.filter = `blur(${BLUR_PX}px)`;
  soft.drawImage(tiny.canvas, -MARGIN, -MARGIN, TW + 2 * MARGIN, TH + 2 * MARGIN);
  soft.filter = 'none';
  med.clearRect(0, 0, MW, MH);
  med.drawImage(soft.canvas, 0, 0, MW, MH);
  const r = coverRect(L.w, L.h, L.gw, L.gh);
  out.save();
  out.beginPath();
  out.rect(0, 0, L.w, L.h);
  out.rect(gx, gy, L.gw, L.gh);
  out.clip('evenodd');   // só as bordas: a imagem nítida do jogo já está desenhada
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = 'low';
  out.drawImage(med.canvas, r.x, r.y, r.w, r.h);
  out.fillStyle = `rgba(0,0,0,${DARK})`;
  out.fillRect(0, 0, L.w, L.h);
  out.restore();
  out.imageSmoothingEnabled = false;
}
