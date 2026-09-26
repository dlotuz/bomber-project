import { newRound, run, input, place } from './helpers';
import { BTN } from '../../src/legacy-core/types';
import { centerX, centerY } from '../../src/legacy-core/grid';
import { step } from '../../src/legacy-core/round';
import { createRound } from '../../src/legacy-core/round';
import { defaultRules } from '../../src/legacy-core/types';

describe('intro', () => {
  it('90 frames de intro ignoram inputs', () => {
    const s = createRound(1, { ...defaultRules(), randomSpawns: false }, 1);
    const x0 = s.players[0].x;
    for (let i = 0; i < 89; i++) step(s, input(0, BTN.RIGHT));
    expect(s.phase).toBe('intro');
    step(s, input(0, BTN.RIGHT));
    expect(s.phase).toBe('playing');
    expect(s.players[0].x).toBe(x0);
  });
});

describe('movimento', () => {
  it('velocidade nível 1 = 60 px em 60 frames', () => {
    const s = newRound({ clear: true });
    const x0 = s.players[0].x;
    run(s, 60, input(0, BTN.RIGHT));
    expect((s.players[0].x - x0) / 8).toBe(60);
  });
  it('velocidade nível 5 = 90 px em 60 frames', () => {
    const s = newRound({ clear: true });
    s.players[0].speed = 5;
    const x0 = s.players[0].x;
    run(s, 60, input(0, BTN.RIGHT));
    expect((s.players[0].x - x0) / 8).toBe(90);
  });
  it('pilar bloqueia', () => {
    const s = newRound({ clear: true });
    place(s, 0, 1, 2);
    run(s, 10, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1));
  });
  it('para no centro da casa antes de um bloco', () => {
    const s = newRound();                    // fase 1 sem limpar: (3,1) é soft
    run(s, 40, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(2));
  });
  it('correção de canto: desalinhado 4 px desliza até alinhar e depois anda', () => {
    const s = newRound({ clear: true });
    s.players[0].y = centerY(1) + 32;
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].y).toBe(centerY(1) + 24);
    expect(s.players[0].x).toBe(centerX(1));
    run(s, 3, input(0, BTN.RIGHT));
    expect(s.players[0].y).toBe(centerY(1));
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1) + 8);
  });
  it('sem correção além de 6 px', () => {
    const s = newRound({ clear: true });
    s.players[0].y = centerY(1) + 56;
    step(s, input(0, BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1));
    expect(s.players[0].y).toBe(centerY(1) + 56);
  });
  it('diagonal: se o primeiro eixo está bloqueado, usa o outro', () => {
    const s = newRound({ clear: true });
    run(s, 5, input(0, BTN.UP | BTN.RIGHT));
    expect(s.players[0].x).toBe(centerX(1) + 40);
  });
});
