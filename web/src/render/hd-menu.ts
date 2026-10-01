// Menus em alta resolução: arte de fundo (quebra-cabeça + corda), texto e mão desenhados no canvas de saída na
// resolução nativa, por baixo da base 256×224 (que fica transparente nos menus e só carrega o escurecimento do fade).
// As telas chamam `hdMenu` em vez da cena da ROM; `drawText` desvia para cá os estilos de menu enquanto ele vale.
import type { TextStyleId, Tone } from './text/types';
import menuBgUrl from '../assets/menu-bg.jpg';
import handUrl from '../assets/hand.png';

interface HdText { text: string; x: number; y: number; size: number; row: number; tone: Tone; align: 'left' | 'center' | 'right'; title: boolean; color?: string }
/** Tamanhos por tela (px da base): `item` = `menuItem`, `title` = `menuTitle`, `hand` = escala da luva. */
export interface HdSizes { item?: number; title?: number; hand?: number }

const state = { on: false, cursor: null as null | [number, number], texts: [] as HdText[], sizes: {} as HdSizes };

/** Altura da linha da fonte da ROM (o texto HD fica centrado nela) e tamanho padrão do texto HD, por estilo desviado;
 *  os outros estilos seguem na base. */
const ROW: Partial<Record<TextStyleId, number>> = { menuTitle: 16, menuItem: 16, ascii8: 8 };
const SIZE: Partial<Record<TextStyleId, number>> = { menuTitle: 18, menuItem: 15, ascii8: 9 };
const FONT = '"Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';

/** Degradê (topo → base) por tom, nas cores da arte de referência. */
const GRAD: Record<Tone, readonly [string, string, string]> = {
  default: ['#ffc81e', '#ff7a12', '#e8260e'],
  orange: ['#ffc81e', '#ff7a12', '#e8260e'],
  red: ['#ff8a5a', '#f23a22', '#b8140e'],
  green: ['#b8ff4a', '#4ad81e', '#1a8a10'],
  blue: ['#8af4ff', '#22b8ff', '#1440e0'],
  yellow: ['#fff6b0', '#ffd23f', '#e89a1a'],
  white: ['#ffffff', '#f0f0f0', '#c8c8d0'],
  gray: ['#e0e0e0', '#a8a8a8', '#787878'],
};
const TITLE_GRAD: readonly [string, string, string] = ['#c8fcff', '#3cc4ff', '#1446e8'];

let bg: HTMLImageElement | null = null;
const bgImg = (): HTMLImageElement | null => {
  if (!bg && typeof Image !== 'undefined') {
    bg = new Image(); bg.src = menuBgUrl;
    void document.fonts?.load(`700 20px ${FONT}`);
  }
  return bg?.complete ? bg : null;
};
let hand: HTMLImageElement | null = null;
const handImg = (): HTMLImageElement | null => {
  if (!hand && typeof Image !== 'undefined') { hand = new Image(); hand.src = handUrl; }
  return hand?.complete ? hand : null;
};

/** Zera o quadro (chamado antes de cada `app.draw`). */
export function hdBegin(): void { state.on = false; state.cursor = null; state.texts.length = 0; state.sizes = {}; }
export const hdActive = (): boolean => state.on;
/** Textos guardados neste quadro (testes). */
export const hdTexts = (): readonly HdText[] => state.texts;

/** Tela de menu: base transparente, fundo HD e mão em (x, y) da base (mesma âncora da mão 16×16 da ROM). */
export function hdMenu(ctx: CanvasRenderingContext2D, cursor?: readonly [number, number] | null, sizes: HdSizes = {}): void {
  ctx.clearRect(0, 0, 256, 224);
  state.on = true;
  state.sizes = sizes;
  state.cursor = cursor ? [cursor[0], cursor[1]] : null;
}

