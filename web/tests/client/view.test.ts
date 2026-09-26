import { createView, updateView, walkFrame, flameShrink, flamePart, formatClock, dyingVisible } from '../../src/render/view';
import { createRound, makeRng, defaultRules, FLAME_PIECE } from '../../src/core';

describe('visão', () => {
  it('peças da chama a partir de cellAux', () => {
    expect([FLAME_PIECE.CENTER, FLAME_PIECE.ARM_UP, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.TIP_UP, FLAME_PIECE.TIP_DOWN, FLAME_PIECE.TIP_LEFT, FLAME_PIECE.TIP_RIGHT].map(flamePart))
      .toEqual(['center', 'v', 'h', 'up', 'down', 'left', 'right']);
  });
  it('a chama afina no começo e no fim dos 25 ticks', () => {
    expect([flameShrink(0), flameShrink(2), flameShrink(10), flameShrink(18), flameShrink(21), flameShrink(24)]).toEqual([2, 1, 0, 1, 2, 2]);
  });
  it('contador de caminhada sobe quando o jogador se move e zera parado', () => {
    const r = createRound(1, defaultRules(), makeRng());
    const v = createView();
    updateView(v, r, []);
    r.players[0].x += 256; updateView(v, r, []);
    expect(v.walk[0]).toBe(1);
    updateView(v, r, []);
    expect(v.walk[0]).toBe(0);
  });
  it('quadro de caminhada', () => {
    expect([walkFrame(0), walkFrame(8), walkFrame(16), walkFrame(24)]).toEqual([0, 0, 2, 0]);
  });
  it('relógio da ROM', () => {
    expect(formatClock({ sec: 180, sub: 51 })).toBe('3:00');
    expect(formatClock({ sec: 1801, sub: 1 })).toBe('30:01');
  });
  it('morrendo: pisca nos ticks 1..21 e some depois', () => {
    expect([dyingVisible(1), dyingVisible(4), dyingVisible(16), dyingVisible(22), dyingVisible(60)]).toEqual([true, false, true, false, false]);
  });
});
