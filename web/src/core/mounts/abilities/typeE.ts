import type { MountAbility } from '../types';
import { spawnShot, advanceProjectile, shotBlocked, E_SPEC, SHOT_END_TICKS, endShot } from '../projectile';
import { mev } from '../events';

export const E_CLOUD = SHOT_END_TICKS;   // $C1:2EB6 por 39 ticks + $C3:50E8 por 1 (medido; sem limite de voo, L7)

/** Tipo E: tiro lento ($C1:2CFF/$C1:2D73 → nuvem $C1:2EB6).
 *  Um tiro por vez ($C2:46D0): o +$C6 do dono é um "tiro em jogo" (0/1), não uma recarga; só zera quando a nuvem
 *  some ($C1:2ECA). Ajuste C: os 64 ticks da spec (A8) não existem na ROM — medido, novo tiro em fim + 40. */
export const ABILITY_E: MountAbility = {
  type: 0xe,
  onY(s, p, _r, ev) {
    if (shotBlocked(s, p, 0xe)) return true;   // um por vez + espera (SHOT_COOLDOWN)
    spawnShot(s, p, 0xe);
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xe }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    if (pr.state === 'cloud') { if (s.tick - pr.t >= E_CLOUD) endShot(s, pr); return; }
    const res = advanceProjectile(s, pr, E_SPEC);
    if (res.kind === 'player') {
      s.players[res.slot].effect = { kind: 2, left: 64 };
      ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xe }));
    }
    if (res.kind !== 'none') { pr.state = 'cloud'; pr.t = s.tick; }
  },
};
