import { Resampler } from '../../src/audio/engine/resample';

function feeder(f: (i: number) => number) {
  let i = 0;
  return (l: Float32Array, r: Float32Array, n: number) => { for (let k = 0; k < n; k++, i++) { l[k] = f(i); r[k] = -f(i); } };
}

describe('Resampler 32 kHz → contexto', () => {
  it('mesma taxa: saída = entrada atrasada 3 amostras', () => {
    const rs = new Resampler(32000, 32000);
    const L = new Float32Array(10), R = new Float32Array(10);
    rs.process(L, R, 10, feeder(i => i + 1));
    expect(Array.from(L)).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(Array.from(R)).toEqual([-0, -0, -0, -1, -2, -3, -4, -5, -6, -7].map(v => v || 0));
  });
  it('48 kHz: 1 s de saída consome 1 s de entrada e preserva a frequência de 1 kHz', () => {
    const rs = new Resampler(32000, 48000);
    const L = new Float32Array(128), R = new Float32Array(128);
    const fill = feeder(i => Math.sin((2 * Math.PI * 1000 * i) / 32000));
    let zc = 0, prev = 0, tot = 0;
    for (let b = 0; b < 375; b++) {
      rs.process(L, R, 128, fill);
      for (let k = 0; k < 128; k++, tot++) { if (tot > 3 && (prev < 0) !== (L[k] < 0)) zc++; prev = L[k]; }
    }
    expect(tot).toBe(48000);
    expect(Math.abs(rs.consumed - 32000)).toBeLessThanOrEqual(2);
    expect(Math.abs(zc - 2000)).toBeLessThanOrEqual(2);
  });
  it('44,1 kHz: DC continua DC', () => {
    const rs = new Resampler(32000, 44100);
    const L = new Float32Array(100), R = new Float32Array(100);
    rs.process(L, R, 100, feeder(() => 0.5));
    for (let i = 8; i < 100; i++) { expect(L[i]).toBeCloseTo(0.5, 6); expect(R[i]).toBeCloseTo(-0.5, 6); }
  });
});
