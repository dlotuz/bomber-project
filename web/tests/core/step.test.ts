import { step } from '../../src/core/step';
import { emptyRound } from '../../src/core/state';
import { defaultRules, BTN } from '../../src/core/types';
import { INTRO_TICKS } from '../../src/core/constants';

describe('esqueleto do passo', () => {
  it('intro: 62 ticks e então play; entradas só atualizam prevBtn', () => {
    const s = emptyRound(1, defaultRules());
    expect(INTRO_TICKS).toBe(62);
    for (let i = 1; i < 62; i++) { step(s, [BTN.A, 0, 0, 0, 0]); expect(s.phase).toBe('intro'); }
    step(s, [BTN.A, 0, 0, 0, 0]);
    expect([s.tick, s.phase, s.phaseT0]).toEqual([62, 'play', 62]);
    expect(s.players[0].prevBtn).toBe(BTN.A);
  });
  it('over: step não avança nem emite', () => {
    const s = emptyRound(1, defaultRules());
    s.phase = 'over';
    expect(step(s, [0, 0, 0, 0, 0])).toEqual([]);
    expect(s.tick).toBe(0);
  });
});
