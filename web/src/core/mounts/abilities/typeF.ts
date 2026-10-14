import type { MountAbility } from '../types';
import { spawnShot, advanceProjectile, shotInPlay, F_SPEC, SHOT_END_TICKS } from '../projectile';
import { lockAct } from '../core-api';
import { mev } from '../events';

export const F_FLIGHT = 159;    // o voo acaba em k = 159 (80 px; 5 casas de 32 ticks, $C1:3067), medido (L7)
// $C0 = 192 ticks de dança ($C2:0DDC; ROM: atingido no 79, livre no 271 — vs_F_Y_72). lockAct(t) deixa o jogador
// livre em T + t, como o stun do plano 6 (STUN_TICKS); p.act vira 'idle' 1 tick antes (convenção do tickAct, só
// visual). Revisão final do plano 9 (I3): o 193 da T13 soltava no 272.
export const DANCE_TICKS = 192;

/** Tipo F: notas musicais ($C1:2F21); atingido dança ($C2:0D83 → $C2:0DDC).
 *  Uma nota por vez ($C2:471E): o Y só lança com o +$C6 do dono zerado, e ele só zera quando o objeto final da nota
 *  ($C1:30FC + $C3:50E8, 40 ticks) some — o estado 'cloud' aqui, mesmo sem nada desenhado no acerto.
 *  No acerto a nota acaba no tick k (objeto final em k, medido 78 para o alvo a 72 px) e o alvo só entra na dança
 *  em k + 1 (79): a ROM grava o efeito no jogador ($C1:30C4) e ele reage no quadro seguinte. */
export const ABILITY_F: MountAbility = {
  type: 0xf,
  onY(s, p, _r, ev) {
    if (shotInPlay(s, p.slot, 0xf)) return true;
    spawnShot(s, p, 0xf);
    ev.push(mev({ id: 'mount_ability', slot: p.slot, mount: 0xf }));
    return true;
  },
  tickProjectile(s, pr, ev) {
    if (pr.state === 'cloud') {
      if (pr.target !== undefined && s.tick - pr.t === 1) {
        const q = s.players[pr.target];
        if (q.state === 'alive') {
          lockAct(s, q, 'dance', s.rules.sleepTicks ?? DANCE_TICKS);   // extra: duração configurável
          ev.push(mev({ id: 'mount_struck', slot: pr.owner, target: pr.target, mount: 0xf }));
        }
      }
      if (s.tick - pr.t >= SHOT_END_TICKS) pr.state = 'done';
      return;
    }
    const res = advanceProjectile(s, pr, F_SPEC);
    if (res.kind === 'player') pr.target = res.slot;
    if (res.kind !== 'none' || s.tick - pr.born >= F_FLIGHT) { pr.state = 'cloud'; pr.t = s.tick; }
  },
};
