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

// Limite fixo em 30 % para todas as fases, de propósito (revisão final do plano 8: "não afrouxar o limite dentro
// do cpu.test.ts, consertar a amostragem" — M1, já feito acima). Com I1 (stage8Ai.goals restrita), a fase 8 mede
// 20 % aqui (10/50) e passa. A fase 10 mede 32 % (16/50) e continua vermelha: são vidas extra de traje + IA de
// duelo do plano 6 (I2), pré-existente e fora do escopo do plano 8 — ver "Resultado da execução" do plano 8 para o
// follow-up do plano 6. Isso só aparece com CB_SLOW=1; o `npx vitest run` normal pula este describe.
describe.skipIf(!process.env.CB_SLOW)('aceite §9 da IA nas arenas especiais (lento)', () => {
  for (let stage = 2; stage <= 10; stage++) {
    it(`fase ${stage}: 50 rodadas, no máximo 30 % terminam por TIME UP`, () => {
      let timeUp = 0;
      for (let k = 1; k <= 50; k++) {
        const s = cpuRound(stage, k);
        expect(s.phase).toBe('over');
        if (s.result?.reason === 'time') timeUp++;
      }
      expect(timeUp).toBeLessThanOrEqual(15);
    }, 900_000);
  }
});
