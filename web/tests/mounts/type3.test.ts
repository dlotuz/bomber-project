import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { cellOf } from '../../src/core/mounts/core-api';

function scene(mounted: boolean) {
  const s = mkRound();
  const p = placePx(s, 0, cx(2), cy(1));
  p.fire = 3;
  s.grid[cellOf(4, 1)] = 0xcc80; s.grid[cellOf(6, 1)] = 0xcc80;
  if (mounted) ride(s, 0, 0x3);
  run(s, 1, { 0: BTN.A });
  expect(s.grid[cellOf(2, 1)]).toBe(0xc900);
  placePx(s, 0, cx(4), cy(5));                               // fora da cruz
  run(s, 130);
  return s;
}

describe('montaria tipo 3 (triceratops)', () => {
  it('bomba do montado perfura: queima (4,1) e (6,1)', () => {
    const s = scene(true);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xcc80);
    expect(s.grid[cellOf(6, 1)]).not.toBe(0xcc80);
  });
  it('sem montaria só queima (4,1)', () => {
    const s = scene(false);
    expect(s.grid[cellOf(4, 1)]).not.toBe(0xcc80);
    expect(s.grid[cellOf(6, 1)]).toBe(0xcc80);
  });
  it('bombType = 2 só em riding; Y não faz nada', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.bombType!(p)).toBeNull();
    const r = ride(s, 0, 0x3);
    expect(mountModule.bombType!(p)).toBe(2);
    expect(mountModule.onY(s, p, [])).toBe(false);
    r.phase = 'dismount';
    expect(mountModule.bombType!(p)).toBeNull();
  });
});
