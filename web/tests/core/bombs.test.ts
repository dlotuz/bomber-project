import { newRound, run, input, place, addBomb } from './helpers';
import { BTN, CELL, ITEM } from '../../src/core/types';
import { idx } from '../../src/core/grid';
import { FLAME_FRAMES } from '../../src/core/constants';

const flame = (s: any, x: number, y: number) => s.arena.flame[idx(x, y)];

describe('bomba', () => {
  it('A coloca bomba na casa do jogador; limite de 1', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    expect(s.bombs).toHaveLength(1);
    run(s, 1); run(s, 1, input(0, BTN.A));
    expect(s.bombs).toHaveLength(1);
  });
  it('explode em exatamente 128 frames', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    run(s, 126);
    expect(s.bombs).toHaveLength(1);
    expect(flame(s, 1, 1)).toBe(0);
    run(s, 1);
    expect(s.bombs).toHaveLength(0);
    expect(flame(s, 1, 1)).toBeGreaterThan(0);
  });
  it('chama dura 33 frames', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 1);
    run(s, 1);
    expect(flame(s, 7, 1)).toBeGreaterThan(0);
    run(s, FLAME_FRAMES - 1);
    expect(flame(s, 7, 1)).toBeGreaterThan(0);
    run(s, 1);
    expect(flame(s, 7, 1)).toBe(0);
  });
  it('alcance = fogo + 2', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 1, 2);
    run(s, 1);
    expect(flame(s, 9, 1)).toBeGreaterThan(0);
    expect(flame(s, 10, 1)).toBe(0);
    expect(flame(s, 7, 3)).toBeGreaterThan(0);
  });
  it('HARD bloqueia a chama', () => {
    const s = newRound({ clear: true });
    addBomb(s, 1, 2, 1, 3);
    run(s, 1);
    expect(flame(s, 2, 2)).toBe(0);
    expect(flame(s, 3, 2)).toBe(0);
  });
  it('destrói só o primeiro soft block e revela o item escondido', () => {
    const s = newRound();                       // (3,1),(4,1) são soft
    s.arena.hidden[idx(3, 1)] = ITEM.FIRE;
    addBomb(s, 2, 1, 1, 4);
    run(s, 1);
    expect(s.arena.burning[idx(3, 1)]).toBeGreaterThan(0);
    expect(s.arena.burning[idx(4, 1)]).toBe(0);
    expect(flame(s, 4, 1)).toBe(0);
    run(s, FLAME_FRAMES);
    expect(s.arena.cells[idx(3, 1)]).toBe(CELL.EMPTY);
    expect(s.arena.items[idx(3, 1)]).toBe(ITEM.FIRE);
  });
  it('chama destrói item e para nele', () => {
    const s = newRound({ clear: true });
    s.arena.items[idx(9, 1)] = ITEM.BOMB;
    addBomb(s, 7, 1, 1, 4);
    run(s, 1);
    expect(s.arena.items[idx(9, 1)]).toBe(ITEM.NONE);
    expect(flame(s, 10, 1)).toBe(0);
  });
  it('reação em cadeia no mesmo frame', () => {
    const s = newRound({ clear: true });
    addBomb(s, 5, 1, 1, 2);
    addBomb(s, 7, 1, 999, 2);
    run(s, 1);
    expect(s.bombs).toHaveLength(0);
    expect(flame(s, 9, 1)).toBeGreaterThan(0);
  });
  it('jogador atingido morre após 78 frames', () => {
    const s = newRound({ clear: true });
    place(s, 1, 8, 1);
    addBomb(s, 7, 1, 1);
    run(s, 1);
    expect(s.players[1].dying).toBe(77);
    run(s, 76);
    expect(s.players[1].alive).toBe(true);
    run(s, 1);
    expect(s.players[1].alive).toBe(false);
  });
  it('dono atravessa a própria bomba até sair da casa, depois ela bloqueia', () => {
    const s = newRound({ clear: true });
    run(s, 1, input(0, BTN.A));
    run(s, 20, input(0, BTN.RIGHT));
    run(s, 20, input(0, BTN.LEFT));
    expect(s.players[0].x).toBe((2 + 1) * 128);
  });
});
