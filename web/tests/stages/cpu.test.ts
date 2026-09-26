import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { createAi, aiInputs } from '../../src/core/ai';
import { hashState } from '../../src/core/hash';
import { defaultRules, type RoundState } from '../../src/core/types';

const CPU = [true, true, true, true, true];
const MAX = 3 * 60 * 60 + 62 + 600;          // 3:00 + intro + folga (TIME UP e comemoração)

function cpuRound(stage: number, seed: number): RoundState {
  const m = createMatch({ ...defaultRules(), cpuLevel: 1 }, stage, seed);
  const s = startRound(m);
  const ai = createAi();
  for (let i = 0; i < MAX && s.phase !== 'over'; i++) step(s, aiInputs(s, ai, CPU, 1));
  return s;
}

describe('partidas só de CPU nas arenas 2–10 (spec §11, plano 8)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 2 rodadas terminam sem travar`, () => {
      for (const seed of [1, 2]) {
        const s = cpuRound(stage, seed);
        expect(s.phase, `fase ${stage} semente ${seed}`).toBe('over');
        expect(s.result).not.toBeNull();
      }
    }, 120_000);
  }
  it('determinismo: mesma semente → mesmo hash (arenas 3, 8 e 9)', () => {
    for (const stage of [3, 8, 9]) expect(hashState(cpuRound(stage, 7))).toBe(hashState(cpuRound(stage, 7)));
  }, 120_000);
});

describe.skipIf(!process.env.CB_SLOW)('aceite §9 da IA nas arenas especiais (lento)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 50 rodadas, no máximo 30 % terminam por TIME UP`, () => {
      let timeUp = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const s = cpuRound(stage, seed);
        expect(s.phase).toBe('over');
        if (s.result?.reason === 'time') timeUp++;
      }
      expect(timeUp).toBeLessThanOrEqual(15);
    }, 900_000);
  }
});
