import { SCREEN_H, SCREEN_W, type Display, type ScreenMode } from '../display';
import { drawBackdrop } from './backdrop';
import { smoothFactor, smoothUpscale } from './smooth-gl';
import { drawFx, prepareFx } from './draw';
import { drawHdMenu } from '../hd-menu';
import { drawHdBattleLayer } from '../hdart/mode';
import type { FxFrame } from './state';

/** Base ampliada por um inteiro `k` sem suavizar (pixels nítidos e todos do mesmo tamanho); depois esse quadro é
 *  levado à escala final, quebrada e/ou 4:3, com suavização — só a borda de cada pixel fica levemente macia, em vez
 *  de linhas e colunas com espessuras desiguais (o "sharp bilinear" dos emuladores). */
let mid: CanvasRenderingContext2D | null = null;
function sharpBase(d: Display): CanvasImageSource {
  const k = Math.max(1, Math.floor(Math.min(d.scale(), d.scaleX())));
  if (k === d.scale() && k === d.scaleX()) return d.ctx.canvas;   // escala inteira e pixel quadrado: direto
  if (!mid || mid.canvas.width !== SCREEN_W * k) {
    const c = document.createElement('canvas');
    c.width = SCREEN_W * k; c.height = SCREEN_H * k;
    mid = c.getContext('2d')!;
  }
  mid.imageSmoothingEnabled = false;
  mid.clearRect(0, 0, mid.canvas.width, mid.canvas.height);
  mid.drawImage(d.ctx.canvas, 0, 0, mid.canvas.width, mid.canvas.height);
  return mid.canvas;
}

/** Base ampliada centrada na janela e, por cima/por baixo dela, as camadas em resolução nativa: menus HD
 *  e arte HD da partida por baixo (a base fica transparente onde eles entram), arte HD por cima e, na batalha, os
 *  efeitos (spec §3.1) — tudo deslocado junto com a imagem do jogo (centralização) e recortado na área dela.
 *  O filtro suave só passa pela base (a arte HD já é nativa). Por último as bordas: o fundo borrado, feito da imagem
 *  final da área do jogo, ou preto (`mode`). `fade` = brilho do App / 15. */
export function present(d: Display, frame: FxFrame | null, fade: number, mode: ScreenMode = { blur: true, smooth: false }): void {
  const { out } = d, L = d.layout(), { sx, sy } = L;
  const ox = L.ox, oy = L.oy;
  // cor das bombas na própria base (antes de ampliar/suavizar) e máscara das sombras
  const prep = frame ? prepareFx(frame, d.ctx, fade) : null;
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  out.fillStyle = '#000'; out.fillRect(0, 0, L.w, L.h);
  drawHdMenu(out, sx, sy, ox, oy);   // menus: fundo/texto HD por baixo da base transparente
  drawHdBattleLayer(out, sx, sy, ox, oy, 'under', 1, !!frame);   // partida com arte HD: o que fica por baixo da base (bombas HD na cor do dono com os efeitos ligados)
  out.setTransform(1, 0, 0, 1, 0, 0);
  // filtro suave: amplia por um inteiro com bordas lisas (WebGL); sem WebGL, a ampliação nítida
  const src = (mode.smooth && smoothUpscale(d.ctx.canvas, smoothFactor(sy))) || sharpBase(d);
  out.imageSmoothingEnabled = src !== d.ctx.canvas;
  out.imageSmoothingQuality = 'high';
  out.drawImage(src, ox, oy, L.gw, L.gh);
  out.imageSmoothingEnabled = false;
  drawHdBattleLayer(out, sx, sy, ox, oy, 'over', fade, !!frame);   // partida com arte HD: por cima da base, antes dos efeitos
  if (frame && prep) {
    out.setTransform(sx, 0, 0, sy, ox, oy);   // os efeitos desenham em pixels de base, rasterizados em resolução nativa
    out.save();
    out.beginPath(); out.rect(0, 0, SCREEN_W, SCREEN_H); out.clip();   // partículas e sombras não vazam para as bordas
    drawFx(out, frame, prep, fade);
    out.restore();
  }
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalAlpha = 1;
  out.globalCompositeOperation = 'source-over';
  if (mode.blur) drawBackdrop(out, L, ox, oy);
}
