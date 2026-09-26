// Jogador montado, montando, desmontando/remontando ou dançando (T14, spec §7.4).
import type { Player } from '../../../core/types';
import type { RomAssets } from '../../../rom/types';
import type { AnimFrame, Piece } from '../../../rom/types';
import type { ObjEntry } from '../../ppu/types';
import type { RomPlayerHook } from '../../battle-layers';
import { rider } from '../../../core/mounts/types';
import {
  RIDER_ANIMS, MOUNT_ANIMS, MOUNTING_ANIMS, MOUNTING_MOUNT_ANIMS, DISMOUNT_ANIMS,
  REMOUNT_ANIMS, REMOUNT_MOUNT_ANIMS, DANCE_ANIMS,
} from './facts';
import { sampleSeq, piecePx } from './gfx';

/** Paleta OBJ do slot do jogador (P1..P5), [ANI/spec §7.4]. */
const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;

function dirIdxOf(face: number): 0 | 1 | 2 | 3 {
  return (((face >> 1) & 3) as 0 | 1 | 2 | 3);
}

/** `mx`/`my` do quadro somam à posição da peça — deslocamento só visual [spec §7.4]. É o que faz o jogador "pular"
 *  durante `mounting`/`remount` (a montaria fica parada porque seu próprio quadro, congelado, tem `mx=my=0`). */
function pxEntry(px: Uint8Array, X: number, Y: number, pal: number, fr: AnimFrame, piece: Piece): ObjEntry {
  return { x: X + piece.dx + fr.mx, y: Y + piece.dy + fr.my, size: piece.big ? 32 : 16, pal, prio: 2, hflip: piece.hflip, vflip: piece.vflip, src: { px } };
}

/** Só a 1ª peça do quadro (a peça do papel — jogador ou montaria); ANI §1.2. Peças extras (efeitos/decoração
 *  raramente empacotados na mesma animação, ex.: DANCE_ANIMS, REMOUNT_ANIMS) não são reproduzidas (T14: não há
 *  fato da T4 sobre elas e não são cobertas pelo teste da tarefa — ver relatório). */
function firstPiece(fr: AnimFrame): Piece | null { return fr.pieces[0] ?? null; }

function charPieces(a: RomAssets, p: Player, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  const piece = firstPiece(fr);
  if (!piece) return [];
  return [pxEntry(piecePx(a, piece, { role: 'char', char: p.char }), X, Y, pal, fr, piece)];
}

function mountPieces(a: RomAssets, type: number, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  const piece = firstPiece(fr);
  if (!piece) return [];
  return [pxEntry(piecePx(a, piece, { role: 'mount', type }), X, Y, pal, fr, piece)];
}

export const riderHook: RomPlayerHook = (s, p, a, frame) => {
  const r = rider(p);
  const X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256);
  const pal = PLAYER_OBJ_PAL[p.slot] ?? 0;

  if (!r) {
    if (p.act !== 'dance') return null;
    const t = frame - p.actT0;
    const { frame: fr } = sampleSeq(a, DANCE_ANIMS, t);
    return charPieces(a, p, X, Y, pal, fr);
  }

  const mountPal = 1 + (r.slot || 1);

  if (r.phase === 'riding') {
    const dirIdx = dirIdxOf(p.face);
    const walking = p.moveDir !== 8;
    const riderList = walking ? RIDER_ANIMS[r.type][dirIdx].walk : RIDER_ANIMS[r.type][dirIdx].idle;
    const mountList = walking ? MOUNT_ANIMS[r.type][dirIdx].walk : MOUNT_ANIMS[r.type][dirIdx].idle;
    const t = frame - p.actT0;
    const rf = sampleSeq(a, riderList, t).frame, mf = sampleSeq(a, mountList, t).frame;
    return [...charPieces(a, p, X, Y, pal, rf), ...mountPieces(a, r.type, X, Y, mountPal, mf)];
  }

  const t = frame - r.t0;
  if (r.phase === 'mounting') {
    const rf = sampleSeq(a, MOUNTING_ANIMS[r.type], t).frame;
    const mf = sampleSeq(a, MOUNTING_MOUNT_ANIMS[r.type], t).frame;
    return [...charPieces(a, p, X, Y, pal, rf), ...mountPieces(a, r.type, X, Y, mountPal, mf)];
  }

  // dismount
  if (r.remount) {
    const rf = sampleSeq(a, REMOUNT_ANIMS, t).frame;
    const mf = sampleSeq(a, REMOUNT_MOUNT_ANIMS, t).frame;
    return [...charPieces(a, p, X, Y, pal, rf), ...mountPieces(a, r.type, X, Y, mountPal, mf)];
  }
  const rf = sampleSeq(a, DISMOUNT_ANIMS, t).frame;
  return charPieces(a, p, X, Y, pal, rf);
};
