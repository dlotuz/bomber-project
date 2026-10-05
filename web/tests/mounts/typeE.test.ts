import { mkRound, placePx, ride, run, firstTick, BTN } from './helpers';
import { mstate } from '../../src/core/mounts/types';
import { SHOT_COOLDOWN } from '../../src/core/mounts/projectile';

/** Regra da casa: espera depois que a nuvem some (SHOT_COOLDOWN, + 1 tick da contagem); os limiares medidos no
 *  original ganham esse tanto. */
const W = SHOT_COOLDOWN + 1;

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
  it('um tiro por vez (+$C6, $C2:46D0): sem alvo, nuvem na parede em 95 → Y em 134 não atira, em 135 atira', () => {
    // Ajuste C: a ROM não tem recarga de 64 ticks; o +$C6 só zera quando a nuvem some (medido: 91 → 131, 11 → 51).
    const shotAt = (k: number): boolean => {
      const s = mkRound();
      const p = placePx(s, 0, 32, 47 + 16 * 4); p.face = 2;   // linha 5 livre: parede em k = 95
      ride(s, 0, 0xe);
      run(s, 1, { 0: BTN.Y });
      expect(mstate(s).projectiles).toHaveLength(1);
      run(s, k - 1);
      run(s, 1, { 0: BTN.Y });
      return mstate(s).projectiles.some(pr => pr.born === s.tick);
    };
    expect(shotAt(30)).toBe(false);
    expect(shotAt(70)).toBe(false);
    expect(shotAt(134 + W)).toBe(false);
    expect(shotAt(135 + W)).toBe(true);
  });
  it('acerto a 2 casas (nuvem em 11): Y em 50 não atira, em 51 atira', () => {
    const shotAt = (k: number): boolean => {
      const { s } = shoot(64);
      run(s, k - 1);
      run(s, 1, { 0: BTN.Y });
      return mstate(s).projectiles.some(pr => pr.born === s.tick);
    };
    expect([shotAt(50 + W), shotAt(51 + W)]).toEqual([false, true]);
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
