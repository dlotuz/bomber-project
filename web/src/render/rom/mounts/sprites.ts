// Ovos na grade, reservas e projéteis (T14, spec §7.2, §7.4; "Armadilha" da T14: ovo é objeto X=16·col, Y=16·(lin+2)).
import type { RoundState } from '../../../core/types';
import type { RomAssets, Piece, AnimFrame } from '../../../rom/types';
import type { ObjEntry } from '../../ppu/types';
import { rider, EGG_BURST_TICKS, type MountState } from '../../../core/mounts/types';
import { isEggCode } from '../../../core/mounts/core-api';
import { EGG_ANIMS, RESERVE_EGG_ANIMS, PROJ_ANIMS, REMOUNT_GLOW_ANIMS } from './facts';
import { sampleSeq, piecePx, cellXY } from './gfx';

const EGG_PAL = 7;   // paleta comum (bomba/itens/ovos), medida pal:7 em todas as peças de ovo/reserva/projétil

/** Leitura sem efeito colateral (mesma regra da camada de fallback, T5): nunca criar `s.mountState` ao desenhar. */
const projectilesOf = (s: RoundState) => (s.mountState as MountState | null)?.projectiles ?? [];
const burstsOf = (s: RoundState) => (s.mountState as MountState | null)?.bursts ?? [];

export interface MountSprite { e: ObjEntry; sortY: number }

/** Peças "comuns" (ovo/reserva/projétil, e T14b: notas da dança/brilho do remonte): `piece.tile` é um número de
 *  tile literal em `objCommon` (não um quadro `g` de personagem/montaria), paleta OBJ 7 [spec §7.2]. Exportada
 *  porque `rider.ts` (T14b) reaproveita para as notas/brilho, que são objetos comuns ancorados no jogador. */
export function commonPieces(a: RomAssets, stage: number, X: number, Y: number, fr: AnimFrame): MountSprite[] {
  return fr.pieces.map((piece: Piece) => ({
    e: {
      x: X + piece.dx + fr.mx, y: Y + piece.dy + fr.my, size: (piece.big ? 32 : 16) as 16 | 32, pal: EGG_PAL, prio: 2 as const,
      hflip: piece.hflip, vflip: piece.vflip, src: { px: piecePx(a, piece, { role: 'common', stage }) },
    },
    sortY: Y,
  }));
}

export function mountRomSprites(s: RoundState, a: RomAssets, frame: number): MountSprite[] {
  const out: MountSprite[] = [];

  // Ovos na grade (revelados, ainda não pegos). Sem `t0` próprio (o core não guarda quando cada ovo apareceu):
  // usa `s.phaseT0` (início da fase atual) como referência, igual para todos os ovos da grade.
  for (let cell = 0; cell < s.grid.length; cell++) {
    if (!isEggCode(s.grid[cell])) continue;
    const { X, Y } = cellXY(cell);
    const { frame: fr } = sampleSeq(a, EGG_ANIMS, frame - s.phaseT0);
    out.push(...commonPieces(a, s.stage, X, Y, fr));
  }

  // Reservas (1 casa atrás do dono, `trail[i+1]`; a montaria/jogador ativo já vem do `riderHook`).
  for (const p of s.players) {
    const r = rider(p);
    if (!r || !r.reserves.length) continue;
    const ownCell = r.trail[0];
    const t = frame - r.t0;
    const { frame: fr } = sampleSeq(a, RESERVE_EGG_ANIMS, t);
    r.reserves.forEach((_type, i) => {
      const cell = r.trail[i + 1] ?? ownCell;
      if (cell === undefined) return;
      const { X, Y } = cellXY(cell);
      out.push(...commonPieces(a, s.stage, X, Y, fr));
    });
  }

  // L22: reserva queimada — a explosão do ovo ($D8:D327 = REMOUNT_GLOW_ANIMS[2], 4 × 10 ticks) na casa da reserva.
  for (const b of burstsOf(s)) {
    const t = frame - b.t0;
    if (t < 0 || t >= EGG_BURST_TICKS) continue;
    const { X, Y } = cellXY(b.cell);
    const { frame: fr } = sampleSeq(a, [REMOUNT_GLOW_ANIMS[2]], t);
    out.push(...commonPieces(a, s.stage, X, Y, fr));
  }

  // Projéteis (D em voo, E voo/nuvem, F).
  for (const pr of projectilesOf(s)) {
    if (pr.state === 'done') continue;
    const X = Math.floor(pr.x / 256), Y = Math.floor(pr.y / 256);
    const t = frame - pr.born;
    const addrs = pr.kind === 0xd ? PROJ_ANIMS.d
      : pr.kind === 0xf ? PROJ_ANIMS.f
      : [pr.state === 'cloud' ? (PROJ_ANIMS.e[1] ?? PROJ_ANIMS.e[0]) : PROJ_ANIMS.e[0]];
    const { frame: fr } = sampleSeq(a, addrs, t);
    out.push(...commonPieces(a, s.stage, X, Y, fr));
  }

  return out;
}
