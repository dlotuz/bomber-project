import { SampleRing } from '../../src/audio/engine/ring';

describe('SampleRing', () => {
  it('guarda e devolve quadros em ordem, como float', () => {
    const r = new SampleRing(4);
    r.push(16384, -16384); r.push(32767, -32768);
    const L = new Float32Array(3), R = new Float32Array(3);
    expect(r.shift(L, R, 0, 3)).toBe(2);
    expect(Array.from(L.subarray(0, 2))).toEqual([0.5, 32767 / 32768]);
    expect(Array.from(R.subarray(0, 2))).toEqual([-0.5, -1]);
    expect(r.size).toBe(0);
  });
  it('dá a volta e descarta quando cheia', () => {
    const r = new SampleRing(3);
    for (let i = 1; i <= 5; i++) r.push(i, -i);
    expect(r.size).toBe(3);
    expect(r.dropped).toBe(2);
    const L = new Float32Array(2), R = new Float32Array(2);
    r.shift(L, R, 0, 2);
    r.push(9, -9);
    const L2 = new Float32Array(2), R2 = new Float32Array(2);
    r.shift(L2, R2, 0, 2);
    expect(Array.from(L2).map(v => Math.round(v * 32768))).toEqual([3, 9]);
  });
});
