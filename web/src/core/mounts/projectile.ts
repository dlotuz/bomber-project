import type { RoundState, Player } from '../types';
import { mstate, type MountProjectile, type ProjKind } from './types';
import { cellOf, cellAt, GRID_W, GRID_H, colOf, linOf, centerX, centerY } from './core-api';

export interface ProjSpec { speed: number; reach: number }             // 1/256 px
export type ProjResult = { kind: 'none' } | { kind: 'player'; slot: number } | { kind: 'block'; cell: number };

export const SPAWN_REACH = 16 * 256;
export const LANE = 8 * 256;
export const D_SPEC: ProjSpec = { speed: 512, reach: 12 * 256 };
export const E_SPEC: ProjSpec = { speed: 512, reach: 11 * 256 };
export const F_SPEC: ProjSpec = { speed: 128, reach: 128 };

const AX: Record<number, readonly [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

export function spawnProjectile(s: RoundState, owner: Player, kind: ProjKind, slot: 0 | 1 | 2 = 0): MountProjectile {
  const ms = mstate(s);
  const pr: MountProjectile = { id: ms.nextId++, kind, owner: owner.slot, x: owner.x, y: owner.y, dir: owner.face, born: s.tick, state: 'fly', t: s.tick, slot };
  ms.projectiles.push(pr);
  return pr;
}

export function hasFlying(s: RoundState, owner: number, kind: ProjKind): boolean {
  return mstate(s).projectiles.some(pr => pr.owner === owner && pr.kind === kind && pr.state === 'fly');
}

function hitPlayer(s: RoundState, pr: MountProjectile, reach: number): number {
  const [ux] = AX[pr.dir];
  for (const q of s.players) {
    if (!q.present || q.state !== 'alive' || q.slot === pr.owner) continue;
    const dx = q.x - pr.x, dy = q.y - pr.y;
    const along = ux !== 0 ? dx : dy, across = ux !== 0 ? dy : dx;
    if (Math.abs(along) <= reach && Math.abs(across) < LANE) return q.slot;
  }
  return -1;
}

export function advanceProjectile(s: RoundState, pr: MountProjectile, spec: ProjSpec): ProjResult {
  const k = s.tick - pr.born;
  if (k === 1) {
    const q0 = hitPlayer(s, pr, SPAWN_REACH);
    if (q0 >= 0) return { kind: 'player', slot: q0 };
  }
  const [ux, uy] = AX[pr.dir];
  pr.x += ux * spec.speed;
  pr.y += uy * spec.speed;
  const q = hitPlayer(s, pr, spec.reach);
  if (q >= 0) return { kind: 'player', slot: q };
  const c = cellAt(pr.x, pr.y);
  const col = colOf(c), lin = linOf(c);
  const ccx = centerX(col), ccy = centerY(lin);
  const past = ux > 0 ? pr.x >= ccx : ux < 0 ? pr.x <= ccx : uy > 0 ? pr.y >= ccy : pr.y <= ccy;
  if (past) {
    const nc = col + ux, nl = lin + uy;
    const blocked = nc < 0 || nc >= GRID_W || nl < 0 || nl >= GRID_H || (s.grid[cellOf(nc, nl)] & 0x8000) !== 0;
    if (blocked) {
      if (ux !== 0) pr.x = ccx; else pr.y = ccy;
      return { kind: 'block', cell: c };
    }
  }
  return { kind: 'none' };
}
