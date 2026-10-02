import { smoothScale } from '../../src/render/fx/smooth';

const BLACK = [0, 0, 0, 255], WHITE = [255, 255, 255, 255];

/** Imagem `w × h` em que `dark(x, y)` é preto e o resto branco. */
function img(w: number, h: number, dark: (x: number, y: number) => boolean): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.set(dark(x, y) ? BLACK : WHITE, (y * w + x) * 4);
  return a;
}
/** Ampliação nítida (vizinho mais próximo), a referência do "nada mudou". */
function nearest(src: Uint8ClampedArray, w: number, h: number, k: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * k * h * k * 4);
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
    const s = (Math.floor(y / k) * w + Math.floor(x / k)) * 4;
    out.set(src.subarray(s, s + 4), (y * w * k + x) * 4);
  }
  return out;
}
/** Quantos pixels escuros (luma < 128) há na linha `y` da saída. */
const darkInRow = (o: Uint8ClampedArray, W: number, y: number): number => {
  let n = 0;
  for (let x = 0; x < W; x++) if (o[(y * W + x) * 4] < 128) n++;
  return n;
};
const steps = (o: Uint8ClampedArray, W: number, rows: number[]): number[] => rows.slice(1).map((y, i) => darkInRow(o, W, rows[i]) - darkInRow(o, W, y));
const range = (a: number, b: number): number[] => Array.from({ length: b - a }, (_, i) => a + i);

describe('filtro suave (ampliação de pixel art com bordas lisas)', () => {
  const k = 4;
  it('quadrado sólido continua sólido: igual à ampliação nítida, quinas retas', () => {
    const src = img(10, 10, (x, y) => x >= 3 && x <= 6 && y >= 3 && y <= 6);
    expect(smoothScale(src, 10, 10, k)).toEqual(nearest(src, 10, 10, k));
  });
  it('área lisa e pixel isolado não mudam', () => {
    const flat = img(6, 6, () => false), dot = img(7, 7, (x, y) => x === 3 && y === 3);
    expect(smoothScale(flat, 6, 6, k)).toEqual(nearest(flat, 6, 6, k));
    expect(smoothScale(dot, 7, 7, k)).toEqual(nearest(dot, 7, 7, k));
  });
  it('bordas retas (horizontal e vertical) não mudam', () => {
    const src = img(8, 8, (x, y) => x < 4 || y < 2);
    expect(smoothScale(src, 8, 8, k)).toEqual(nearest(src, 8, 8, k));
  });
  it('diagonal em escada vira borda lisa a 45°: a fronteira anda ~1 px de saída por linha, não 4 de uma vez', () => {
    const w = 12, src = img(w, w, (x, y) => x + y <= 11), W = w * k;
    const sharp = nearest(src, w, w, k), soft = smoothScale(src, w, w, k);
    const rows = range(3 * k, 9 * k);   // longe das beiradas da imagem
    expect(Math.max(...steps(sharp, W, rows))).toBe(k);            // a escada da ampliação nítida
    const s = steps(soft, W, rows);
    expect(Math.max(...s)).toBeLessThanOrEqual(2);
    expect(Math.min(...s)).toBeGreaterThanOrEqual(0);
    expect(s.reduce((a, b) => a + b, 0)).toBe(rows.length - 1);     // mesma inclinação média: 1 px por linha
    expect(soft.some((v, i) => i % 4 === 0 && v > 0 && v < 255)).toBe(true);   // borda com meio-tom (antisserrilhado)
  });
  it('rampa 2:1 também fica lisa (passos menores que a escada de 2 pixels)', () => {
    const w = 16, h = 10, src = img(w, h, (x, y) => x + 2 * y <= 15), W = w * k;
    const sharp = nearest(src, w, h, k), soft = smoothScale(src, w, h, k);
    const rows = range(2 * k, 6 * k);
    expect(Math.max(...steps(sharp, W, rows))).toBe(2 * k);
    expect(Math.max(...steps(soft, W, rows))).toBeLessThanOrEqual(4);
  });
  it('linha diagonal fina continua inteira (cada linha de saída tem tinta) e ganha bordas lisas', () => {
    const w = 10, src = img(w, w, (x, y) => x === y), W = w * k;
    const soft = smoothScale(src, w, w, k);
    for (const y of range(k, 9 * k)) expect(darkInRow(soft, W, y)).toBeGreaterThan(0);
    expect(soft).not.toEqual(nearest(src, w, w, k));
  });
  it('transparência: pixel transparente ao lado de opaco não vira cor estranha (alfa pré-multiplicado)', () => {
    const w = 8, src = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (x + y <= 7) src.set([255, 0, 0, 255], (y * w + x) * 4);
    const soft = smoothScale(src, w, w, k);
    for (let i = 0; i < soft.length; i += 4) if (soft[i + 3] > 0) expect([soft[i], soft[i + 1], soft[i + 2]]).toEqual([255, 0, 0]);
  });
});
