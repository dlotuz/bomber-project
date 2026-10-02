// Filtro suave: amplia a pixel art por um fator inteiro `k` alisando as bordas diagonais, no espírito do xBR
// (detecção de borda por distância de cor ponderada numa vizinhança 5×5, com corte do canto do pixel por retas de
// 45°, 1:2 e 2:1), escrito do zero a partir da descrição pública do algoritmo. Diferença deliberada: só corta o canto
// quando a borda continua na diagonal (o pixel de cima à direita ou de baixo à esquerda tem a cor do pixel), então
// quinas de blocos sólidos (paredes, caixas, HUD) ficam retas em vez de arredondadas.
//
// Este arquivo é a referência na CPU (testes); `smooth-gl.ts` roda o mesmo cálculo num shader, pixel a pixel. As
// constantes abaixo vão para o shader, então os dois não se desencontram.

/** Pesos da distância de cor (luma, as duas diferenças de cor e alfa) e o limiar abaixo do qual duas cores são "iguais". */
export const W_Y = 48, W_U = 7, W_V = 6, W_A = 24, EQ_THR = 3;

/** Distância entre duas cores RGBA (0..1, alfa pré-multiplicado): diferença em YUV, com a luma pesando mais. */
export function colorDist(a: ArrayLike<number>, ai: number, b: ArrayLike<number>, bi: number): number {
  const dr = a[ai] - b[bi], dg = a[ai + 1] - b[bi + 1], db = a[ai + 2] - b[bi + 2], da = a[ai + 3] - b[bi + 3];
  const y = 0.299 * dr + 0.587 * dg + 0.114 * db;
  const u = -0.169 * dr - 0.331 * dg + 0.5 * db;
  const v = 0.5 * dr - 0.419 * dg - 0.081 * db;
  return W_Y * Math.abs(y) + W_U * Math.abs(u) + W_V * Math.abs(v) + W_A * Math.abs(da);
}

/** Quanto do canto passa para a outra cor: o lado positivo da reta p·u + q·v = c, com borda suave de 1 px de saída. */
const line = (p: number, q: number, c: number, u: number, v: number, k: number): number =>
  Math.min(1, Math.max(0, ((p * u + q * v - c) / Math.hypot(p, q)) * k + 0.5));

/** Os 4 cantos: direção horizontal e vertical de cada um (BR, TR, BL, TL — a ordem do shader). */
const CORNERS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Amplia `src` (RGBA 8 bits, `w × h`) por `k`. Para cada pixel de saída: acha o pixel de origem E e, em cada um dos 4
 * cantos de E (vizinhos F ao lado, H em cima/embaixo, I na diagonal…), decide se há uma borda cruzando o canto; se
 * houver, a parte do canto além da reta (45°, ou 1:2/2:1 nas rampas suaves) recebe a cor de F ou H, a mais parecida
 * com E. Sem borda, fica a cor de E — áreas lisas e bordas retas saem iguais à ampliação nítida.
 */
export function smoothScale(src: Uint8ClampedArray, w: number, h: number, k: number): Uint8ClampedArray {
  const px = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = src[i * 4 + 3] / 255;
    px[i * 4] = (src[i * 4] / 255) * a; px[i * 4 + 1] = (src[i * 4 + 1] / 255) * a;
    px[i * 4 + 2] = (src[i * 4 + 2] / 255) * a; px[i * 4 + 3] = a;
  }
  const at = (x: number, y: number): number => (Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4;
  const d = (a: number, b: number): number => colorDist(px, a, px, b);
  const eq = (a: number, b: number): boolean => d(a, b) < EQ_THR;
  const W = w * k, H = h * k, out = new Uint8ClampedArray(W * H * 4);
  for (let oy = 0; oy < H; oy++) for (let ox = 0; ox < W; ox++) {
    const fx = (ox + 0.5) / k, fy = (oy + 0.5) / k;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    const t = (dx: number, dy: number): number => at(cx + dx, cy + dy);
    const E = t(0, 0);
    let best = 0, P = E;
    for (const [sa, sb] of CORNERS) {
      const F = t(sa, 0), H_ = t(0, sb), I = t(sa, sb), B = t(0, -sb), D = t(-sa, 0), C = t(sa, -sb), G = t(-sa, sb);
      const F4 = t(2 * sa, 0), I4 = t(2 * sa, sb), H5 = t(0, 2 * sb), I5 = t(sa, 2 * sb);
      if (eq(E, F) || eq(E, H_) || !(eq(E, C) || eq(E, G))) continue;
      const wd1 = d(E, C) + d(E, G) + d(I, F4) + d(I, H5) + 4 * d(H_, F);
      const wd2 = d(H_, D) + d(H_, I5) + d(F, I4) + d(F, B) + 4 * d(E, I);
      if (!(wd1 < wd2)) continue;
      const u = (fx - cx - 0.5) * sa, v = (fy - cy - 0.5) * sb;
      let a = line(1, 1, 0.5, u, v, k);
      if (2 * d(F, G) <= d(H_, C) && !eq(E, G) && !eq(D, G)) a = Math.max(a, line(0.5, 1, 0.25, u, v, k));   // rampa deitada
      if (2 * d(H_, C) <= d(F, G) && !eq(E, C) && !eq(B, C)) a = Math.max(a, line(1, 0.5, 0.25, u, v, k));   // rampa em pé
      if (a > best) { best = a; P = d(E, F) <= d(E, H_) ? F : H_; }
    }
    const o = (oy * W + ox) * 4;
    const al = px[E + 3] + (px[P + 3] - px[E + 3]) * best;
    for (let c = 0; c < 3; c++) {
      const pm = px[E + c] + (px[P + c] - px[E + c]) * best;
      out[o + c] = Math.round(al > 0 ? (pm / al) * 255 : 0);
    }
    out[o + 3] = Math.round(al * 255);
  }
  return out;
}
