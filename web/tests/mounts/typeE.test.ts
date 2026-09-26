import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';

function shoot(targetPx: number) {
  const s = mkRound({ players: [0, 2] });
  const p = placePx(s, 0, 32, 47); p.face = 2;
  const q = placePx(s, 2, targetPx, 47);
  const r = ride(s, 0, 0xe);
  run(s, 1, { 0: BTN.Y });
  return { s, p, q, r };
}

describe('montaria tipo E (tanque): Y = tiro lento', () => {
  it('acerta alvos a 1, 2, 3, 4 casas em 3, 11, 19, 27 ticks (mount_e.py)', () => {
    const got = [1, 2, 3, 4].map(d => { const { s, q } = shoot(32 + 16 * d); return firstTick(s, 60, () => q.effect.kind === 2); });
    expect(got).toEqual([3, 11, 19, 27]);
  });
  it('alvo fica a 128/256 px por tick durante 253–256 ticks (effect {2, 64}; medido 255)', () => {
    const { s, q } = shoot(64);
    expect(firstTick(s, 60, () => q.effect.kind === 2)).toBe(11);
    expect(q.effect).toEqual({ kind: 2, left: 64 });
    let slowed = 1;
    for (let i = 0; i < 20; i++) {
      const x0 = q.x;
      run(s, 1, { 2: BTN.RIGHT });
      expect(q.x - x0).toBe(128);
      if (q.effect.kind === 2) slowed++;
    }
    while (q.effect.kind === 2 && slowed < 400) { run(s, 1); if (q.effect.kind === 2) slowed++; }
    expect(slowed).toBeGreaterThanOrEqual(253);
    expect(slowed).toBeLessThanOrEqual(256);
  });
  it('recarga de 64 ticks: Y antes disso não atira', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    const r = ride(s, 0, 0xe);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles).toHaveLength(1);
    expect(r.cooldown).toBe(64);
    run(s, 30);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles.filter(pr => pr.born === s.tick)).toHaveLength(0);
    run(s, 40);
    run(s, 1, { 0: BTN.Y });
    expect(mstate(s).projectiles.filter(pr => pr.born === s.tick)).toHaveLength(1);
  });
  it('sem alvo: voa até a parede (nuvem em k = 95, x = 224), a nuvem dura 40 ticks e some (medido)', () => {
    const s = mkRound();
    const p = placePx(s, 0, 32, 47); p.face = 2;
    ride(s, 0, 0xe);
    run(s, 1, { 0: BTN.Y });
    const pr = mstate(s).projectiles[0];
    run(s, 94);
    expect(pr.state).toBe('fly');
    run(s, 1);
    expect(pr.state).toBe('cloud');
    expect(pr.x).toBe(224 * 256);
    run(s, 39);
    expect(mstate(s).projectiles).toHaveLength(1);
    run(s, 1);
    expect(mstate(s).projectiles).toHaveLength(0);
  });
});
