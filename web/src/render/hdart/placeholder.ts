// Pacote de arte HD PROVISÓRIO (opção 5, frente P): arte original desenhada por código com a API Canvas 2D, em
// `cell` = 64 px por casa. Serve para provar o caminho inteiro (manifesto → imagens → desenho) até a arte do artista
// chegar. Nada aqui vem do Super Bomberman 4: os personagens são robôs genéricos (cabeça-monitor com tela e faixa de
// corrida, mãos e pés flutuantes) com a cor principal de cada um dos 6 personagens originais do Crown Blast
// (`art/bomber.ts`), e as arenas usam as paletas originais de `art/tiles.ts`.
//
// Um único código serve dois usos:
//  - `scripts/arte-hd/provisorio/gerar.ts` roda `paintSheet` no Chrome (playwright-core) e grava os PNG + `pacote.json`
//    em `public/arte-hd/provisorio/` — o pacote fica igual ao que um artista entregaria;
//  - `createPlaceholderPack()` monta o mesmo `HdPack` em memória com OffscreenCanvas (sem baixar nada).
// O manifesto (`buildPlaceholder().manifest`) não precisa de canvas: os testes o comparam com o `pacote.json` gravado.
import { HD_DIRS, charKey, stageKey, itemKey, type HdAnim, type HdDir, type HdFlamePart, type HdManifest, type HdPack, type HdTile } from './types';
import { THEMES, type Theme } from '../art/tiles';
import { CHARACTERS } from '../art/bomber';
import { ITEM } from '../../core/types';

export const PH_CELL = 64;
export const PH_NAME = 'provisorio';

type G = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Painter = (g: G) => void;

interface FrameSpec { w: number; h: number; anchor: readonly [number, number]; paint: Painter }
interface AnimSpec { key: string; frames: readonly FrameSpec[]; ticks: readonly number[]; loop: boolean }
export interface PlacedSheet { name: string; file: string; w: number; h: number; slots: readonly { x: number; y: number; f: FrameSpec }[] }
export interface PlaceholderBuild { manifest: HdManifest; sheets: readonly PlacedSheet[] }

// ---------------------------------------------------------------------------------------------------------------
// Ritmos (ticks de 60 Hz). Valores próximos do original quando conhecidos (ANI §5/§6 em render/anim/grid-seq.ts),
// senão escolhas razoáveis; a lista de encomenda (frente C) traz os ritmos recomendados para o artista.
// ---------------------------------------------------------------------------------------------------------------
export const PH_TICKS = {
  /** Bomba: 4 quadros de 20 ticks (o script do original troca de quadro a cada ~20). */
  bomb: [20, 20, 20, 20],
  /** Chama: 25 ticks no total, como as 25 fases de FLAME_PHASE; para no último (encolhida). */
  flame: [6, 6, 7, 6],
  /** Bloco queimando: 24 ticks (o original troca a cada 4, 6 quadros). */
  burning: [8, 8, 8],
  /** Andar: ciclo de 4 quadros (parado, passo, parado, passo) de 10 ticks = um passo a cada 20 ticks. */
  walk: [10, 10, 10, 10],
  stunned: [8, 8],
  dying: [10, 10, 12, 30],
  victory: [12, 12],
  still: [60],
} as const;

/** Tipos de montaria dos ovos (`$C1:5D87 & $0F`, ver core/mounts/core-api.ts EGG_TYPES_ALL). */
export const PH_EGG_TYPES: readonly number[] = [0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf];
/** Itens no chão cobertos (ITEM do núcleo; 0x30 = ovo ainda fechado). */
export const PH_ITEMS: readonly number[] = Object.values(ITEM);
export const PH_TILES: readonly HdTile[] = ['floor', 'floorAlt', 'hard', 'wall', 'soft', 'burning', 'pressure'];
export const PH_FLAMES: readonly HdFlamePart[] = ['center', 'h', 'v', 'up', 'down', 'left', 'right'];
export const PH_CHAR_COUNT = CHARACTERS.length;
/** Ações dos personagens no pacote (as demais caem para a ROM / arte simples). */
export const PH_CHAR_ACTS = ['idle', 'walk', 'stunned', 'dying', 'victory'] as const;

// ---------------------------------------------------------------------------------------------------------------
// Cores e formas básicas
// ---------------------------------------------------------------------------------------------------------------
const INK = '#1d1626';

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
const light = (c: string, t: number): string => mix(c, '#ffffff', t);
const dark = (c: string, t: number): string => mix(c, '#000000', t);

/** Gerador pseudoaleatório determinístico (o pacote sai igual a cada geração). */
function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function circle(g: G, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}
function ellipse(g: G, x: number, y: number, rx: number, ry: number): void {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}
function vgrad(g: G, y0: number, y1: number, stops: readonly string[]): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / Math.max(1, stops.length - 1), c));
  return gr;
}
function ball(g: G, x: number, y: number, r: number, c: string): CanvasGradient {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05);
  gr.addColorStop(0, light(c, 0.55));
  gr.addColorStop(0.45, c);
  gr.addColorStop(1, dark(c, 0.35));
  return gr;
}
/** Preenche o caminho atual e contorna. */
function fs(g: G, fill: string | CanvasGradient, stroke = INK, lw = 3): void {
  g.fillStyle = fill;
  g.fill();
  if (lw > 0) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.stroke();
  }
}
function star(g: G, x: number, y: number, r: number, rot = -Math.PI / 2): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, k = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  g.closePath();
}
function shadow(g: G, x: number, y: number, rx: number, ry: number, a = 0.28): void {
  ellipse(g, x, y, rx, ry);
  g.fillStyle = `rgba(0,0,0,${a})`;
  g.fill();
}

// ---------------------------------------------------------------------------------------------------------------
// Arenas (64×64, opacas: cada peça já traz o piso por baixo)
// ---------------------------------------------------------------------------------------------------------------
const C = PH_CELL;

