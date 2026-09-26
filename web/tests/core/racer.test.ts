import { applyRacerPrize, drawRacerPrize, RACER_PRIZES } from '../../src/core/racer';
import { createPlayer } from '../../src/core/state';
import { makeRng } from '../../src/core/rng';

const fresh = () => createPlayer(0, true);

describe('prêmios do Racer ($C2:08F4)', () => {
  it('17 entradas; sorteio rnd(17)', () => {
    expect(RACER_PRIZES).toBe(17);
    const r = makeRng();
    for (let i = 0; i < 50; i++) { const v = drawRacerPrize(r); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(17); }
  });
  it('efeitos na ordem da ROM', () => {
    const cases: [number, (p: ReturnType<typeof fresh>) => unknown, unknown][] = [
      [0, p => [p.bombsCap, p.bombsFree], [2, 2]],
      [1, p => p.bombType, 2],
      [2, p => p.fire, 1],
      [3, p => p.fullFire, true],
      [4, p => p.speedLv, 2],
      [5, p => [p.bombType, p.glove], [1, true]],
      [6, p => p.glove, true],
      [7, p => p.glove, true],
      [8, p => [p.kick, p.passBomb], [true, false]],
      [9, p => JSON.stringify(p), JSON.stringify(fresh())],
      [10, p => JSON.stringify(p), JSON.stringify(fresh())],
      [11, p => [p.passBomb, p.kick], [true, false]],
      [12, p => p.passSoft, true],
      [13, p => p.speedLv, 1],
      [14, p => p.punch, true],
      [15, p => p.heart, true],
      [16, p => p.pItem, true],
    ];
    for (const [prize, get, want] of cases) { const p = fresh(); applyRacerPrize(p, prize); expect(get(p)).toEqual(want); }
  });
  it('patins −1 não desce abaixo de 1; bomba+1 respeita o máximo 8', () => {
    const p = fresh(); p.speedLv = 3; applyRacerPrize(p, 13); expect(p.speedLv).toBe(2);
    p.bombsCap = 8; p.bombsFree = 8; applyRacerPrize(p, 0); expect(p.bombsCap).toBe(8);
  });
});
