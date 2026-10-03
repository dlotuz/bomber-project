import type { MountModule } from '../hooks';
import type { Player } from '../types';
import { mountAiHints } from '../ai/mounts';
import { ABILITIES } from './abilities';
import { tickSweeps } from './abilities/type5';
import { revealEgg, stepOnEgg, stealReserves } from './eggs';
import { onHit, tickRiders } from './rider';
import { mstate, rider, EGG_BURST_TICKS, type MountRider } from './types';

function riding(p: Player): MountRider | null {
  const r = rider(p);
  return r && r.phase === 'riding' ? r : null;
}

export const mountModule: MountModule = {
  revealEgg,
  stepOnEgg,
  onHit,
  onY(s, p, ev) {
    const r = riding(p);
    const ab = r ? ABILITIES[r.type] : undefined;
    return r && ab?.onY ? ab.onY(s, p, r, ev) : false;
  },
  yEndsTick(p) { const r = riding(p); return !!(r && ABILITIES[r.type]?.yEndsTick); },
  passes(p, code) { const r = riding(p); return !!(r && ABILITIES[r.type]?.passes?.(p, code)); },
  bombType(p) { const r = riding(p); return r ? ABILITIES[r.type]?.bombType?.(p) ?? null : null; },
  kicks(p) { const r = riding(p); return !!(r && ABILITIES[r.type]?.kicks?.(p)); },
  bombFire(p) { const r = riding(p); return r ? ABILITIES[r.type]?.fire?.(p) ?? null : null; },
  speedLevel(p) { const r = riding(p); return r ? ABILITIES[r.type]?.speed?.(p) ?? null : null; },
  drive(s, p, ev) { const r = riding(p); return !!(r && ABILITIES[r.type]?.drive?.(s, p, r, ev)); },
  tick(s, ev) {
    tickRiders(s, ev);
    if (s.phase !== 'play') return;                       // L16
    stealReserves(s, ev);
    const ms = mstate(s);
    for (const pr of ms.projectiles) {
      if (pr.state === 'done' || pr.born === s.tick) continue;
      ABILITIES[pr.kind]?.tickProjectile?.(s, pr, ev);
    }
    ms.projectiles = ms.projectiles.filter(pr => pr.state !== 'done');
    tickSweeps(s);
    ms.bursts = ms.bursts.filter(b => s.tick - b.t0 < EGG_BURST_TICKS);   // L22: fim da explosão = DEC $1ED4
  },
  ai: mountAiHints,
};
