import { createView, updateView, walkFrame, flameShrink, flameCells, formatClock, dyingVisible, roundOverText } from '../../src/render/view';
import { createRound, defaultRules, FLAME_FRAMES, type GameEvent } from '../../src/core';

const round = () => createRound(1, { ...defaultRules(), randomSpawns: false }, 1);

describe('chamas', () => {
  it('peças a partir dos braços [cima, baixo, esquerda, direita]', () => {
    const cells = flameCells({ gx: 5, gy: 5, arms: [0, 2, 1, 3], age: 0 });
    expect(cells).toHaveLength(7);
    expect(cells[0]).toEqual({ gx: 5, gy: 5, part: 'center' });
    expect(cells).toContainEqual({ gx: 5, gy: 6, part: 'v' });
    expect(cells).toContainEqual({ gx: 5, gy: 7, part: 'down' });
    expect(cells).toContainEqual({ gx: 4, gy: 5, part: 'left' });
    expect(cells).toContainEqual({ gx: 7, gy: 5, part: 'h' });
    expect(cells).toContainEqual({ gx: 8, gy: 5, part: 'right' });
  });
  it('afinam no começo e no fim', () => {
    expect([flameShrink(0), flameShrink(3), flameShrink(10), flameShrink(27), flameShrink(32)]).toEqual([2, 1, 0, 1, 2]);
  });
});

describe('updateView', () => {
  it('acompanha explosões pelo tempo da chama e limpa ao trocar de rodada', () => {
    const v = createView();
    const r = round();
    const ev: GameEvent[] = [{ type: 'explosion', gx: 3, gy: 1, arms: [0, 1, 2, 2] }];
    updateView(v, r, ev);
    expect(v.explosions).toHaveLength(1);
    for (let i = 0; i < FLAME_FRAMES - 1; i++) updateView(v, r, []);
    expect(v.explosions).toHaveLength(1);
    updateView(v, r, []);
    expect(v.explosions).toHaveLength(0);
    updateView(v, r, ev);
    updateView(v, round(), []);
    expect(v.explosions).toHaveLength(0);
  });
  it('contador de caminhada sobe quando o jogador se move e zera parado', () => {
    const v = createView();
    const r = round();
    updateView(v, r, []);
    r.players[0].x += 8; updateView(v, r, []);
    r.players[0].x += 8; updateView(v, r, []);
    expect(v.walk[0]).toBe(2);
    updateView(v, r, []);
    expect(v.walk[0]).toBe(0);
  });
});

describe('helpers de exibição', () => {
  it('quadro de caminhada', () => {
    expect([0, 1, 8, 16, 24, 32].map(walkFrame)).toEqual([0, 1, 0, 2, 0, 1]);
  });
  it('relógio arredonda para cima', () => {
    expect([10800, 10799, 10740, 59, 0, -1].map(formatClock)).toEqual(['3:00', '3:00', '2:59', '0:01', '0:00', '--:--']);
  });
  it('morrendo pisca e some no fim', () => {
    expect([0, 10, 72, 76].map(dyingVisible)).toEqual([true, false, true, false]);
  });
  it('texto de fim de rodada', () => {
    expect(roundOverText([], 'ffa', [0, 1, 0, 1, 0])).toBe('EMPATE!');
    expect(roundOverText([2], 'ffa', [0, 1, 0, 1, 0])).toBe('P3 VENCEU!');
    expect(roundOverText([0, 2, 4], 'team', [0, 1, 0, 1, 0])).toBe('TIME VERMELHO VENCEU!');
    expect(roundOverText([1, 3], 'team', [0, 1, 0, 1, 0])).toBe('TIME BRANCO VENCEU!');
  });
});
