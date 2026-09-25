import { makeRng, nextU32, randInt, shuffle } from '../../src/core/rng';

describe('rng', () => {
  it('mesma seed gera a mesma sequência', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(nextU32(a)).toBe(nextU32(b));
  });
  it('seeds diferentes divergem', () => {
    const a = makeRng(1), b = makeRng(2);
    expect(nextU32(a)).not.toBe(nextU32(b));
  });
  it('randInt fica em [0,n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 1000; i++) { const v = randInt(r, 5); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); }
  });
  it('shuffle devolve uma permutação', () => {
    const r = makeRng(3);
    const out = shuffle(r, [0, 1, 2, 3, 4]);
    expect([...out].sort()).toEqual([0, 1, 2, 3, 4]);
  });
  it('o estado é serializável e retomável', () => {
    const a = makeRng(9); nextU32(a);
    const b = JSON.parse(JSON.stringify(a));
    expect(nextU32(a)).toBe(nextU32(b));
  });
});