/** Desvio do `drawText`: guarda o texto se o estilo é de menu e a tela está em modo HD. Devolve a largura (px da base). */
export function hdText(style: TextStyleId, text: string, x: number, y: number, tone: Tone = 'default',
  align: 'left' | 'center' | 'right' = 'left', color?: string): number | null {
  const row = ROW[style];
  if (!state.on || !row) return null;
  const size = (style === 'menuItem' ? state.sizes.item : style === 'menuTitle' ? state.sizes.title : undefined) ?? SIZE[style]!;
  state.texts.push({ text, x, y, size, row, tone, align, title: style === 'menuTitle', color: style === 'menuTitle' ? undefined : color });
  return text.length * size * 0.52;
}

function drawLabel(out: CanvasRenderingContext2D, t: HdText): void {
  out.font = `700 ${t.size}px ${FONT}`;
  out.textAlign = t.align;
  out.textBaseline = 'middle';
  const cy = t.y + t.row / 2, top = cy - t.size * 0.42, bot = cy + t.size * 0.42;
  // nunca passa da moldura (x 12–244): encolhe na horizontal se precisar
  const max = t.align === 'left' ? 244 - t.x : t.align === 'right' ? t.x - 12 : 2 * Math.min(t.x - 12, 244 - t.x);
  const c = t.title ? TITLE_GRAD : GRAD[t.tone];
  const g = out.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
  out.lineJoin = 'round';
  // sombra, contorno escuro grosso, aro na cor escura do tom (branco no título), miolo em degradê e brilho no alto
  out.fillStyle = 'rgba(30,10,0,0.5)';
  out.fillText(t.text, t.x + t.size * 0.05, cy + t.size * 0.09, max);
  out.strokeStyle = t.title ? '#0a1450' : '#2a0804'; out.lineWidth = t.size * 0.34;
  out.strokeText(t.text, t.x, cy, max);
  out.strokeStyle = t.title ? '#ffffff' : t.color ?? c[2]; out.lineWidth = t.size * 0.15;
  out.strokeText(t.text, t.x, cy, max);
  out.fillStyle = t.color ?? g;
  out.fillText(t.text, t.x, cy, max);
  // reflexo espelhado: faixa branca com corte seco na metade de cima e um reflexo fraco subindo da base
  const shine = out.createLinearGradient(0, top, 0, bot);
  shine.addColorStop(0, 'rgba(255,255,255,0.8)'); shine.addColorStop(0.42, 'rgba(255,255,255,0.2)');
  shine.addColorStop(0.43, 'rgba(255,255,255,0)'); shine.addColorStop(0.8, 'rgba(255,255,255,0)');
  shine.addColorStop(1, 'rgba(255,255,255,0.25)');
  out.fillStyle = shine;
  out.fillText(t.text, t.x, cy, max);
}

/** Luva apontando para a direita (arte 256×181): ponta do indicador em (x + 13, y + 8), 3 px antes do texto, como a
 *  mão 16×16 da ROM; `k` = escala (1 ≈ 17 px de largura). */
const HAND_TIP_Y = 0.376;   // altura da ponta do indicador na arte (fração)
function drawHand(out: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  const img = handImg();
  if (!img) return;
  const w = 17 * k, h = (w * img.height) / img.width;
  out.drawImage(img, x + 13 - w, y + 8 - HAND_TIP_Y * h, w, h);
}

/** Desenha a camada HD em `out` (escala `s`); depois o chamador põe a base por cima. Sem menu HD, não faz nada. */
export function drawHdMenu(out: CanvasRenderingContext2D, s: number): boolean {
  if (!state.on) return false;
  out.setTransform(s, 0, 0, s, 0, 0);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = 'high';
  const img = bgImg();
  if (img) out.drawImage(img, 0, 0, 256, 224);
  else { out.fillStyle = '#d8a83a'; out.fillRect(0, 0, 256, 224); }
  for (const t of state.texts) drawLabel(out, t);
  if (state.cursor) drawHand(out, state.cursor[0], state.cursor[1], state.sizes.hand ?? 1.6);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = false;
  return true;
}
