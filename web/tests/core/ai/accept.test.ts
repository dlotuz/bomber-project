import { createMatch, startRound } from '../../../src/core/match';
import { createAi } from '../../../src/core/ai';
import { STAGES } from '../../../src/core/stages';
import { play } from './simkit';
import { rules } from '../kit';

/** Fases em que o limite de 30 % ainda não se aplica, com o motivo; cada uma volta sozinha ao critério quando o motivo
 *  some. Elas continuam tendo de terminar (sem travar).
 *  - 8: sem o módulo da arena 8 (plano 8) não há caça-níquel e a lista de itens da fase é vazia: todos jogam a rodada
 *    inteira com 1 bomba de alcance 2, e dois CPUs que desviam bem não conseguem se encurralar (≈ 50 % por tempo). */
function pending(stage: number): string | null {
  if (stage === 8 && !STAGES[8]?.tick) return 'sem o módulo da arena 8';
  return null;
}

/** §9.10: rodadas só de CPUs nas 10 fases terminam; por fase, no máximo 30 % por tempo. Sementes pares (a ROM faz
 *  `seed | 1`: 2k e 2k+1 dariam a mesma rodada) e semente da IA por rodada (varia as fases sem sorteio de mapa). */
function batch(perStage: number): void {
  for (let stage = 1; stage <= 10; stage++) {
    let byTime = 0;
    for (let k = 0; k < perStage; k++) {
      const level = k % 3;
      const s = startRound(createMatch(rules({ cpuLevel: level as 0 | 1 | 2 }), stage, 1000 * stage + 2 * k));
      play(s, [true, true, true, true, true], level, 12000, createAi(k + 1));
      expect(s.phase, `fase ${stage}, rodada ${k}`).toBe('over');
      if (s.result!.reason === 'time') byTime++;
    }
    if (pending(stage)) continue;
    expect(byTime / perStage, `fase ${stage}`).toBeLessThanOrEqual(0.3);
  }
}

describe('aceite da IA (§9)', () => {
  it('rápido: 5 rodadas por fase', () => batch(5), 300_000);
  it.skipIf(!process.env.CB_SLOW)('completo: 50 rodadas por fase', () => batch(50), 3_600_000);
});