function paintFloor(g: G, t: Theme, alt: boolean, seed: number): void {
  const swap = alt && t.checker !== false;
  const A = swap ? t.floorB : t.floorA, B = swap ? t.floorA : t.floorB;
  const r = rng(seed + (alt ? 77 : 0));
  g.fillStyle = A;
  g.fillRect(0, 0, C, C);
  g.lineCap = 'round';
  switch (t.floor) {
    case 'hatch':
      g.strokeStyle = B; g.lineWidth = 4;
      for (const y0 of [12, 44]) {
        g.beginPath();
        for (let x = -8; x <= C + 8; x += 16) g.lineTo(x, y0 + ((x / 16) % 2 ? 6 : -6));
        g.stroke();
      }
      break;
    case 'grass':
      for (let i = 0; i < 9; i++) {
        const x = 6 + r() * 52, y = 10 + r() * 48;
        g.strokeStyle = i % 3 ? B : light(A, 0.25); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x, y); g.lineTo(x + 4, y - 7); g.stroke();
      }
      break;
    case 'checker':
      g.fillStyle = vgrad(g, 0, C, [light(A, 0.12), A, dark(A, 0.06)]);
      g.fillRect(0, 0, C, C);
      break;
    case 'planks':
      for (const y0 of [0, 32]) {
        g.fillStyle = vgrad(g, y0, y0 + 32, [light(alt ? B : A, 0.1), alt ? B : A, dark(alt ? B : A, 0.12)]);
        g.fillRect(0, y0, C, 32);
        g.strokeStyle = dark(A, 0.35); g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, y0 + 31); g.lineTo(C, y0 + 31); g.stroke();
        g.strokeStyle = dark(A, 0.15); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(6, y0 + 12 + r() * 6); g.bezierCurveTo(24, y0 + 8, 40, y0 + 22, 58, y0 + 14); g.stroke();
        g.fillStyle = dark(A, 0.4);
        circle(g, (y0 ? 52 : 12), y0 + 16, 2); g.fill();
      }
      break;
    case 'plates':
      rr(g, 3, 3, C - 6, C - 6, 6);
      fs(g, vgrad(g, 3, C - 3, [light(B, 0.12), B, dark(B, 0.08)]), dark(A, 0.35), 2);
      g.fillStyle = dark(A, 0.3);
      for (const [x, y] of [[10, 10], [54, 10], [10, 54], [54, 54]]) { circle(g, x, y, 2.5); g.fill(); }
      break;
    case 'stars':
      for (let i = 0; i < 6; i++) {
        const x = r() * C, y = r() * C;
        g.fillStyle = i < 2 ? '#cfd6ff' : B;
        if (i < 2) { star(g, x, y, 3.5); g.fill(); } else { circle(g, x, y, 1.6); g.fill(); }
      }
      break;
    case 'tiles':
      rr(g, 2, 2, C - 4, C - 4, 5);
      fs(g, vgrad(g, 2, C - 2, [light(A, 0.15), A, dark(A, 0.1)]), dark(A, 0.35), 2);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(8, 10); g.lineTo(26, 10); g.stroke();
      break;
    case 'sand':
      for (let i = 0; i < 26; i++) {
        g.fillStyle = i % 2 ? B : dark(A, 0.12);
        circle(g, r() * C, r() * C, 1 + r() * 1.4); g.fill();
      }
      break;
    case 'carpet':
      g.strokeStyle = B; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(32, 4); g.lineTo(60, 32); g.lineTo(32, 60); g.lineTo(4, 32); g.closePath();
      g.stroke();
      g.fillStyle = light(B, 0.25);
      circle(g, 32, 32, 3); g.fill();
      break;
  }
  // luz suave de cima para baixo, comum a todas as arenas
  g.fillStyle = vgrad(g, 0, C, ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.08)']);
  g.fillRect(0, 0, C, C);
}

/** Bloco em vista 3/4: face de cima clara + lateral da frente escura. */
function block(g: G, face: string, lit: string, side: string, style: 'bevel' | 'flat' | 'plate' | 'brick'): void {
  rr(g, 1.5, 1.5, C - 3, C - 3, 9);
  fs(g, vgrad(g, 0, C, [dark(side, 0.05), dark(side, 0.3)]), dark(side, 0.55), 3);
  rr(g, 5, 4, C - 10, C - 18, 7);
  fs(g, vgrad(g, 4, C - 14, [lit, face, dark(face, 0.08)]), dark(side, 0.35), 2);
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(11, 9); g.lineTo(C - 22, 9); g.stroke();
  if (style === 'plate') {
    g.fillStyle = dark(side, 0.2);
    for (const [x, y] of [[12, 13], [52, 13], [12, 42], [52, 42]]) { circle(g, x, y, 3); g.fill(); }
    rr(g, 18, 16, 28, 20, 4);
    g.strokeStyle = dark(face, 0.2); g.lineWidth = 2; g.stroke();
  } else if (style === 'brick') {
    g.strokeStyle = dark(face, 0.3); g.lineWidth = 2;
    g.beginPath();
    for (const y of [20, 34]) { g.moveTo(6, y); g.lineTo(C - 6, y); }
    for (const [x, y0, y1] of [[32, 5, 20], [18, 20, 34], [46, 20, 34], [32, 34, 48]]) { g.moveTo(x, y0); g.lineTo(x, y1); }
    g.stroke();
  } else if (style === 'bevel') {
    rr(g, 16, 14, 32, 24, 5);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill();
  }
}

function paintHard(g: G, t: Theme): void {
  block(g, t.hardFace, t.hardLight, t.hardDark, t.hardStyle === 'flat' ? 'flat' : 'bevel');
}
function paintWall(g: G, t: Theme): void {
  block(g, t.wallFace, t.wallLight, t.wallDark, t.wallStyle === 'plate' ? 'plate' : 'brick');
}

