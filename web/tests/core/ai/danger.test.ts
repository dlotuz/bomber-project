import { arena, put, setCell, C } from '../kit';
import { dangerMap, SAFE, kickPath, pressureCells } from '../../../src/core/ai/danger';
import { addBomb } from '../../../src/core/bombs';
import { CODE } from '../../../src/core/types';

describe('mapa de perigo (offsets a partir do próximo tick)', () => {
  it('bomba recém-colocada: cruz letal a partir do offset 128; resto seguro', () => {
    const s = arena(); addBomb(s, 0, C(6, 1));
    const d = dangerMap(s);
    for (const c of [C(6, 1), C(5, 1), C(4, 1), C(7, 1), C(8, 1), C(6, 2), C(6, 3)]) expect(d[c]).toBe(128);
    expect([d[C(9, 1)], d[C(6, 4)], d[C(10, 5)]]).toEqual([SAFE, SAFE, SAFE]);
  });
  it('pilar e soft param a cruz como no núcleo', () => {
    const s = arena(); addBomb(s, 0, C(5, 1), { fire: 3 }); setCell(s, 7, 1, CODE.SOFT);
    const d = dangerMap(s);
    expect([d[C(5, 2)], d[C(7, 1)], d[C(8, 1)]]).toEqual([SAFE, 128, SAFE]);
  });
  it('cadeia: +2 por elo', () => {
    const s = arena();
    addBomb(s, 0, C(4, 1), { fuse: 10 });
    addBomb(s, 1, C(6, 1), { fuse: 100 });
    const d = dangerMap(s);
    expect([d[C(4, 1)], d[C(6, 1)], d[C(8, 1)]]).toEqual([12, 14, 14]);
  });
  it('chama atual é letal já no próximo tick', () => {
    const s = arena(); setCell(s, 6, 1, CODE.FLAME); s.cellT0[C(6, 1)] = 100;
    expect(dangerMap(s)[C(6, 1)]).toBe(1);
  });
  it('remota de adversário é perigo permanente; a própria não', () => {
    const s = arena(); addBomb(s, 1, C(6, 1), { type: 1 });
    expect(dangerMap(s, 0)[C(6, 1)]).toBe(1);
    expect(dangerMap(s, 1)[C(6, 1)]).toBe(SAFE);
  });
  it('bomba chutada que não para a tempo explode no meio do caminho, com a trilha marcada', () => {
    const s = arena(); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 1), { fuse: 20 });
    s.grid[C(5, 1)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0;
    const k = kickPath(s, b);
    expect([k.cell, k.t]).toEqual([C(7, 1), 21]);
    expect(k.trail).toEqual([C(5, 1), C(6, 1), C(7, 1)]);
    const d = dangerMap(s);
    expect([d[C(6, 1)], d[C(9, 1)]]).toEqual([22, 22]);
  });
  it('pressão: cronograma exato mesmo antes do gatilho (pelo relógio)', () => {
    const s = arena(); s.clock = { sec: 62, sub: 10 };
    const pc = pressureCells(s);
    expect(pc.get(C(2, 1))).toBe(10 + 205 + 38);
    expect(pc.get(C(3, 1))).toBe(10 + 219 + 38);
    expect(dangerMap(s)[C(2, 1)]).toBe(10 + 205 + 38 + 1);
  });
});
