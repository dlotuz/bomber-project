import { tickGame } from '../../src/app/tick';
import { createSession } from '../../src/game/session';
import { createView } from '../../src/render/view';
import { parseConfig } from '../../src/game/config';
import { BTN, INTRO_TICKS } from '../../src/core';

const idle = [0, 0, 0, 0, 0];

describe('tickGame', () => {
  it('não avança o núcleo nem a visão durante a pausa', () => {
    const s = createSession(parseConfig('?players=2'), 1);
    const v = createView();
    for (let i = 0; i < INTRO_TICKS; i++) tickGame(s, v, idle);
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]); tickGame(s, v, idle);
    expect(s.paused).toBe(true);
    const t = s.round.tick;
    for (let i = 0; i < 60; i++) { tickGame(s, v, idle); expect(s.stepped).toBe(false); }
    expect(s.round.tick).toBe(t);
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]); tickGame(s, v, idle);
    expect(s.round.tick).toBeGreaterThan(t);
  });
});
