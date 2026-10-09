import { delaysFor, rttOf, MIN_DELAY, MAX_DELAY } from '../../server/delay.mjs';

const peer = (slot: number, rtts: number[]) => ({ slot, rtts });

describe('atraso da sala online (servidor)', () => {
  it('ping = mediana das últimas medidas: um pico isolado não pesa', () => {
    expect(rttOf(peer(0, []))).toBeNull();
    expect(rttOf(peer(0, [40, 42, 900, 41, 39]))).toBe(41);
    expect(rttOf(peer(0, [40, 50]))).toBe(45);
  });
  it('cada vaga com o próprio atraso: o anfitrião em localhost espera menos que quem está longe', () => {
    const host = peer(0, [1, 1, 2]), a = peer(1, [80, 82, 78]), b = peer(2, [120, 118, 122]);
    const d = delaysFor([host, a, b]);
    expect(d[0]).toBe(Math.ceil((1 + 120) / 2 / (1000 / 60)) + 2);    // 6
    expect(d[1]).toBe(Math.ceil((80 + 120) / 2 / (1000 / 60)) + 2);   // 8
    expect(d[2]).toBe(Math.ceil((120 + 80) / 2 / (1000 / 60)) + 2);   // 8
    expect(d[0]).toBeLessThan(d[2]);
  });
  it('limites, sem medida e atraso fixo (SALA_DELAY)', () => {
    expect(delaysFor([peer(0, [1]), peer(1, [2])])[0]).toBe(MIN_DELAY);
    expect(delaysFor([peer(0, [2000]), peer(1, [2000])])[1]).toBe(MAX_DELAY);
    expect(delaysFor([peer(0, []), peer(1, [])])[0]).toBe(Math.ceil(150 / (1000 / 60)) + 2);   // sem medida: 150 ms
    expect(delaysFor([peer(0, [1]), peer(3, [300])], 6)).toEqual([6, MIN_DELAY, MIN_DELAY, 6, MIN_DELAY]);
  });
});
