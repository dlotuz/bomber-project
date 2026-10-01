/** Raio (px de base) em volta do centro da bomba em que o corpo é repintado. */
const R = 7;

/** Corpo da bomba: escuro mas não preto, sem dominância de vermelho (pavio) nem de verde puro (grama). Contorno preto e brilho ficam. */
export function isBombBody(r: number, g: number, b: number): boolean {
  const m = Math.max(r, g, b);
  return m >= 30 && m <= 150 && b >= 0.6 * g && r <= Math.min(g, b) + 12;
}

/**
 * Quadro 16×16 RGBA (origem em cx − 8, cy − 8) com o corpo da bomba na cor do dono, mantendo o sombreado; transparente
 * fora do corpo. `ground` = máscara de chão (alfa 0 onde há ator), para nunca pintar o piso da arena.
 */
export function tintBomb(base: Uint8ClampedArray, ground: Uint8ClampedArray, w: number, cx: number, cy: number, color: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(16 * 16 * 4);
  const h = base.length / 4 / w, cr = (color >> 16) & 255, cg = (color >> 8) & 255, cb = color & 255;
  for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
    const x = cx - 8 + dx, y = cy - 8 + dy;
    if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
    const i = (y * w + x) * 4;
    if (ground[i + 3] !== 0 || !isBombBody(base[i], base[i + 1], base[i + 2])) continue;
    const f = 0.35 + 0.85 * (Math.max(base[i], base[i + 1], base[i + 2]) / 150);
    const o = (dy * 16 + dx) * 4;
    out[o] = cr * f; out[o + 1] = cg * f; out[o + 2] = cb * f; out[o + 3] = 255;
  }
  return out;
}