function paintSoftShape(g: G, t: Theme, seed: number): void {
  const A = t.softA, B = t.softB, D = t.softDark;
  switch (t.soft) {
    case 'brick':
      block(g, A, light(A, 0.3), B, 'brick');
      break;
    case 'crate':
      rr(g, 3, 3, C - 6, C - 6, 6);
      fs(g, vgrad(g, 3, C - 3, [light(A, 0.2), A, B]), D, 3);
      rr(g, 11, 11, C - 22, C - 22, 3);
      fs(g, vgrad(g, 11, C - 11, [B, dark(B, 0.1)]), D, 2);
      g.strokeStyle = D; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(14, C - 14); g.lineTo(C - 14, 14); g.stroke();
      g.strokeStyle = light(A, 0.1); g.lineWidth = 3;
      g.beginPath(); g.moveTo(14, C - 14); g.lineTo(C - 14, 14); g.stroke();
      break;
    case 'rock': {
      const r = rng(seed);
      shadow(g, 32, 54, 26, 7, 0.3);
      g.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, k = 24 + r() * 5;
        g.lineTo(32 + Math.cos(a) * k, 30 + Math.sin(a) * k * 0.88);
      }
      g.closePath();
      fs(g, ball(g, 32, 30, 28, A), D, 3);
      g.strokeStyle = D; g.lineWidth = 2;
      g.beginPath(); g.moveTo(22, 22); g.lineTo(30, 30); g.lineTo(27, 40); g.moveTo(30, 30); g.lineTo(42, 32); g.stroke();
      break;
    }
    case 'bush':
      shadow(g, 32, 54, 26, 7, 0.3);
      for (const [x, y, r] of [[20, 36, 15], [44, 36, 15], [32, 24, 17], [32, 40, 15]]) {
        circle(g, x, y, r); fs(g, ball(g, x, y, r, A), D, 3);
      }
      g.fillStyle = light(A, 0.5);
      for (const [x, y] of [[26, 16], [16, 30], [40, 28]]) { ellipse(g, x, y, 3.5, 2); g.fill(); }
      break;
    case 'fabric':
      g.beginPath();
      g.moveTo(6, 8); g.quadraticCurveTo(32, 14, 58, 8); g.quadraticCurveTo(52, 32, 58, 56);
      g.quadraticCurveTo(32, 50, 6, 56); g.quadraticCurveTo(12, 32, 6, 8); g.closePath();
      fs(g, ball(g, 32, 32, 32, A), D, 3);
      g.setLineDash([4, 4]); g.strokeStyle = light(A, 0.4); g.lineWidth = 2;
      g.beginPath(); g.moveTo(14, 16); g.quadraticCurveTo(32, 20, 50, 16); g.stroke();
      g.setLineDash([]);
      circle(g, 32, 32, 4); fs(g, B, D, 2);
      break;
  }
}

function fireTongue(g: G, x: number, base: number, h: number, w: number): void {
  g.beginPath();
  g.moveTo(x - w, base);
  g.quadraticCurveTo(x - w, base - h * 0.6, x, base - h);
  g.quadraticCurveTo(x + w, base - h * 0.6, x + w, base);
  g.closePath();
}

function paintBurning(g: G, t: Theme, stage: number, k: number): void {
  paintFloor(g, t, false, stage);
  if (k < 2) {
    g.save();
    if (k === 1) { g.translate(32, 40); g.scale(0.82, 0.78); g.translate(-32, -40); }
    paintSoftShape(g, t, stage);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = k === 0 ? 'rgba(255,120,30,0.35)' : 'rgba(40,20,10,0.55)';
    g.fillRect(0, 0, C, C);
    g.restore();
  }
  const hs = k === 0 ? [26, 34, 24] : k === 1 ? [40, 50, 36] : [14, 18, 12];
  [[18, 7], [32, 9], [46, 7]].forEach(([x, w], i) => {
    fireTongue(g, x, 58, hs[i], w); fs(g, '#ff5a1f', '#8a1c0c', 2);
    fireTongue(g, x, 58, hs[i] * 0.6, w * 0.55); fs(g, '#ffd23f', '', 0);
  });
  if (k === 2) {
    g.fillStyle = 'rgba(70,64,72,0.55)';
    for (const [x, y, r] of [[24, 22, 9], [36, 16, 11], [44, 26, 8]]) { circle(g, x, y, r); g.fill(); }
  }
}

function paintPressure(g: G, t: Theme): void {
  paintFloor(g, t, false, 1);
  block(g, '#8f97a3', '#c9d0da', '#4e5561', 'flat');
  g.save();
  rr(g, 8, 18, C - 16, 14, 3);
  g.clip();
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, C, C);
  g.fillStyle = INK;
  for (let x = -16; x < C; x += 12) {
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 6, 32); g.lineTo(x + 20, 18); g.lineTo(x + 14, 18); g.closePath(); g.fill();
  }
  g.restore();
  rr(g, 8, 18, C - 16, 14, 3);
  g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
}

function stageAnims(stage: number): AnimSpec[] {
  const t = THEMES[stage - 1];
  const tile = (paint: Painter): FrameSpec => ({ w: C, h: C, anchor: [C / 2, C / 2], paint });
  const still = (k: HdTile, paint: Painter): AnimSpec => ({ key: stageKey(stage, k), frames: [tile(paint)], ticks: PH_TICKS.still, loop: true });
  return [
    still('floor', g => paintFloor(g, t, false, stage)),
    still('floorAlt', g => paintFloor(g, t, true, stage)),
    still('hard', g => { paintFloor(g, t, false, stage); paintHard(g, t); }),
    still('wall', g => { paintFloor(g, t, false, stage); paintWall(g, t); }),
    still('soft', g => { paintFloor(g, t, false, stage); paintSoftShape(g, t, stage); }),
    { key: stageKey(stage, 'burning'), frames: [0, 1, 2].map(k => tile(g => paintBurning(g, t, stage, k))), ticks: PH_TICKS.burning, loop: false },
    still('pressure', g => paintPressure(g, t)),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Bombas e chamas
// ---------------------------------------------------------------------------------------------------------------
const BOMB_COLORS = ['#2b3350', '#2f6fd0', '#c23a8a'];
const BOMB_ANCHOR: readonly [number, number] = [32, 36];

function paintBomb(g: G, type: number, frame: number): void {
  const k = [1, 1.06, 1, 0.94][frame];
  const cx = BOMB_ANCHOR[0], cy = BOMB_ANCHOR[1], r = 20 * k;
  shadow(g, cx, 57, 18 * k, 5);
  const col = BOMB_COLORS[type];
  if (type === 2) {
    g.fillStyle = '#f2c230';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.3) * r * 0.9, cy + Math.sin(a - 0.3) * r * 0.9);
      g.lineTo(cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
      g.lineTo(cx + Math.cos(a + 0.3) * r * 0.9, cy + Math.sin(a + 0.3) * r * 0.9);
      g.closePath();
      fs(g, '#f2c230', INK, 2.5);
    }
  }
  circle(g, cx, cy, r);
  fs(g, ball(g, cx, cy, r, col));
  rr(g, cx - 6, cy - r - 6, 12, 9, 3);
  fs(g, vgrad(g, cy - r - 6, cy - r + 3, ['#c9ced8', '#6d7380']), INK, 2.5);
  const top = cy - r - 6;
  if (type === 1) {
    g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, top); g.lineTo(cx + 6, top - 10); g.stroke();
    circle(g, cx + 6, top - 12, 4.5);
    fs(g, frame % 2 ? '#7a1d1d' : '#ff4040', INK, 2);
    rr(g, cx - 9, cy - 3, 18, 8, 4);
    fs(g, 'rgba(255,255,255,0.85)', INK, 2);
  } else {
    g.strokeStyle = '#7a5230'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(cx + 2, top - 8, cx + 9, top - 10); g.stroke();
    const s = frame % 2 ? 7 : 5;
    star(g, cx + 10, top - 11, s, frame * 0.4);
    fs(g, '#ffe066', '#ff6a1f', 2);
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(g, cx - r * 0.38, cy - r * 0.42, r * 0.28, r * 0.17); g.fill();
}

