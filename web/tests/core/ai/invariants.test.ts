import { createMatch, finishRound, startRound } from '../../../src/core/match';
import { step } from '../../../src/core/step';
import { aiInputs, createAi } from '../../../src/core/ai';
import { CODE, type RoundState, type Rules } from '../../../src/core/types';
import { CELLS } from '../../../src/core/units';
import { rules } from '../kit';

/** Grade `BOMB` ⇔ exatamente uma bomba parada na casa (sem bombas "fantasma" empilhadas). */
function bombGridErrors(s: RoundState): string[] {
  const idle = new Array<number>(CELLS).fill(0);
  for (const b of s.bombs) if (b.state === 'idle') idle[b.cell]++;
  const out: string[] = [];
  for (let c = 0; c < CELLS; c++) {
    if ((s.grid[c] === CODE.BOMB) !== (idle[c] === 1) || idle[c] > 1) {
      out.push(`tick ${s.tick} casa ${c}: grade ${s.grid[c].toString(16)}, ${idle[c]} bombas paradas`);
    }
  }
  return out;
}

/** Joga `rounds` rodadas só de CPUs e devolve a 1ª violação do invariante (ou []). */
function check(r: Partial<Rules>, stage: number, seed: number, aiSeed: number, rounds = 1): string[] {
  const m = createMatch(rules(r), stage, seed);
  const cpu = [true, true, true, true, true];
  for (let k = 0; k < rounds; k++) {
    const s = startRound(m);
    const ai = createAi(aiSeed + k);
    for (let i = 0; i < 20000 && s.phase !== 'over'; i++) {
      step(s, aiInputs(s, ai, cpu, m.rules.cpuLevel));
      const e = bombGridErrors(s);
      if (e.length) return [`fase ${stage}, semente ${seed}, rodada ${k}: ${e[0]}`];
    }
    finishRound(m, s);
  }
  return [];
}

describe('invariante das bombas na grade (partidas só de CPUs)', () => {
  it('2 CPUs na fase 1 (a partida em que o revisor achou 2 bombas na mesma casa)', () => {
    expect(check({ active: [true, true, false, false, false] }, 1, 136, 6, 2)).toEqual([]);
  });
  it('5 CPUs, 10 fases × 3 sementes, níveis variados', () => {
    const errs: string[] = [];
    for (let stage = 1; stage <= 10; stage++) for (let k = 0; k < 3; k++) {
      errs.push(...check({ cpuLevel: k as 0 | 1 | 2 }, stage, 500 + 10 * stage + 2 * k, k + 1));
    }
    expect(errs).toEqual([]);
  }, 120_000);
});
