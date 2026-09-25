import { tickGame } from '../../src/app/tick';
import { createSession } from '../../src/game/session';
import { createView } from '../../src/render/view';
import { parseConfig } from '../../src/game/config';
import { BTN, INTRO_FRAMES, FUSE_FRAMES } from '../../src/core';

const idle = [0, 0, 0, 0, 0];

describe('tickGame', () => {
  it('congela a visão (explosões) durante a pausa e retoma ao despausar', () => {
    const s = createSession(parseConfig('?players=2&spawns=0'), 1);
    const v = createView();
    for (let i = 0; i < INTRO_FRAMES + 1; i++) tickGame(s, v, idle);

    // P1 planta uma bomba e espera o estopim.
    tickGame(s, v, [BTN.A, 0, 0, 0, 0]);
    tickGame(s, v, idle);
    for (let i = 0; i < FUSE_FRAMES + 5 && v.explosions.length === 0; i++) tickGame(s, v, idle);
    expect(v.explosions.length).toBeGreaterThan(0);

    // Pausa (START do P1).
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]);
    tickGame(s, v, idle);
    expect(s.paused).toBe(true);

    const before = v.explosions.map(e => ({ ...e }));
    for (let i = 0; i < 60; i++) tickGame(s, v, idle);
    expect(v.explosions).toHaveLength(before.length);
    expect(v.explosions.map(e => e.age)).toEqual(before.map(e => e.age));

    // Despausa: as idades voltam a avançar.
    tickGame(s, v, [BTN.START, 0, 0, 0, 0]);
    tickGame(s, v, idle);
    expect(s.paused).toBe(false);
    tickGame(s, v, idle);
    tickGame(s, v, idle);
    for (let i = 0; i < before.length; i++) expect(v.explosions[i]?.age ?? Infinity).toBeGreaterThan(before[i].age);
  });
});
