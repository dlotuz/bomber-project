import { BURN, px, type Player, type RoundState } from '../../core';
import type { FlamePieceName, GridBomb, PressureDrop, RomMemo, RomScene, SceneObj } from './scene';

/** Índice = valor de FLAME_PIECE do núcleo (plano 6). */
export const FLAME_NAMES: readonly FlamePieceName[] = ['center', 'armU', 'armR', 'armD', 'armL', 'tipU', 'tipR', 'tipD', 'tipL'];
/** Altura da bomba nos 4 ticks do levantamento da luva (ANI §5.2). */
export const LIFT_Z = [6, 10, 14, 16] as const;
/** Deslocamento lateral (px, para o lado em que se olha) no levantar, nos mesmos ticks de `LIFT_Z`. */
export const LIFT_DX = [4, 8, 4, 0] as const;

/** Bomba na mão da luva, como o SB4 a desenha (medido no emulador, objeto da bomba `$C1:2416` → `$C1:243F`, animações
 *  por direção `$C1:24C3/CA/D1/D8`): k = tick − actT0 do levantar.
 *  - k = 0 (o tick do A): a bomba sai do BG2 e ainda não vira objeto — não aparece (null).
 *  - k = 1..4: sobe 6, 10, 14, 16 px; olhando para o lado, vai 4, 8, 4, 0 px para esse lado.
 *  - depois (e andando/parado com ela): 16 px acima; olhando para o lado, 4 px para esse lado.
 *  - ordem (chave `+$26` da lista da OAM): Y de quem segura + 8 (na FRENTE dele) olhando para baixo/lado; − 8 (atrás)
 *    olhando para cima.
 *  Usada por todos os desenhos (ROM, fallback, arte HD) e pela cor da bomba (fx). */
export interface HeldPose { dx: number; z: number; front: boolean }
export function heldBombPose(p: Player, tick: number): HeldPose | null {
  const side = p.face === 2 ? 1 : p.face === 6 ? -1 : 0, front = p.face !== 0;
  if (p.act !== 'lift') return { dx: 4 * side, z: 16, front };
  const k = Math.max(0, tick - p.actT0);
  if (k === 0) return null;
  if (k <= 4) return { dx: LIFT_DX[k - 1] * side, z: LIFT_Z[k - 1], front };
  return { dx: 4 * side, z: 16, front };
}
/** Chave de ordem da bomba na mão (a do jogador é o Y dele): na frente (+8) ou atrás (−8) de quem segura. */
export const heldSortY = (p: Player, pose: HeldPose): number => px(p.y) + (pose.front ? 8 : -8);

function heldAt(s: RoundState, id: number, owner: number, tick: number): SceneObj | null {
  const p = s.players.find(q => q.present && q.carry === id);
  if (p) {
    const pose = heldBombPose(p, tick);
    return pose && { kind: 'bomb', item: 0, x: px(p.x) + pose.dx, y: px(p.y), z: pose.z, sortY: heldSortY(p, pose) };
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
    if (f.kind === 'player') continue;   // o próprio jogador é desenhado com a altura p.z (sprites.ts)
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
