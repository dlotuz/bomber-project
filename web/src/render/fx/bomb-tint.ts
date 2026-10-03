/** Raio (px de base) em volta do centro da bomba em que o corpo é repintado (7,5: a bola do corpo tem raio ~7 em volta
 *  de um centro que cai entre pixels; só pixel de bomba à vista com cor de corpo é pintado). */
const R = 7.5;

/** Cor da bomba por jogador (as cores dos bombers no Battle): P1 branco, P2 preto (cinza-escuro, para o sombreado
 *  aparecer), P3 vermelho, P4 azul, P5 verde. */
export const BOMB_COLORS = [0xf0f0f0, 0x3a3a44, 0xe83030, 0x3070ff, 0x30c040];
export const bombColor = (owner: number): number => BOMB_COLORS[owner] ?? BOMB_COLORS[0];

/** Corpo da bomba: escuro mas não preto, sem dominância de vermelho (pavio) nem de verde puro (grama). Contorno preto e brilho ficam. */
export function isBombBody(r: number, g: number, b: number): boolean {
  const m = Math.max(r, g, b);
  return m >= 30 && m <= 150 && b >= 0.6 * g && r <= Math.min(g, b) + 12;
}

/** Repinta, em `d` (RGBA), o pixel `i` do corpo na cor `color`, mantendo o sombreado (brilho relativo do original). */
function paint(d: Uint8ClampedArray, i: number, src: Uint8ClampedArray, j: number, color: number): void {
  const f = 0.35 + 0.85 * (Math.max(src[j], src[j + 1], src[j + 2]) / 150);
  d[i] = ((color >> 16) & 255) * f; d[i + 1] = ((color >> 8) & 255) * f; d[i + 2] = (color & 255) * f; d[i + 3] = 255;
}

const same = (a: Uint8ClampedArray, b: Uint8ClampedArray, i: number): boolean =>
  a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3];

/**
 * Pixels da bomba que estão À VISTA no quadro (alfa 255; 0 no resto). `base` = quadro completo; `bombsOnly` = o mesmo
 * quadro só com as bombas (sem jogadores, montarias, trajes e camadas por cima); `noBombs` = sem bombas nem atores.
 * É bomba onde `bombsOnly` difere de `noBombs`; está à vista onde o quadro completo ainda mostra esse pixel — onde a
 * montaria, o cavaleiro ou uma moita passam por cima, o pixel muda e fica de fora (a cor nunca pinta quem está na frente).
 */
export function bombMask(base: Uint8ClampedArray, bombsOnly: Uint8ClampedArray, noBombs: Uint8ClampedArray, out: Uint8ClampedArray): void {
  for (let i = 0; i < out.length; i += 4) {
    out[i] = out[i + 1] = out[i + 2] = 0;
    out[i + 3] = !same(bombsOnly, noBombs, i) && same(base, bombsOnly, i) ? 255 : 0;
  }
}

/**
 * Quadro 16×16 RGBA (origem em cx − 8, cy − 8) com o corpo da bomba na cor do dono, mantendo o sombreado; transparente
 * fora do corpo. `visible` = máscara de `bombMask` (alfa 255 só nos pixels de bomba à vista).
 */
export function tintBomb(base: Uint8ClampedArray, visible: Uint8ClampedArray, w: number, cx: number, cy: number, color: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(16 * 16 * 4);
  const h = base.length / 4 / w;
  for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
    const x = cx - 8 + dx, y = cy - 8 + dy;
    if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
    const i = (y * w + x) * 4;
    if (visible[i + 3] !== 255 || !isBombBody(base[i], base[i + 1], base[i + 2])) continue;
    paint(out, (dy * 16 + dx) * 4, base, i, color);
  }
  return out;
}

/** Repinta em `base` (no lugar) o corpo à vista de cada bomba; devolve os retângulos 16×16 mexidos ([x, y]). */
export function tintBombsInPlace(base: Uint8ClampedArray, visible: Uint8ClampedArray, w: number,
  bombs: readonly (readonly [number, number, number])[]): [number, number][] {
  const tiles = bombs.map(([x, y, color]) => [x, y, tintBomb(base, visible, w, x, y, color)] as const);   // todas antes de mexer
  const h = base.length / 4 / w, rects: [number, number][] = [];
  for (const [cx, cy, t] of tiles) {
    for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
      const o = (dy * 16 + dx) * 4, x = cx - 8 + dx, y = cy - 8 + dy;
      if (t[o + 3] === 0 || x < 0 || y < 0 || x >= w || y >= h) continue;
      base.set(t.subarray(o, o + 4), (y * w + x) * 4);
    }
    rects.push([cx - 8, cy - 8]);
  }
  return rects;
}

/** Arte HD: repinta no lugar o corpo de um quadro de bomba (RGBA, opaco) na cor `color`; o resto fica como está. */
export function tintBodyPixels(d: Uint8ClampedArray, color: number): void {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128 || !isBombBody(d[i], d[i + 1], d[i + 2])) continue;
    const a = d[i + 3];
    paint(d, i, d, i, color);
    d[i + 3] = a;
  }
}
