import { mkRound, placePx, ride, run, bombCells, BTN, cx, cy, X } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { cellOf, colOf, linOf } from '../../src/core/mounts/core-api';
import { addBomb } from '../../src/core/bombs';

function kickScene(type: number) {
  const s = mkRound();
  const p = placePx(s, 0, cx(2), cy(1));
  ride(s, 0, type);
  run(s, 32, { 0: BTN.RIGHT });
  expect(X(p)).toBe(63);
  run(s, 1, { 0: BTN.A });
  run(s, 32, { 0: BTN.LEFT });
  run(s, 30, { 0: BTN.RIGHT });
  run(s, 20);
  return s;
}

describe('montaria tipo A (chute)', () => {
  it('andar contra a bomba a chuta: sai da (4,1) para a direita (mount_kick.py)', () => {
    const s = kickScene(0xa);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xc900);
    const cells = bombCells(s);
    expect(cells).toHaveLength(1);
    expect(linOf(cells[0])).toBe(1);
    expect(colOf(cells[0])).toBeGreaterThan(4);
  });
  it('não chuta a bomba com outro jogador em cima ($C1:33FD): ela fica na (4,1)', () => {
    const s = mkRound({ players: [0, 1] });
    placePx(s, 1, cx(4), cy(1));
    s.grid[cellOf(4, 1)] = 0xc900;
    addBomb(s, 1, cellOf(4, 1));
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0xa);
    const ev = run(s, 40, { 0: BTN.RIGHT });
    expect(bombCells(s)).toEqual([cellOf(4, 1)]);
    expect(ev.some(e => e.type === 'bomb_kicked')).toBe(false);
    expect(X(p)).toBeLessThan(cx(4) - 8);
  });
  it('tipo 3 não chuta: a bomba fica na (4,1)', () => {
    const s = kickScene(0x3);
    expect(bombCells(s)).toEqual([cellOf(4, 1)]);
  });
  it('kicks só em riding; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.kicks!(p)).toBe(false);
    ride(s, 0, 0xa);
    expect(mountModule.kicks!(p)).toBe(true);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
});
