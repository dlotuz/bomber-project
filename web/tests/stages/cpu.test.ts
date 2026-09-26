import { createMatch, startRound } from '../../src/core/match';
import { step } from '../../src/core/step';
import { createAi, aiInputs } from '../../src/core/ai';
import { hashState } from '../../src/core/hash';
import { defaultRules, type RoundState } from '../../src/core/types';

const CPU = [true, true, true, true, true];
const MAX = 3 * 60 * 60 + 62 + 600;          // 3:00 + intro + folga (TIME UP e comemoração)

/** `k`-ésima rodada da fase: semente de mapa `1000·stage + 2k` e IA `createAi(k + 1)`, como em `accept.test.ts`
 *  (M1 da revisão final do plano 8): a ROM faz `seed | 1` antes de multiplicar, então sementes `2k`/`2k+1` dão a
 *  mesma rodada — sem variar a semente da IA por rodada, metade da amostra do CB_SLOW era repetida. */
function cpuRound(stage: number, k: number): RoundState {
  const m = createMatch({ ...defaultRules(), cpuLevel: 1 }, stage, 1000 * stage + 2 * k);
  const s = startRound(m);
  const ai = createAi(k + 1);
  for (let i = 0; i < MAX && s.phase !== 'over'; i++) step(s, aiInputs(s, ai, CPU, 1));
  return s;
}

describe('partidas só de CPU nas arenas 2–10 (spec §11, plano 8)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 2 rodadas terminam sem travar`, () => {
      for (const k of [1, 2]) {
        const s = cpuRound(stage, k);
        expect(s.phase, `fase ${stage} rodada ${k}`).toBe('over');
        expect(s.result).not.toBeNull();
      }
    }, 120_000);
  }
  it('determinismo: mesma semente → mesmo hash (arenas 2–10, M2)', () => {
    for (let stage = 2; stage <= 10; stage++) expect(hashState(cpuRound(stage, 7)), `fase ${stage}`).toBe(hashState(cpuRound(stage, 7)));
  }, 120_000);
});

// Limite de 30 % por fase, com a mesma tolerância de 40 % nas fases 8 e 10 decidida para o accept.test (decisão do
// controlador, I2 da revisão final do plano 8): lá o excesso vem da IA do plano 6 em campo aberto (fase 8) e contra
// vidas extra de traje (fase 10), não das arenas — follow-up registrado. A amostragem foi corrigida (M1). Medido com
// CB_SLOW: fase 8 = 20 % (10/50), fase 10 = 32 % (16/50). Só roda com CB_SLOW=1.
const maxTimeUp = (stage: number): number => (stage === 8 || stage === 10 ? 20 : 15);   // de 50 rodadas
describe.skipIf(!process.env.CB_SLOW)('aceite §9 da IA nas arenas especiais (lento)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 50 rodadas, no máximo ${maxTimeUp(stage) * 2} % terminam por TIME UP`, () => {
      let timeUp = 0;
      for (let k = 1; k <= 50; k++) {
        const s = cpuRound(stage, k);
        expect(s.phase).toBe('over');
        if (s.result?.reason === 'time') timeUp++;
      }
      expect(timeUp).toBeLessThanOrEqual(maxTimeUp(stage));
    }, 900_000);
  }
});
