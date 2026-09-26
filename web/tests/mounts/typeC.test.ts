import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { cellOf } from '../../src/core/mounts/core-api';

function setup(bombs: number, face: 0 | 2 | 4 | 6 = 2) {
  const s = mkRound();
  const p = placePx(s, 0, cx(5), cy(1));
  p.face = face; p.bombsCap = bombs; p.bombsFree = bombs;
  ride(s, 0, 0xc);
  return { s, p };
}
const row = (s: ReturnType<typeof mkRound>, cols: number[]) => cols.map(c => s.grid[cellOf(c, 1)]);

describe('montaria tipo C (sino): Y = linha de bombas', () => {
  it('3 bombas em x = 80/96/112 (cols 5, 6, 7), a partir da própria casa (mount_c.py)', () => {
    const { s, p } = setup(3);
    const ev = run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6, 7, 8])).toEqual([0xc900, 0xc900, 0xc900, 0]);
    expect(p.bombsFree).toBe(0);
    expect(ev.filter(e => e.type === 'bomb_placed')).toHaveLength(3);
    expect(ev).toContainEqual({ type: 'mount', id: 'mount_ability', slot: 0, mount: 0xc });
  });
  it('para no obstáculo: soft em (7,1) → só (5,1) e (6,1)', () => {
    const { s, p } = setup(3);
    s.grid[cellOf(7, 1)] = 0xcc80;
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6, 7])).toEqual([0xc900, 0xc900, 0xcc80]);
    expect(p.bombsFree).toBe(1);
  });
  it('olhando para a esquerda: (5,1), (4,1), (3,1)', () => {
    const { s } = setup(3, 6);
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [3, 4, 5, 6])).toEqual([0xc900, 0xc900, 0xc900, 0]);
  });
  it('com 1 bomba disponível põe só 1', () => {
    const { s } = setup(1);
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6])).toEqual([0xc900, 0]);
  });
  it('doenças $24 e $25: o Y é consumido e nada acontece', () => {
    for (const d of [0x24, 0x25]) {
      const { s, p } = setup(3);
      p.disease = d;
      p.punch = true;                                        // Y não pode virar soco
      const ev = run(s, 1, { 0: BTN.Y });
      expect(row(s, [5, 6, 7])).toEqual([0, 0, 0]);
      expect(ev.some(e => e.type === 'punch')).toBe(false);
    }
  });
  it('bomba já na própria casa: nada (a linha começa bloqueada)', () => {
    const { s, p } = setup(3);
    run(s, 1, { 0: BTN.A });
    run(s, 1, { 0: BTN.Y });
    expect(row(s, [5, 6])).toEqual([0xc900, 0]);
    expect(p.bombsFree).toBe(2);
  });
});
