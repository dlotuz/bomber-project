import fixture from '../fixtures/rom/rounds.json';
import { createRound } from '../../src/core/setup';
import { makeRng, rnd } from '../../src/core/rng';
import { rules } from './kit';
import { CODE } from '../../src/core/types';
import { romOff, colOf, linOf } from '../../src/core/units';
import { STAGES } from '../../src/core/stages';

type StageFx = { soft: number[]; items: [number, number][]; afterRemove: number; afterItems: number };
const stages = fixture.stages as unknown as Record<string, StageFx>;
const off = (c: number) => romOff(colOf(c), linOf(c));

describe('golden: montagem das 10 fases (5 jogadores, semente de boot)', () => {
  it('RNG: as 207 chamadas do t52 batem', () => {
    const r = makeRng(fixture.rng.start);
    for (const [n, v] of fixture.rng.calls as [number, number][]) expect(rnd(r, n)).toBe(v);
    expect(r.seed).toBe(fixture.rng.final);
  });
  for (let k = 1; k <= 10; k++) {
    it(`fase ${k}: soft blocks, itens escondidos e sementes`, () => {
      const fx = stages[String(k)];
      let atInit = -1;
      STAGES[k] = { init: s => { atInit = s.rng.seed; if (k === 6) rnd(s.rng, 64); } };   // arena 6: 64 + rnd(64) (plano 8)
      try {
        const s = createRound(k, rules(), makeRng());
        expect(atInit).toBe(fx.afterRemove);
        const soft = s.grid.map((v, c) => (v === CODE.SOFT ? off(c) : -1)).filter(v => v >= 0).sort((a, b) => a - b);
        expect(soft).toEqual(fx.soft);
        expect(s.hidden.map(([c, i]) => [off(c), i])).toEqual(fx.items);
        expect(s.rng.seed).toBe(fx.afterItems);
      } finally { STAGES[k] = {}; }
    });
  }
});
