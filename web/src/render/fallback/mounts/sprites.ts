import type { Player, RoundState } from '../../../core/types';
import { invisibleVisible } from '../../../core/disease';
import type { Pix } from '../../art/pix';
import { rider, type MountState } from '../../../core/mounts/types';
import { cellAt, colOf, linOf } from '../../../core/mounts/core-api';
import { mountPix, eggPix, shotPix } from './art';
import { follower } from '../../anim/follow';

/** Leitura sem efeito colateral: a camada de desenho nunca deve criar `s.mountState` (isso é papel do
 *  `step()`/`mstate()` da simulação). Uma rodada sem montarias ainda não tocadas fica com `mountState` null. */
const projectilesOf = (s: RoundState) => (s.mountState as MountState | null)?.projectiles ?? [];
const burstsOf = (s: RoundState) => (s.mountState as MountState | null)?.bursts ?? [];

/** `front`: montaria de quem está montado — a camada `over` (`fallbackMountFrontLayer`) redesenha a parte de baixo
 *  dela por cima do cavaleiro (a montaria cobre a metade de baixo do jogador, como na ROM). */
export interface FbSprite { key: string; make: () => Pix; x: number; y: number; front?: boolean }

/** Mesmo predicado do desenhista de jogadores do fallback (`draw-game.ts`): vivo e invisível pela doença $29 ou
 *  piscando (inv & 2). Na ROM a montaria/o traje são parte do objeto do jogador e somem junto (revisão final I4). */
export const playerHidden = (p: Player): boolean => p.state === 'alive' && (!invisibleVisible(p) || (p.inv & 2) !== 0);

const cellXY = (cell: number) => ({ x: 16 * colOf(cell) - 8, y: 16 * linOf(cell) + 24 });
const reserveFollow = follower();
const faceOf = (d: number): 0 | 2 | 4 | 6 => ((d & 6) as 0 | 2 | 4 | 6);

export function fallbackMountSprites(s: RoundState, frame: number): FbSprite[] {
  const out: FbSprite[] = [];
  const egg = (cell: number, type: number, wob: number) => {
    const k: 0 | 1 = type >= 8 ? 1 : 0, f = wob;
    const { x, y } = cellXY(cell);
    out.push({ key: `egg:${k}:${f}`, make: () => eggPix(k, f), x: x + (f ? 1 : 0), y });
  };
  for (let c = 0; c < s.grid.length; c++) if ((s.grid[c] & 0xfff0) === 0x0970) egg(c, s.grid[c] & 0xf, 0);
  for (const p of s.players) {
    const r = rider(p);
    if (!r) continue;
    const here = cellAt(p.x, p.y), hidden = playerHidden(p);   // reservas e projéteis são objetos próprios: ficam
    if (r.phase === 'mounting') { if (!hidden) egg(here, r.type, (frame >> 3) & 1); continue; }
    if (r.phase === 'dismount') { if (r.remount && !hidden) egg(here, r.type, (frame >> 3) & 1); continue; }
    const st = p.moveDir !== 8 ? (frame >> 3) & 1 : 0, f = faceOf(p.face);
    if (!hidden) out.push({ key: `mount:${r.type}:${f}:${st}`, make: () => mountPix(r.type, f, st), x: Math.floor(p.x / 256) - 12, y: Math.floor(p.y / 256) - 12, front: true });
    const at = reserveFollow(r, p.x / 256, p.y / 256, frame);
    r.reserves.forEach((t, i) => {
      const c = cellXY(r.trail[i + 1] ?? here), q = at(i, c.x, c.y);
      out.push({ key: `egg:${t >= 8 ? 1 : 0}:0`, make: () => eggPix(t >= 8 ? 1 : 0, 0), x: q.x, y: q.y });
    });
  }
  // L22: reserva queimada — ovo piscando na casa enquanto o core mantém a explosão (EGG_BURST_TICKS).
  for (const b of burstsOf(s)) egg(b.cell, b.mount, (frame >> 3) & 1);
  for (const pr of projectilesOf(s)) {
    if (pr.state === 'done') continue;
    const x = Math.floor(pr.x / 256), y = Math.floor(pr.y / 256), a = (frame >> 2) & 1;
    if (pr.state === 'cloud' && pr.target !== undefined) continue;   // F no acerto: as notas saem no alvo
    if (pr.state === 'cloud') { out.push({ key: `shot:${pr.kind.toString(16)}:cloud`, make: () => shotPix(pr.kind, 'cloud', 0), x: x - 8, y: y - 6 }); continue; }
    if (pr.kind === 0xd) out.push({ key: `mount:13:${pr.dir}:${a}`, make: () => mountPix(0xd, pr.dir, a), x: x - 12, y: y - 12 });
    else if (pr.kind === 0xe) out.push({ key: 'shot:e:fly', make: () => shotPix(0xe, 'fly', 0), x: x - 4, y: y - 4 });
    else out.push({ key: `shot:f:fly:${a}`, make: () => shotPix(0xf, 'fly', a), x: x - 4, y: y - 10 + a });
  }
  return out;
}
