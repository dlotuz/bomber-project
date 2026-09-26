import type { MountModule } from '../hooks';
import type { Player } from '../types';
import { mountAiHints } from '../ai/mounts';
import { ABILITIES } from './abilities';
import { revealEgg, stepOnEgg } from './eggs';
import { onHit, onStunLoss, tickRiders } from './rider';
import { mstate, rider, type MountRider } from './types';

function riding(p: Player): MountRider | null {
  const r = rider(p);
  return r && r.phase === 'riding' ? r : null;
}

export const mountModule: MountModule = {
  revealEgg,
  stepOnEgg,
  onHit,
  onStunLoss,
  onY(s, p, ev) {
    const r = riding(p);
    const ab = r ? ABILITIES[r.type] : undefined;
    return r && ab?.onY ? ab.onY(s, p, r, ev) : false;
  },
  passes(p, code) { const r = riding(p); return !!(r && ABILITIES[r.type]?.passes?.(p, code)); },
  bombType(p) { const r = riding(p); return r ? ABILITIES[r.type]?.bombType?.(p) ?? null : null; },
  kicks(p) { const r = riding(p); return !!(r && ABILITIES[r.type]?.kicks?.(p)); },
  tick(s, ev) {
    tickRiders(s, ev);
    if (s.phase !== 'play') return;                       // L16
    const ms = mstate(s);
    for (const pr of ms.projectiles) {
      if (pr.state === 'done' || pr.born === s.tick) continue;
      ABILITIES[pr.kind]?.tickProjectile?.(s, pr, ev);
    }
    ms.projectiles = ms.projectiles.filter(pr => pr.state !== 'done');
  },
  ai: mountAiHints,
};
