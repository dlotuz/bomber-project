import { Repeater, DIRS } from '../../src/input/repeat';
import { BTN } from '../../src/game/core-api';

const pulses = (r: Repeater, held: number, n: number): number[] => {
  const at: number[] = [];
  for (let f = 0; f < n; f++) if (r.step(held) & held) at.push(f);
  return at;
};

describe('repetição ao segurar (spec §6)', () => {
  it('menus: 1º passo no frame 0, repete aos 20 f e depois a cada 5 f', () => {
    expect(pulses(new Repeater(), BTN.DOWN, 41)).toEqual([0, 20, 25, 30, 35, 40]);
  });
  it('fase: 36 f e depois a cada 21 f', () => {
    expect(pulses(new Repeater(36, 21), BTN.RIGHT, 80)).toEqual([0, 36, 57, 78]);
  });
  it('botões fora da máscara só dão a borda', () => {
    expect(pulses(new Repeater(), BTN.A, 60)).toEqual([0]);
    expect(DIRS).toBe(BTN.UP | BTN.DOWN | BTN.LEFT | BTN.RIGHT);
  });
  it('soltar zera a contagem daquele botão', () => {
    const r = new Repeater();
    for (let f = 0; f < 19; f++) r.step(BTN.UP);
    r.step(0);
    expect(r.step(BTN.UP)).toBe(BTN.UP);
    expect(r.step(BTN.UP)).toBe(0);
  });
  it('cada bit conta separado', () => {
    const r = new Repeater();
    for (let f = 0; f < 10; f++) r.step(BTN.UP);
    expect(r.step(BTN.UP | BTN.LEFT)).toBe(BTN.LEFT);
  });
  it('reset esquece tudo', () => {
    const r = new Repeater();
    r.step(BTN.UP); r.reset();
    expect(r.step(BTN.UP)).toBe(BTN.UP);
  });
});
