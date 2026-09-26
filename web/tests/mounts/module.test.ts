import { mkRound, placePx, ride, run, BTN, cx, cy } from './helpers';
import { mountModule } from '../../src/core/mounts/module';
import { ABILITIES } from '../../src/core/mounts/abilities';
import { mstate, type MountAbility } from '../../src/core/mounts/types';

const saved: Record<number, MountAbility> = { ...ABILITIES };
afterEach(() => { Object.assign(ABILITIES, saved); });

describe('despacho do MountModule', () => {
  it('passes/bombType/kicks/onY só valem em riding', () => {
    ABILITIES[0x2] = { type: 0x2, passes: (_p, c) => c === 0xcc80, bombType: () => 2, kicks: () => true, onY: () => true };
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    expect(mountModule.passes!(p, 0xcc80)).toBe(false);
    const r = ride(s, 0, 0x2);
    expect(mountModule.passes!(p, 0xcc80)).toBe(true);
    expect(mountModule.passes!(p, 0xec40)).toBe(false);
    expect(mountModule.bombType!(p)).toBe(2);
    expect(mountModule.kicks!(p)).toBe(true);
    expect(mountModule.onY(s, p, [])).toBe(true);
    r.phase = 'mounting';
    expect(mountModule.passes!(p, 0xcc80)).toBe(false);
    expect(mountModule.bombType!(p)).toBeNull();
    expect(mountModule.kicks!(p)).toBe(false);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
  it('tipo sem onY devolve false (o Y segue para P/soco)', () => {
    ABILITIES[0x3] = { type: 0x3 };
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    ride(s, 0, 0x3);
    expect(mountModule.onY(s, p, [])).toBe(false);
  });
  it('projéteis: tickProjectile a partir do tick seguinte ao nascimento; done é removido; congelam fora de play', () => {
    const seen: number[] = [];
    ABILITIES[0xe] = { type: 0xe, tickProjectile: (st, pr) => { seen.push(st.tick - pr.born); if (st.tick - pr.born === 3) pr.state = 'done'; } };
    const s = mkRound();
    mstate(s).projectiles.push({ id: 1, kind: 0xe, owner: 0, x: 0, y: 0, dir: 2, born: s.tick, state: 'fly', t: s.tick, slot: 0 });
    mountModule.tick(s, []);                                 // mesmo tick do nascimento: nada
    run(s, 5);
    expect(seen).toEqual([1, 2, 3]);
    expect(mstate(s).projectiles).toHaveLength(0);
    mstate(s).projectiles.push({ id: 2, kind: 0xe, owner: 0, x: 0, y: 0, dir: 2, born: s.tick - 1, state: 'fly', t: s.tick, slot: 0 });
    s.phase = 'won';
    seen.length = 0;
    mountModule.tick(s, []);
    expect(seen).toEqual([]);
  });
  it('trail: guarda as casas anteriores do montador (até 4)', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    const r = ride(s, 0, 0x3, { reserves: [2] });
    run(s, 16 * 3, { 0: BTN.RIGHT });
    expect(r.trail.slice(0, 3)).toEqual([1 * 17 + 5, 1 * 17 + 4, 1 * 17 + 3]);
    expect(p.x / 256).toBe(31 + 48);
  });
});
