import { mkRound, placePx, ride, run, BTN, cx, cy, X } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { ABILITY_2 } from '../../src/core/mounts/abilities/type2';
import { cellOf } from '../../src/core/mounts/core-api';

describe('montaria tipo 2 (peixe verde)', () => {
  it('atravessa soft: de x=31 anda 60 px em 60 ticks e o bloco fica (T2 = 91)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0x2);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(91);
    expect(s.grid[cellOf(4, 1)]).toBe(0xcc80);
  });
  it('outro tipo para em x=47, diante do bloco', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    s.grid[cellOf(4, 1)] = 0xcc80;
    ride(s, 0, 0xa);
    run(s, 60, { 0: BTN.RIGHT });
    expect(X(p)).toBe(47);
  });
  it('passes só concede soft; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x2);
    expect(ABILITY_2.passes!(p, 0xcc80)).toBe(true);
    expect(ABILITY_2.passes!(p, 0xec40)).toBe(false);
    expect(ABILITY_2.passes!(p, 0xc900)).toBe(false);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
});
