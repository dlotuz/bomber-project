import { makePix, setPx, type Pix } from '../../art/pix';

type Shape = 'fish' | 'dino' | 'round' | 'bell' | 'leaf' | 'tank' | 'clown';
export const MOUNT_LOOK: Readonly<Record<number, { body: string; dark: string; accent: string; shape: Shape }>> = {
  0x2: { body: '#3fae4a', dark: '#1f5f2a', accent: '#ff7fb0', shape: 'fish' },   // peixe verde, barbatanas rosa
  0x3: { body: '#8fd13f', dark: '#4c7f1a', accent: '#ff6fa0', shape: 'dino' },   // triceratops verde, crista rosa
  0xa: { body: '#ffc23f', dark: '#b8680f', accent: '#3f5fff', shape: 'round' },  // redondo amarelo, óculos
  0xc: { body: '#e8b830', dark: '#7f5a10', accent: '#d8312b', shape: 'bell' },   // sino dourado, saia vermelha
  0xd: { body: '#5fa83f', dark: '#2a5a1a', accent: '#ffffff', shape: 'leaf' },   // alcachofra verde com olhos
  0xe: { body: '#3f6fd8', dark: '#1a2a70', accent: '#c8c8c8', shape: 'tank' },   // robô-tanque azul
  0xf: { body: '#ffe04f', dark: '#a8861a', accent: '#2f4fcf', shape: 'clown' },  // bola de palhaço, chapéu azul
};

function ellipse(p: Pix, cx: number, cy: number, rx: number, ry: number, fill: string, edge: string): void {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d <= 1) setPx(p, x, y, d > 0.72 ? edge : fill);
  }
}
function rect(p: Pix, x: number, y: number, w: number, h: number, c: string): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(p, xx, yy, c);
}

/** 24×20. face 0 ↑ 2 → 4 ↓ 6 ←; step 0/1 = balanço de andar. */
export function mountPix(type: number, face: 0 | 2 | 4 | 6, step: number): Pix {
  const L = MOUNT_LOOK[type];
  const p = makePix(24, 20);
  const bob = step ? 1 : 0;
  const ex = face === 2 ? 3 : face === 6 ? -3 : 0;            // olhos seguem a direção
  switch (L.shape) {
    case 'tank':
      rect(p, 3, 15 - bob, 18, 5, L.dark);                     // esteiras
      rect(p, 5, 6 - bob, 14, 10, L.body);
      rect(p, 12 + ex, 8 - bob, 10, 3, L.accent);              // canhão
      break;
    case 'bell':
      ellipse(p, 12, 10 - bob, 8, 8, L.body, L.dark);
      rect(p, 3, 15 - bob, 18, 4, L.accent);                   // saia
      break;
    default:
      ellipse(p, 12, 12 - bob, 10, 8, L.body, L.dark);
  }
  if (L.shape === 'fish') { rect(p, 0, 10 - bob, 3, 4, L.accent); rect(p, 21, 10 - bob, 3, 4, L.accent); }
  if (L.shape === 'dino') for (let i = 0; i < 4; i++) rect(p, 6 + 4 * i, 3 - bob, 2, 3, L.accent);
  if (L.shape === 'round') { ellipse(p, 9 + ex, 10 - bob, 3, 3, L.accent, L.dark); ellipse(p, 15 + ex, 10 - bob, 3, 3, L.accent, L.dark); }
  if (L.shape === 'leaf') for (let i = 0; i < 3; i++) rect(p, 5 + 5 * i, 7 + (i & 1) - bob, 4, 1, L.dark);
  if (L.shape === 'clown') { rect(p, 8, 1 - bob, 8, 3, L.accent); rect(p, 11, 0, 2, 1, L.accent); }
  if (face !== 0) {                                            // olhos (de costas não aparecem)
    const eye = L.shape === 'leaf' ? L.accent : '#ffffff';
    rect(p, 9 + ex, 11 - bob, 2, 2, eye); rect(p, 13 + ex, 11 - bob, 2, 2, eye);
    setPx(p, 10 + ex, 12 - bob, '#000000'); setPx(p, 14 + ex, 12 - bob, '#000000');
  }
  return p;
}

/** 16×16. kind 0 = ids < $38 ($D8:D271, pintas verdes); 1 = ids ≥ $38 ($D8:D2CC, pintas laranja). */
export function eggPix(kind: 0 | 1, frame: number): Pix {
  const p = makePix(16, 16);
  const tilt = frame & 1;
  ellipse(p, 8 + tilt * 0.5, 9, 6, 7, '#f8f8f0', '#9090a0');
  const spot = kind ? '#ff8f2f' : '#3fae4a';
  rect(p, 5, 6, 2, 2, spot); rect(p, 9, 9, 3, 2, spot); rect(p, 6, 12, 2, 1, spot);
  return p;
}

export function shotPix(kind: 0xd | 0xe | 0xf, state: 'fly' | 'cloud', frame: number): Pix {
  if (state === 'cloud') { const p = makePix(16, 12); ellipse(p, 5, 7, 5, 4, '#d8d8e0', '#9898a8'); ellipse(p, 11, 6, 5, 5, '#e8e8f0', '#9898a8'); return p; }
  if (kind === 0xe) { const p = makePix(8, 8); ellipse(p, 4, 4, 4, 4, '#7fb8ff', '#1a2a70'); return p; }
  if (kind === 0xf) {
    const p = makePix(8, 12);
    ellipse(p, 3, 9, 3, 2.5, '#202020', '#000000'); rect(p, 5, 1, 1, 8, '#202020'); rect(p, 5, 1, 3, 2 + (frame & 1), '#202020');
    return p;
  }
  return mountPix(0xd, 2, frame & 1);
}
