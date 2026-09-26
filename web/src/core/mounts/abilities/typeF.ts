import type { MountAbility } from '../types';
import { spawnProjectile, advanceProjectile, hasFlying, F_SPEC } from '../projectile';
import { lockAct } from '../core-api';
import { mev } from '../events';

export const F_FLIGHT = 159;    // o voo acaba em k = 159 (80 px), medido (L7)
// $C0 = 192 ticks de dança medidos (ROM: tick 79 ao 270, livre no 271). Desvio do brief: lockAct desconta 1
// (p.act já mostra o valor livre no último tick travado — core-api.test.ts/eggs.test.ts confirmam a convenção),
// então para 192 ticks *visíveis* de 'dance' é preciso passar 193 aqui. Conferido no emulador (vs_F_Y_72).
export const DANCE_TICKS = 193;

/** Tipo F: notas musicais ($C1:2F21); atingido dança ($C2:0D83 → $C2:0DDC). */
export const ABILITY_F: MountAbility = {
  type: 0xf,
  onY(s, p, _r, ev) {
    if (hasFlying(s, p.slot, 0xf)) return true;
    spawnProjectile(s, p, 0xf);
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xf }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    const res = advanceProjectile(s, pr, F_SPEC);
    if (res.kind === 'player') {
      lockAct(s, s.players[res.slot], 'dance', DANCE_TICKS);
      ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: res.slot, mount: 0xf }));
    }
    if (res.kind !== 'none' || s.tick - pr.born >= F_FLIGHT) { pr.state = 'done'; pr.t = s.tick; }
  },
};
