import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, E_SPEC } from '../projectile';
import { mev } from '../events';

export const E_COOLDOWN = 64;   // +$C6 (spec §12 A8)
export const E_CLOUD = 40;      // $C1:2EB6 por 39 ticks + $C3:50E8 por 1 (medido; sem limite de voo, L7)

/** Tipo E: tiro lento ($C1:2CFF/$C1:2D73 → nuvem $C1:2EB6). */
export const ABILITY_E: MountAbility = {
  type: 0xe,
  onY(s, p, r, ev) {
    if (r.cooldown > 0) return true;
    spawnProjectile(s, p, 0xe);
    r.cooldown = E_COOLDOWN + 1;   // tickRiders desconta 1 ainda neste tick: depois do tick do Y vale 64
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xe }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    if (pr.state === 'cloud') { if (s.tick - pr.t >= E_CLOUD) pr.state = 'done'; return; }
    const res = advanceProjectile(s, pr, E_SPEC);
    if (res.kind === 'player') {
      s.players[res.slot].effect = { kind: 2, left: 64 };
      ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xe }));
    }
    if (res.kind !== 'none') { pr.state = 'cloud'; pr.t = s.tick; }
  },
};
