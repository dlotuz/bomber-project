import type { RoundState, Player, GameEvent } from '../types';
import { rider, mstate, MAX_ACTIVE, MAX_RESERVES, MOUNTING_TICKS, type MountRider } from './types';
import { EGG_TYPES, rnd, lockAct, isEggCode } from './core-api';
import { mev } from './events';

export function eggsOnGrid(s: RoundState): number {
  let n = 0;
  for (const c of s.grid) if (isEggCode(c)) n++;
  return n;
}

/** $1ED4 derivado (L2). */
export function activeCount(s: RoundState): number {
  let n = eggsOnGrid(s);
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    if (r.phase !== 'dismount' || r.remount) n++;
    n += r.reserves.length;
  }
  for (const pr of mstate(s).projectiles) if (pr.kind === 0xd && pr.state === 'fly') n++;
  return n;
}

/** Menor vaga de sprite livre (L3). */
export function freeSlot(s: RoundState): 0 | 1 | 2 {
  const used = new Set<number>();
  for (const p of s.players) { const r = rider(p); if (r && r.slot) used.add(r.slot); }
  for (const pr of mstate(s).projectiles) if (pr.state !== 'done' && pr.slot) used.add(pr.slot);
  return !used.has(1) ? 1 : !used.has(2) ? 2 : 0;
}

export function revealEgg(s: RoundState, cell: number, ev: GameEvent[]): void {
  if (activeCount(s) >= MAX_ACTIVE) return;              // JML $C3:50C9: o bloco não dá nada
  const t = EGG_TYPES[rnd(s.rng, 14)];
  s.grid[cell] = 0x0970 + t;
  ev.push(mev({ id: 'egg_revealed', cell, mount: t }));
}

export function stepOnEgg(s: RoundState, p: Player, cell: number, ev: GameEvent[]): void {
  const code = s.grid[cell];
  if (!isEggCode(code) || p.state !== 'alive') return;
  const t = code & 0x0f;
  const r = rider(p);
  if (!r) {
    s.grid[cell] = 0;
    const nr: MountRider = { type: t, slot: freeSlot(s) || 1, phase: 'mounting', t0: s.tick, reserves: [], trail: [], cooldown: 0, remount: false, remountFx: null };
    p.mount = nr;
    lockAct(s, p, 'mounting', MOUNTING_TICKS);
    ev.push(mev({ id: 'mount_start', slot: p.slot, mount: t }));
    return;
  }
  if (r.phase === 'riding' && t < 8 && r.reserves.length < MAX_RESERVES) {
    s.grid[cell] = 0;
    r.reserves.push(t);
    ev.push(mev({ id: 'egg_reserved', slot: p.slot, mount: t }));
  }
}
