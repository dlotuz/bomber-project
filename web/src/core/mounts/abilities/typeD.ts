import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, D_SPEC } from '../projectile';
import { loseMount } from '../rider';
import { cellAt, explodeAt } from '../core-api';
import { mev } from '../events';

export const D_RANGE = 2;   // fogo 0 (spec §12 A8)

/** Tipo D: Y lança a própria montaria ($C1:3238 → $C1:32EA). */
export const ABILITY_D: MountAbility = {
  type: 0xd,
  onY(s, p, r, ev) {
    const slot = r.slot;
    spawnProjectile(s, p, 0xd, slot);
    loseMount(s, p, r, ev, 'launch');
    if (r.remount) r.slot = slot === 1 ? 2 : 1;
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xd }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    const res = advanceProjectile(s, pr, D_SPEC);
    if (res.kind === 'none') return;
    if (res.kind === 'player') ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xd }));
    explodeAt(s, cellAt(pr.x, pr.y), D_RANGE, pr.owner, ev);
    pr.state = 'done'; pr.t = s.tick;
  },
};
