import fixture from '../fixtures/rom/movement.json';
import { arena } from './kit';
import { moveStep } from '../../src/core/movement';

interface Trial { stage: number; grid: number[]; level: number; x0: number; y0: number; inputs: [number, number][]; d: number[] }

describe('golden de movimento (≥ 20.000 ticks do emulador)', () => {
  it('fixture bem formado', () => {
    expect(fixture.romSha1).toBe('38f4394986bd39fcbe32a722a3fe103ee6177d9b');
    expect(fixture.ticks).toBeGreaterThanOrEqual(20000);
  });
  it('0 divergências', () => {
    let ticks = 0, bad = 0, first = '';
    for (const [n, t] of (fixture.trials as Trial[]).entries()) {
      const s = arena({ stage: t.stage });
      s.grid = [...t.grid];
      const p = s.players[0];
      p.x = t.x0; p.y = t.y0;
      let x = t.x0, y = t.y0, k = 0;
      for (const [mask, count] of t.inputs) for (let i = 0; i < count; i++, k++) {
        moveStep(s, p, mask, t.level);
        x += t.d[2 * k]; y += t.d[2 * k + 1];
        ticks++;
        if (p.x !== x || p.y !== y) { bad++; if (!first) first = `tentativa ${n}, tick ${k}: ${p.x},${p.y} ≠ ${x},${y}`; p.x = x; p.y = y; }
      }
    }
    expect(first).toBe('');
    expect(bad).toBe(0);
    expect(ticks).toBe(fixture.ticks);
  });
});