const FLAME_K = [0.85, 1, 0.7, 0.4];
function flameBand(g: G, part: HdFlamePart, w: number): void {
  // Desenha o caminho da peça para meia-largura w (a chama sai do centro da casa / atravessa a casa toda).
  const m = C / 2;
  g.beginPath();
  switch (part) {
    case 'h': g.rect(0, m - w, C, 2 * w); break;
    case 'v': g.rect(m - w, 0, 2 * w, C); break;
    case 'center':
      g.arc(m, m, w * 1.25, 0, Math.PI * 2);
      g.rect(0, m - w, C, 2 * w); g.rect(m - w, 0, 2 * w, C);
      break;
    default: {
      // ponta: sai da borda voltada para o centro da explosão e termina arredondada
      const end = C * 0.78;
      g.save();
      g.translate(m, m);
      g.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[part]);
      g.translate(-m, -m);
      g.moveTo(0, m - w);
      g.lineTo(end - w, m - w);
      g.arc(end - w, m, w, -Math.PI / 2, Math.PI / 2);
      g.lineTo(0, m + w);
      g.closePath();
      g.restore();
    }
  }
}
function paintFlame(g: G, part: HdFlamePart, frame: number): void {
  const k = FLAME_K[frame];
  const layers: [number, string][] = [[26, '#e8341c'], [20, '#ff8a1f'], [13, '#ffd23f'], [6, '#fff6d0']];
  layers.forEach(([w, c], i) => {
    flameBand(g, part, w * k);
    g.fillStyle = c;
    if (i === 0) { g.save(); g.shadowColor = 'rgba(255,90,20,0.6)'; g.shadowBlur = 6; g.fill(); g.restore(); } else g.fill();
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Itens e ovos
// ---------------------------------------------------------------------------------------------------------------
function glyphBomb(g: G, x: number, y: number, r: number, col: string): void {
  circle(g, x, y, r); fs(g, ball(g, x, y, r, col), INK, 2.5);
  g.strokeStyle = '#7a5230'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + r * 0.5, y - r * 0.8); g.lineTo(x + r * 0.9, y - r * 1.25); g.stroke();
  star(g, x + r * 0.95, y - r * 1.35, 4.5); fs(g, '#ffe066', '#ff6a1f', 1.5);
  g.fillStyle = 'rgba(255,255,255,0.6)'; ellipse(g, x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.15); g.fill();
}
function glyphFlame(g: G, x: number, y: number, s: number): void {
  const tongue = (k: number, c: string, lw: number) => {
    g.beginPath();
    g.moveTo(x, y - 18 * s * k);
    g.bezierCurveTo(x + 14 * s * k, y - 4 * s * k, x + 12 * s * k, y + 12 * s * k, x, y + 13 * s * k);
    g.bezierCurveTo(x - 12 * s * k, y + 12 * s * k, x - 14 * s * k, y - 2 * s * k, x - 3 * s * k, y - 8 * s * k);
    g.quadraticCurveTo(x - 2 * s * k, y - 14 * s * k, x, y - 18 * s * k);
    g.closePath();
    fs(g, c, INK, lw);
  };
  tongue(1, '#ff5a1f', 2.5); tongue(0.62, '#ffd23f', 0); tongue(0.3, '#fff6d0', 0);
}
function glyphHeart(g: G, x: number, y: number, s: number, col: string): void {
  g.beginPath();
  g.moveTo(x, y + 14 * s);
  g.bezierCurveTo(x - 22 * s, y - 2 * s, x - 12 * s, y - 20 * s, x, y - 8 * s);
  g.bezierCurveTo(x + 12 * s, y - 20 * s, x + 22 * s, y - 2 * s, x, y + 14 * s);
  g.closePath();
  fs(g, ball(g, x, y, 16 * s, col), INK, 2.5);
}
function glyphBoot(g: G, x: number, y: number, col: string): void {
  g.beginPath();
  g.moveTo(x - 10, y - 14); g.lineTo(x + 2, y - 14); g.lineTo(x + 2, y - 2);
  g.quadraticCurveTo(x + 16, y - 2, x + 16, y + 8); g.lineTo(x - 10, y + 8); g.closePath();
  fs(g, vgrad(g, y - 14, y + 8, [light(col, 0.3), col]), INK, 2.5);
  rr(g, x - 11, y + 6, 28, 5, 2); fs(g, '#f4f4f4', INK, 2);
}
function glyphGlove(g: G, x: number, y: number, col: string): void {
  rr(g, x - 12, y - 10, 22, 22, 10); fs(g, ball(g, x, y, 14, col), INK, 2.5);
  ellipse(g, x + 12, y + 2, 5, 7); fs(g, ball(g, x + 12, y + 2, 6, col), INK, 2.5);
  rr(g, x - 10, y + 10, 18, 7, 3); fs(g, light(col, 0.4), INK, 2);
}
function speedLines(g: G, x: number, y: number): void {
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  for (const [dy, l] of [[-8, 10], [0, 14], [8, 10]]) { g.moveTo(x, y + dy); g.lineTo(x - l, y + dy); }
  g.stroke();
}
function arrowThrough(g: G, y: number): void {
  g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.setLineDash([5, 4]); g.lineCap = 'round';
  g.beginPath(); g.moveTo(10, y); g.lineTo(50, y); g.stroke();
  g.setLineDash([]);
  g.beginPath(); g.moveTo(44, y - 6); g.lineTo(52, y); g.lineTo(44, y + 6); g.stroke();
}
function label(g: G, text: string, x: number, y: number, size: number): void {
  g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = INK; g.lineJoin = 'round';
  g.strokeText(text, x, y);
  g.fillStyle = '#ffffff'; g.fillText(text, x, y);
}

function paintEggShape(g: G, x: number, y: number, s: number, spot: string): void {
  shadow(g, x, y + 22 * s, 16 * s, 5 * s);
  g.beginPath();
  g.moveTo(x, y - 22 * s);
  g.bezierCurveTo(x + 15 * s, y - 22 * s, x + 19 * s, y + 4 * s, x + 17 * s, y + 10 * s);
  g.bezierCurveTo(x + 13 * s, y + 24 * s, x - 13 * s, y + 24 * s, x - 17 * s, y + 10 * s);
  g.bezierCurveTo(x - 19 * s, y + 4 * s, x - 15 * s, y - 22 * s, x, y - 22 * s);
  g.closePath();
  fs(g, ball(g, x, y, 22 * s, '#f6eed8'), INK, 3);
  g.save(); g.clip();
  g.fillStyle = spot;
  for (const [dx, dy, r] of [[-8, -6, 5], [7, 2, 6], [-4, 13, 4.5], [9, -14, 3.5]]) { circle(g, x + dx * s, y + dy * s, r * s); g.fill(); }
  g.restore();
}

/** Cor das pintas do ovo por tipo de montaria (matiz espalhado). */
export const eggSpot = (type: number): string => `hsl(${(type * 67) % 360}, 70%, 50%)`;

function paintItem(g: G, id: number): void {
  if (id === ITEM.EGG) { paintEggShape(g, 32, 30, 1, '#7a8a9a'); return; }
  const panel = id === ITEM.SKULL ? '#6a3a8f' : id === ITEM.FULL_FIRE ? '#d8344a' : id === ITEM.STAR || id === ITEM.P ? '#e8a020' : '#3d6fd6';
  shadow(g, 32, 58, 24, 4, 0.25);
  rr(g, 5, 5, 54, 52, 12);
  fs(g, vgrad(g, 5, 57, [light(panel, 0.35), panel, dark(panel, 0.25)]), INK, 3);
  rr(g, 9, 8, 46, 14, 7);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fill();
  const x = 32, y = 33;
  switch (id) {
    case ITEM.BOMB: glyphBomb(g, x, y + 2, 13, '#2b3350'); break;
    case ITEM.PIERCE: glyphBomb(g, x, y + 2, 13, BOMB_COLORS[2]); label(g, '»', x, y + 3, 16); break;
    case ITEM.FIRE: glyphFlame(g, x, y + 1, 1); break;
    case ITEM.FULL_FIRE: glyphFlame(g, x, y - 3, 0.85); label(g, 'MAX', x, y + 15, 13); break;
    case ITEM.SPEED: glyphBoot(g, x + 4, y, '#ff8a1f'); speedLines(g, x - 10, y - 2); break;
    case ITEM.REMOTE:
      rr(g, x - 10, y - 10, 20, 26, 5); fs(g, vgrad(g, y - 10, y + 16, ['#eef1f6', '#a8b0bf']), INK, 2.5);
      circle(g, x, y + 1, 5); fs(g, '#e8403a', INK, 2);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 6, y - 10); g.lineTo(x + 10, y - 20); g.stroke();
      circle(g, x + 10, y - 21, 3); fs(g, '#ffd23f', INK, 1.5);
      break;
    case ITEM.GLOVE: glyphGlove(g, x - 2, y, '#f4f4f4'); break;
    case ITEM.VEST:
      g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 15, y - 10); g.quadraticCurveTo(x + 14, y + 10, x, y + 18);
      g.quadraticCurveTo(x - 14, y + 10, x - 15, y - 10); g.closePath();
      fs(g, ball(g, x, y, 18, '#39d98a'), INK, 2.5);
      star(g, x, y, 6); fs(g, '#ffffff', INK, 1.5);
      break;
    case ITEM.HEART: glyphHeart(g, x, y + 1, 1, '#ff4d6d'); break;
    case ITEM.PASS_SOFT:
      rr(g, x - 13, y - 13, 26, 26, 3); fs(g, '#c4703f', INK, 2.5);
      g.strokeStyle = '#7a3322'; g.lineWidth = 2; g.beginPath();
      g.moveTo(x - 13, y); g.lineTo(x + 13, y); g.moveTo(x, y - 13); g.lineTo(x, y); g.moveTo(x - 6, y); g.lineTo(x - 6, y + 13); g.stroke();
      arrowThrough(g, y);
      break;
    case ITEM.PASS_BOMB: glyphBomb(g, x, y + 2, 12, '#2b3350'); arrowThrough(g, y + 2); break;
    case ITEM.CLOCK:
      circle(g, x, y, 15); fs(g, ball(g, x, y, 15, '#f6eed8'), INK, 2.5);
      g.strokeStyle = INK; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 10); g.moveTo(x, y); g.lineTo(x + 7, y + 3); g.stroke();
      break;
    case ITEM.PUNCH: glyphGlove(g, x + 4, y, '#e8403a'); speedLines(g, x - 10, y); break;
    case ITEM.KICK: glyphBoot(g, x + 2, y, '#3a8fe8'); break;
    case ITEM.COSTUME:
      g.beginPath(); g.moveTo(x - 8, y - 14); g.lineTo(x - 18, y - 8); g.lineTo(x - 14, y); g.lineTo(x - 10, y - 2);
      g.lineTo(x - 10, y + 16); g.lineTo(x + 10, y + 16); g.lineTo(x + 10, y - 2); g.lineTo(x + 14, y); g.lineTo(x + 18, y - 8);
      g.lineTo(x + 8, y - 14); g.quadraticCurveTo(x, y - 8, x - 8, y - 14); g.closePath();
      fs(g, vgrad(g, y - 14, y + 16, ['#ffd23f', '#e89a1c']), INK, 2.5);
      break;
    case ITEM.STAR: star(g, x, y + 1, 17); fs(g, ball(g, x, y, 17, '#ffe066'), INK, 2.5); break;
    case ITEM.P: circle(g, x, y, 15); fs(g, ball(g, x, y, 15, '#ffffff'), INK, 2.5); g.fillStyle = INK; g.font = '900 20px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', x + 0.5, y + 1); break;
    case ITEM.SKULL:
      g.beginPath(); g.arc(x, y - 3, 14, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(x + 8, y + 15); g.lineTo(x - 8, y + 15); g.closePath();
      fs(g, ball(g, x, y, 16, '#f2efe6'), INK, 2.5);
      g.fillStyle = INK;
      ellipse(g, x - 6, y - 2, 4, 5); g.fill(); ellipse(g, x + 6, y - 2, 4, 5); g.fill();
      g.fillRect(x - 5, y + 9, 2, 5); g.fillRect(x - 1, y + 9, 2, 5); g.fillRect(x + 3, y + 9, 2, 5);
      break;
  }
}

