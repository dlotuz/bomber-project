import { makeRng, rnd, BOOT_SEED, permuteSpawns } from '../../src/core/rng';

describe('RNG da ROM ($C3:54B3)', () => {
  it('boot $12: 5 chamadas rnd($FF) dão 66, 79, 196, 147, 197 e a semente vira $C689 (t52)', () => {
    const r = makeRng();
    expect(BOOT_SEED).toBe(0x12);
    expect([0, 0, 0, 0, 0].map(() => rnd(r, 0xffff))).toEqual([66, 79, 196, 147, 197]);
    expect(r.seed).toBe(0xc689);
  });
  it('remoção de blocos começa com col/lin 2,5 9,6 6,0 12,0 3,2 9,5 e a semente $77F9', () => {
    const r = makeRng(0xc689);
    const v: number[] = [];
    for (let i = 0; i < 6; i++) { v.push(rnd(r, 13)); v.push(rnd(r, 11)); }
    expect(v).toEqual([2, 5, 9, 6, 6, 0, 12, 0, 3, 2, 9, 5]);
    expect(r.seed).toBe(0x77f9);
  });
  it('só n & $FF importa: rnd(256) é sempre 0 mas avança a semente', () => {
    const r = makeRng(0x1234);
    expect(rnd(r, 256)).toBe(0);
    expect(r.seed).toBe(((0x1235 * 0x383) & 0xffff));
  });
  it('semente de 16 bits, serializável', () => {
    const r = makeRng(0x12345);
    expect(r.seed).toBe(0x2345);
    const copy = JSON.parse(JSON.stringify(r));
    expect(rnd(copy, 100)).toBe(rnd(makeRng(0x2345), 100));
  });
  it('permuteSpawns: permutação determinística de 0..4, fora do RNG do jogo', () => {
    const a = permuteSpawns(7), b = permuteSpawns(7);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
    const distinct = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => permuteSpawns(k).join(',')));
    expect(distinct.size).toBeGreaterThan(1);
  });
});
