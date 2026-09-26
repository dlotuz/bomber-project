import type { RoundState, Player, GameEvent } from '../types';
import { rider, MOUNTING_TICKS, DISMOUNT_TICKS, REMOUNT_TICKS, POST_INV, MAX_RESERVES, type MountRider } from './types';
import { cellAt, lockAct } from './core-api';
import { mev } from './events';

export function loseMount(s: RoundState, p: Player, r: MountRider, ev: GameEvent[], cause: 'hit' | 'launch'): void {
  const old = r.type;
  r.t0 = s.tick;
  r.phase = 'dismount';
  if (r.reserves.length > 0) {
    r.type = r.reserves.shift()!;
    r.remount = true;
    lockAct(s, p, 'dismount', REMOUNT_TICKS);
    ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: old, reserve: true, cause }));
  } else {
    r.remount = false;
    r.slot = 0;
    lockAct(s, p, 'dismount', DISMOUNT_TICKS);
    ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: old, reserve: false, cause }));
  }
}

export function onHit(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const r = rider(p);
  if (!r) return false;
  if (r.phase !== 'riding') return true;                  // L1
  loseMount(s, p, r, ev, 'hit');
  return true;
}

/** Atordoamento (§3.10, L15): a montaria é a perda "montaria ou traje"; some com as reservas, sem voar. */
export function onStunLoss(s: RoundState, p: Player, ev: GameEvent[]): boolean {
  const r = rider(p);
  if (!r || r.phase !== 'riding') return false;
  p.mount = null;
  ev.push(mev({ id: 'mount_lost', slot: p.slot, mount: r.type, reserve: false, cause: 'stun' }));
  return true;
}

function updateTrail(p: Player, r: MountRider): void {
  const c = cellAt(p.x, p.y);
  if (r.trail[0] !== c) {
    r.trail.unshift(c);
    if (r.trail.length > MAX_RESERVES + 1) r.trail.length = MAX_RESERVES + 1;
  }
}

export function tickRiders(s: RoundState, ev: GameEvent[]): void {
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    if (p.state !== 'alive') { p.mount = null; continue; }
    if (r.cooldown > 0) r.cooldown--;
    const k = s.tick - r.t0;
    if (r.phase === 'mounting' && k >= MOUNTING_TICKS - 1) {
      r.phase = 'riding'; r.t0 = s.tick;
      ev.push(mev({ id: 'mount_ready', slot: p.slot, mount: r.type }));
    } else if (r.phase === 'dismount' && r.remount && k >= REMOUNT_TICKS) {
      r.phase = 'riding'; r.remount = false; r.t0 = s.tick; p.inv = POST_INV;
      ev.push(mev({ id: 'mount_ready', slot: p.slot, mount: r.type }));
    } else if (r.phase === 'dismount' && !r.remount && k >= DISMOUNT_TICKS) {
      p.mount = null; p.inv = POST_INV;
      continue;
    }
    if (r.phase === 'riding') updateTrail(p, r);
  }
}
