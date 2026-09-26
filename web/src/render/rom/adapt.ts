import { BURN, px, type RoundState } from '../../core';
import type { FlamePieceName, GridBomb, PressureDrop, RomMemo, RomScene, SceneObj } from './scene';

/** Índice = valor de FLAME_PIECE do núcleo (plano 6). */
export const FLAME_NAMES: readonly FlamePieceName[] = ['center', 'armU', 'armR', 'armD', 'armL', 'tipU', 'tipR', 'tipD', 'tipL'];
/** Altura da bomba nos 4 ticks do levantamento da luva (ANI §5.2). */
export const LIFT_Z = [6, 10, 14, 16] as const;

function heldAt(s: RoundState, id: number, owner: number, tick: number): SceneObj | null {
  const p = s.players.find(q => q.present && q.carry === id);
  if (p) {
    const z = p.act === 'lift' ? LIFT_Z[Math.min(3, Math.max(0, tick - p.actT0))] : 16;
    return { kind: 'bomb', item: 0, x: px(p.x), y: px(p.y), z };
  }
  const b = s.bad.find(q => q.slot === owner);
  return b ? { kind: 'bomb', item: 0, x: b.x, y: b.y, z: 16 } : null;
}

export function readScene(s: RoundState, tick: number, memo: RomMemo): RomScene {
  const gridBombs = new Map<number, GridBomb>();
  const objs: SceneObj[] = [];
  for (const b of s.bombs) {
    if (b.state === 'idle') gridBombs.set(b.cell, { type: b.type, born: b.born });
    else if (b.state === 'kicked') objs.push({ kind: 'bomb', item: 0, x: px(b.x), y: px(b.y), z: 0 });
    else if (b.state === 'held') { const o = heldAt(s, b.id, b.owner, tick); if (o) objs.push(o); }
  }
  for (const f of s.flyers) {
    objs.push({ kind: f.kind, item: f.kind === 'item' ? f.ref : 0, x: px(f.x), y: px(f.y), z: Math.max(0, -f.z) });
  }
  const now: PressureDrop[] = s.pressure.falling.map(f => ({ cell: f.cell, t0: f.t0, land: f.land }));
  const tail = memo.recentDrops.filter(d => tick < d.land + 2 && !now.some(n => n.cell === d.cell && n.t0 === d.t0));
  const drops = [...now, ...tail].filter(d => tick < d.land + 2);
  memo.recentDrops = drops;
  return {
    gridBombs, objs, drops,
    flame: cell => FLAME_NAMES[s.cellAux[cell]] ?? 'center',
    burn: cell => (s.cellAux[cell] === BURN.ITEM ? 'item' : 'soft'),
    team: s.rules.mode === 'team',
  };
}