function objectAnims(): AnimSpec[] {
  const box = (paint: Painter, anchor: readonly [number, number] = [C / 2, C / 2]): FrameSpec => ({ w: C, h: C, anchor, paint });
  const out: AnimSpec[] = [];
  for (const type of [0, 1, 2]) {
    out.push({ key: `bomb/${type}`, frames: [0, 1, 2, 3].map(f => box(g => paintBomb(g, type, f), BOMB_ANCHOR)), ticks: PH_TICKS.bomb, loop: true });
  }
  for (const part of PH_FLAMES) {
    out.push({ key: `flame/${part}`, frames: FLAME_K.map((_, f) => box(g => paintFlame(g, part, f))), ticks: PH_TICKS.flame, loop: false });
  }
  for (const id of PH_ITEMS) out.push({ key: itemKey(id), frames: [box(g => paintItem(g, id))], ticks: PH_TICKS.still, loop: true });
  for (const t of PH_EGG_TYPES) {
    out.push({ key: `egg/${t.toString(16)}`, frames: [box(g => paintEggShape(g, 32, 30, 1, eggSpot(t)))], ticks: PH_TICKS.still, loop: true });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Personagens: robôs de cabeça-monitor (quadro 96×128, ponto de apoio = centro da sombra sob os pés)
// ---------------------------------------------------------------------------------------------------------------
export const PH_CHAR_W = 96, PH_CHAR_H = 128;
const AX = 48, AY = 108, HY = AY - 60;
export const PH_CHAR_ANCHOR: readonly [number, number] = [AX, AY];

type Eyes = 'normal' | 'x' | 'happy' | 'swirl';
interface Pose {
  lift?: [number, number];   // pés levantados (px)
  stride?: number;           // passo de lado: −1..1
  bob?: number;              // corpo sobe (px, negativo = sobe)
  swing?: number;            // balanço das mãos (px)
  eyes?: Eyes;
  armsUp?: number;           // 0 = mãos do lado; 1/2 = braços para cima
  tilt?: number;             // inclinação da cabeça (rad)
  jump?: number;             // pulo inteiro (px)
}

/** Paleta própria dos robôs (uma por personagem do Crown Blast, na ordem de `art/bomber.ts`; mantém a cor principal
 *  de cada um, mas com mãos/pés e luzes próprias — nada de branco+azul+vermelho). */
export interface RobotColors { head: string; shade: string; body: string; limbs: string; accent: string }
export const PH_ROBOTS: readonly RobotColors[] = [
  { head: '#eef1f6', shade: '#a9b3c6', body: '#2a9d8f', limbs: '#3b4252', accent: '#5ef0ff' },   // blanco
  { head: '#9aa3ad', shade: '#5d6670', body: '#3a3f46', limbs: '#f2b632', accent: '#39d98a' },   // gear
  { head: '#ff9a2e', shade: '#c8641a', body: '#1f6f8a', limbs: '#fff1c9', accent: '#ffd23f' },   // tigra
  { head: '#dfe7ff', shade: '#8ea0d0', body: '#7a4fd0', limbs: '#ffd23f', accent: '#ff8ad8' },   // aero
  { head: '#46b35a', shade: '#2a7a3a', body: '#1d3b2a', limbs: '#e9e3c8', accent: '#c8ff5a' },   // verdi
  { head: '#d8344a', shade: '#8f1f33', body: '#4a2a6f', limbs: '#1b1b22', accent: '#ffb13b' },   // rubi
];
type RC = RobotColors;

function eyesAt(g: G, c: RC, xs: readonly number[], y: number, kind: Eyes): void {
  g.save();
  g.fillStyle = c.accent; g.strokeStyle = c.accent; g.lineCap = 'round'; g.lineWidth = 3;
  g.shadowColor = c.accent; g.shadowBlur = 6;
  for (const x of xs) {
    if (kind === 'normal') { rr(g, x - 3.5, y - 6, 7, 12, 3.5); g.fill(); }
    else if (kind === 'x') { g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke(); }
    else if (kind === 'happy') { g.beginPath(); g.arc(x, y + 2, 4.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 1.6); g.stroke(); circle(g, x, y, 1.2); g.fill(); }
  }
  g.restore();
}

function hand(g: G, c: RC, x: number, y: number): void {
  circle(g, x, y, 7.5); fs(g, ball(g, x, y, 7.5, c.limbs));
}
function foot(g: G, c: RC, x: number, y: number, rx = 10.5): void {
  ellipse(g, x, y, rx, 7); fs(g, vgrad(g, y - 7, y + 7, [light(c.limbs, 0.25), c.limbs, dark(c.limbs, 0.3)]));
}
/** Cabeça "monitor": quadrado bem arredondado, mais largo que alto. */
const headPath = (g: G, x: number): void => rr(g, x - 28, HY - 23, 56, 46, 17);
function headBase(g: G, c: RC, x: number): void {
  headPath(g, x);
  const gr = g.createLinearGradient(x - 28, HY - 23, x + 20, HY + 23);
  gr.addColorStop(0, light(c.head, 0.5)); gr.addColorStop(0.45, c.head); gr.addColorStop(1, c.shade);
  fs(g, gr);
}
/** Faixa de capacete de corrida (cor de destaque), recortada pela cabeça; `side` = vista de lado. */
function stripe(g: G, c: RC, x: number, mode: 'front' | 'back' | 'side'): void {
  g.save();
  headPath(g, x); g.clip();
  g.fillStyle = c.accent;
  if (mode === 'side') g.fillRect(x - 30, HY - 24, 60, 7);
  else g.fillRect(x - 5, HY - 24, 10, mode === 'back' ? 48 : 12);
  g.restore();
  headPath(g, x); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
}
function bolt(g: G, c: RC, x: number, y: number): void {
  rr(g, x - 5, y - 8, 10, 16, 4); fs(g, vgrad(g, y - 8, y + 8, [light(c.shade, 0.3), c.shade, dark(c.shade, 0.3)]));
}
function screen(g: G, x: number, w: number): void {
  rr(g, x, HY - 12, w, 25, 10);
  fs(g, vgrad(g, HY - 12, HY + 13, ['#33405f', '#11141f']), INK, 2.5);
}
function bodyAt(g: G, c: RC, w: number): void {
  rr(g, AX - w / 2, AY - 37, w, 30, 12);
  fs(g, vgrad(g, AY - 37, AY - 7, [light(c.body, 0.3), c.body, dark(c.body, 0.3)]));
  g.save(); rr(g, AX - w / 2, AY - 37, w, 30, 12); g.clip();
  g.fillStyle = dark(c.body, 0.35); g.fillRect(AX - w / 2, AY - 20, w, 5);
  g.restore();
  rr(g, AX - w / 2, AY - 37, w, 30, 12); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
}

function robotFront(g: G, c: RC, p: Required<Pose>): void {
  foot(g, c, AX - 11, AY - 5 - p.lift[0]);
  foot(g, c, AX + 11, AY - 5 - p.lift[1]);
  g.save(); g.translate(0, p.bob);
  bodyAt(g, c, 36);
  rr(g, AX - 6, AY - 33, 12, 8, 3); fs(g, c.accent, INK, 2);
  g.save();
  g.translate(AX, HY); g.rotate(p.tilt); g.translate(-AX, -HY);
  bolt(g, c, AX - 29, HY + 2); bolt(g, c, AX + 29, HY + 2);
  headBase(g, c, AX);
  stripe(g, c, AX, 'front');
  screen(g, AX - 21, 42);
  eyesAt(g, c, [AX - 9, AX + 9], HY, p.eyes);
  rr(g, AX - 17, HY - 9, 10, 3, 1.5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  g.restore();
  if (p.armsUp) {
    const up = p.armsUp === 2 ? 10 : 0;
    hand(g, c, AX - 34, HY - 16 - up); hand(g, c, AX + 34, HY - 16 - up);
  } else {
    hand(g, c, AX - 23, AY - 24 + p.swing); hand(g, c, AX + 23, AY - 24 - p.swing);
  }
  g.restore();
}

function robotBack(g: G, c: RC, p: Required<Pose>): void {
  foot(g, c, AX - 11, AY - 5 - p.lift[0]);
  foot(g, c, AX + 11, AY - 5 - p.lift[1]);
  g.save(); g.translate(0, p.bob);
  hand(g, c, AX - 23, AY - 24 - p.swing); hand(g, c, AX + 23, AY - 24 + p.swing);
  bodyAt(g, c, 36);
  rr(g, AX - 10, AY - 35, 20, 15, 4); fs(g, vgrad(g, AY - 35, AY - 20, [c.shade, dark(c.shade, 0.3)]), INK, 2.5);
  g.save();
  g.translate(AX, HY); g.rotate(p.tilt); g.translate(-AX, -HY);
  bolt(g, c, AX - 29, HY + 2); bolt(g, c, AX + 29, HY + 2);
  headBase(g, c, AX);
  stripe(g, c, AX, 'back');
  g.strokeStyle = dark(c.shade, 0.2); g.lineWidth = 3.5; g.lineCap = 'round';
  g.beginPath();
  for (const dy of [2, 8, 14]) { g.moveTo(AX - 19, HY + dy); g.lineTo(AX - 10, HY + dy); g.moveTo(AX + 10, HY + dy); g.lineTo(AX + 19, HY + dy); }
  g.stroke();
  g.restore();
  g.restore();
}

function robotSide(g: G, c: RC, p: Required<Pose>): void {
  const s = p.stride;
  foot(g, c, AX - 7 * s - 1, AY - 5 - p.lift[1], 11);
  g.save(); g.translate(0, p.bob);
  hand(g, c, AX - 8 + p.swing, AY - 25);
  g.restore();
  foot(g, c, AX + 7 * s + 3, AY - 5 - p.lift[0], 11);
  g.save(); g.translate(0, p.bob);
  bodyAt(g, c, 30);
  g.save();
  const hx = AX + 2;
  g.translate(hx, HY); g.rotate(p.tilt); g.translate(-hx, -HY);
  headBase(g, c, hx);
  stripe(g, c, hx, 'side');
  g.save();
  headPath(g, hx); g.clip();
  screen(g, hx - 2, 36);
  eyesAt(g, c, [hx + 18], HY, p.eyes);
  rr(g, hx + 3, HY - 9, 9, 3, 1.5); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  g.restore();
  headPath(g, hx); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  // grade de ventilação na lateral (um parafuso aqui pareceria um segundo olho)
  g.strokeStyle = dark(c.shade, 0.25); g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  for (const dy of [-2, 4, 10]) { g.moveTo(hx - 22, HY + dy); g.lineTo(hx - 12, HY + dy); }
  g.stroke();
  g.restore();
  hand(g, c, AX + 6 - p.swing, AY - 23);
  g.restore();
}

function paintRobot(g: G, c: RC, dir: HdDir, pose: Pose): void {
  const p: Required<Pose> = { lift: [0, 0], stride: 0, bob: 0, swing: 0, eyes: 'normal', armsUp: 0, tilt: 0, jump: 0, ...pose };
  shadow(g, AX, AY, 22 - p.jump * 0.5, 7 - p.jump * 0.15);
  g.save();
  g.translate(0, -p.jump);
  if (dir === 'down') robotFront(g, c, p);
  else if (dir === 'up') robotBack(g, c, p);
  else {
    if (dir === 'left') { g.translate(PH_CHAR_W, 0); g.scale(-1, 1); }
    robotSide(g, c, p);
  }
  g.restore();
}

function stunStars(g: G, frame: number): void {
  for (let i = 0; i < 3; i++) {
    const a = frame * (Math.PI / 3) + (i * Math.PI * 2) / 3;
    star(g, AX + Math.cos(a) * 24, HY - 34 + Math.sin(a) * 7, 6, a);
    fs(g, '#ffe066', INK, 2);
  }
}

function paintDying(g: G, c: RC, frame: number): void {
  if (frame < 3) {
    const sq = [0, 0.22, 0.5][frame];
    g.save();
    g.globalAlpha = frame === 2 ? 0.75 : 1;
    g.translate(AX, AY); g.scale(1 + sq * 0.5, 1 - sq); g.translate(-AX, -AY);
    paintRobot(g, c, 'down', { eyes: 'x', tilt: frame === 1 ? 0.12 : 0 });
    if (frame === 0) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 0, PH_CHAR_W, PH_CHAR_H);
    }
    g.restore();
  }
  if (frame === 1) {
    g.strokeStyle = '#ffe066'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath();
    for (const [x, y, dx, dy] of [[14, 50, -8, -6], [82, 50, 8, -6], [20, 82, -9, 3], [76, 82, 9, 3]]) { g.moveTo(x, y); g.lineTo(x + dx, y + dy); }
    g.stroke();
  }
  if (frame >= 2) {
    const a = frame === 2 ? 0.55 : 0.8;
    const puffs = frame === 2 ? [[26, 70, 12], [70, 72, 11], [48, 52, 13]] : [[30, 86, 14], [66, 86, 14], [48, 74, 17], [38, 62, 11], [60, 60, 10]];
    for (const [x, y, r] of puffs) { circle(g, x, y, r); g.fillStyle = `rgba(120,116,128,${a})`; g.fill(); }
    if (frame === 3) {
      for (const [x, y] of [[34, 104], [58, 106]]) bolt(g, c, x, y);
      shadow(g, AX, AY, 20, 5, 0.18);
    }
  }
}

function charAnims(ch: number): AnimSpec[] {
  const c = PH_ROBOTS[ch];
  const box = (paint: Painter): FrameSpec => ({ w: PH_CHAR_W, h: PH_CHAR_H, anchor: PH_CHAR_ANCHOR, paint });
  const out: AnimSpec[] = [];
  const walkPoses = (dir: HdDir): Pose[] => {
    const side = dir === 'left' || dir === 'right';
    return [
      {},
      side ? { stride: 1, lift: [5, 0], bob: -2, swing: 5 } : { lift: [6, 0], bob: -2, swing: 4 },
      {},
      side ? { stride: -1, lift: [0, 5], bob: -2, swing: -5 } : { lift: [0, 6], bob: -2, swing: -4 },
    ];
  };
  for (const dir of HD_DIRS) {
    out.push({ key: charKey(ch, 'idle', dir), frames: [box(g => paintRobot(g, c, dir, {}))], ticks: PH_TICKS.still, loop: true });
    out.push({ key: charKey(ch, 'walk', dir), frames: walkPoses(dir).map(p => box(g => paintRobot(g, c, dir, p))), ticks: PH_TICKS.walk, loop: true });
    out.push({
      key: charKey(ch, 'stunned', dir),
      frames: [0, 1].map(f => box(g => { paintRobot(g, c, dir, { eyes: 'swirl', tilt: f ? -0.14 : 0.14 }); stunStars(g, f); })),
      ticks: PH_TICKS.stunned, loop: true,
    });
  }
  out.push({ key: charKey(ch, 'dying'), frames: [0, 1, 2, 3].map(f => box(g => paintDying(g, c, f))), ticks: PH_TICKS.dying, loop: false });
  out.push({
    key: charKey(ch, 'victory'),
    frames: [box(g => paintRobot(g, c, 'down', { eyes: 'happy', armsUp: 1 })), box(g => paintRobot(g, c, 'down', { eyes: 'happy', armsUp: 2, jump: 10 }))],
    ticks: PH_TICKS.victory, loop: true,
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Montagem das folhas e do manifesto
// ---------------------------------------------------------------------------------------------------------------
const GAP = 2;

/** Empacota em prateleiras: quadros da esquerda para a direita, linha nova quando passa de `maxW`. */
function place(name: string, anims: readonly AnimSpec[], maxW: number): { sheet: PlacedSheet; anims: Record<string, HdAnim> } {
  const slots: { x: number; y: number; f: FrameSpec }[] = [];
  const out: Record<string, HdAnim> = {};
  let x = 0, y = 0, rowH = 0, w = 0;
  for (const a of anims) {
    const frames = a.frames.map(f => {
      if (x > 0 && x + f.w > maxW) { y += rowH + GAP; x = 0; rowH = 0; }
      slots.push({ x, y, f });
      const fr = { img: name, rect: [x, y, f.w, f.h] as const, anchor: [f.anchor[0], f.anchor[1]] as const };
      x += f.w + GAP; rowH = Math.max(rowH, f.h); w = Math.max(w, x - GAP);
      return fr;
    });
    out[a.key] = { frames, ticks: [...a.ticks], loop: a.loop };
  }
  return { sheet: { name, file: `${name}.png`, w, h: y + rowH, slots }, anims: out };
}

let cached: PlaceholderBuild | null = null;

/** Layout completo (folhas + manifesto). Não desenha nada: serve em Node, nos testes e no navegador. */
export function buildPlaceholder(): PlaceholderBuild {
  if (cached) return cached;
  const parts = [
    place('arenas', Array.from({ length: 10 }, (_, i) => stageAnims(i + 1)).flat(), 9 * (C + GAP)),
    place('objetos', objectAnims(), 16 * (C + GAP)),
    ...Array.from({ length: PH_CHAR_COUNT }, (_, ch) => place(`personagem-${ch}`, charAnims(ch), 8 * (PH_CHAR_W + GAP))),
  ];
  const manifest: HdManifest = {
    format: 1,
    name: 'Provisório (gerado por código)',
    credits: 'Crown Blast — arte provisória gerada por código',
    license: 'a do projeto',
    cell: C,
    images: Object.fromEntries(parts.map(p => [p.sheet.name, p.sheet.file])),
    anims: Object.assign({}, ...parts.map(p => p.anims)),
  };
  cached = { manifest, sheets: parts.map(p => p.sheet) };
  return cached;
}

/** Desenha uma folha inteira em `g` (canvas do tamanho `sheet.w × sheet.h`, transparente). */
export function paintSheet(sheet: PlacedSheet, g: G): void {
  for (const s of sheet.slots) {
    g.save();
    g.beginPath();
    g.rect(s.x, s.y, s.f.w, s.f.h);
    g.clip();
    g.translate(s.x, s.y);
    s.f.paint(g);
    g.restore();
  }
}

/** O pacote provisório montado em memória (OffscreenCanvas), sem baixar imagens. */
export function createPlaceholderPack(): HdPack {
  const { manifest, sheets } = buildPlaceholder();
  const images = new Map<string, CanvasImageSource>();
  for (const s of sheets) {
    const cv = new OffscreenCanvas(s.w, s.h);
    const g = cv.getContext('2d');
    if (!g) throw new Error('OffscreenCanvas 2D indisponível');
    paintSheet(s, g);
    images.set(s.name, cv);
  }
  return { manifest, images, anim: key => manifest.anims[key] ?? null };
}
