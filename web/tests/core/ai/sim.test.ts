import { createMatch, startRound } from '../../../src/core/match';
import { play } from './simkit';
import { rules } from '../kit';

describe('simulação só de CPUs', () => {
  it('10 rodadas × 5 CPUs Normal na fase 1: todas terminam; no máximo 3 por tempo', () => {
    let byTime = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = startRound(createMatch(rules({ cpuLevel: 1 }), 1, seed));
      play(s, [true, true, true, true, true], 1, 12000);
      expect(s.phase).toBe('over');
      if (s.result!.reason === 'time') byTime++;
    }
    expect(byTime).toBeLessThanOrEqual(3);
  });
});
