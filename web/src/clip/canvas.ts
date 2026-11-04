// Quadro do CLIPE: 1280×720 fixo, seja qual for a janela. A área do jogo já apresentada no #screen (com efeitos, arte
// HD e os nomes do online) vai centrada na altura toda e as bordas ganham o mesmo fundo borrado do modo HD — o clipe
// sai igual no computador, no celular em pé ou no modo clássico.
import { SCREEN_H, SCREEN_W, type ScreenLayout } from '../render/display';
import { drawBackdrop } from '../render/fx/backdrop';

export const CLIP_W = 1280;
export const CLIP_H = 720;
export const CLIP_FPS = 60;

/** Onde a área do jogo (proporção `w × h`) fica no quadro do clipe. Pura (testes). */
export function clipLayout(area: { w: number; h: number }, W = CLIP_W, H = CLIP_H): ScreenLayout {
  let gh = H, gw = Math.round((H * area.w) / area.h);
  if (gw > W) { gw = W; gh = Math.round((W * area.h) / area.w); }
  return { w: W, h: H, gw, gh, ox: Math.floor((W - gw) / 2), oy: Math.floor((H - gh) / 2), sx: gw / SCREEN_W, sy: gh / SCREEN_H };
}

export class ClipCanvas {
  readonly canvas: HTMLCanvasElement;
  private readonly cx: CanvasRenderingContext2D;
  private track: MediaStreamTrack | null = null;

  constructor(doc: Document = document) {
    this.canvas = doc.createElement('canvas');
    this.canvas.width = CLIP_W; this.canvas.height = CLIP_H;
    this.cx = this.canvas.getContext('2d', { alpha: false })!;
    this.cx.fillStyle = '#000';
    this.cx.fillRect(0, 0, CLIP_W, CLIP_H);
  }

  /** Trilha de vídeo do canvas (uma só, reaproveitada a cada gravação). */
  videoTrack(): MediaStreamTrack {
    if (!this.track || this.track.readyState === 'ended') this.track = this.canvas.captureStream(CLIP_FPS).getVideoTracks()[0];
    return this.track;
  }

  /** Copia a área do jogo do `src` (o #screen já apresentado) e pinta as bordas com o fundo borrado. */
  compose(src: HTMLCanvasElement, area: { x: number; y: number; w: number; h: number }): void {
    if (area.w < 1 || area.h < 1) return;
    const L = clipLayout(area), cx = this.cx;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(src, area.x, area.y, area.w, area.h, L.ox, L.oy, L.gw, L.gh);
    drawBackdrop(cx, L);
  }
}
