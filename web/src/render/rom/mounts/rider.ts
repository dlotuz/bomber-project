// Jogador montado, montando, desmontando/remontando ou dançando (T14, spec §7.4).
import type { Player } from '../../../core/types';
import type { RomAssets } from '../../../rom/types';
import type { AnimFrame, Piece } from '../../../rom/types';
import type { ObjEntry } from '../../ppu/types';
import type { RomPlayerHook } from '../../battle-layers';
import { rider } from '../../../core/mounts/types';
import {
  RIDER_ANIMS, MOUNT_ANIMS, MOUNTING_ANIMS, MOUNTING_MOUNT_ANIMS, DISMOUNT_ANIMS,
  REMOUNT_ANIMS, REMOUNT_MOUNT_ANIMS, DANCE_ANIMS, MOUNT_GFX,
} from './facts';
import { sampleSeq, piecePx, fallbackMountFrame, COMMON_BASE_TILE } from './gfx';

/** Paleta OBJ do slot do jogador (P1..P5), [ANI/spec §7.4]. */
const PLAYER_OBJ_PAL = [0, 1, 4, 5, 6] as const;
/** Paleta OBJ dos objetos comuns (ovo/decoração), igual à de ovo/reserva/projétil [spec §7.2]. */
const COMMON_PAL = 7;

function dirIdxOf(face: number): 0 | 1 | 2 | 3 {
  return (((face >> 1) & 3) as 0 | 1 | 2 | 3);
}

/** `mx`/`my` do quadro somam à posição da peça — deslocamento só visual [spec §7.4]. É o que faz o jogador "pular"
 *  durante `mounting`/`remount` (a montaria fica parada porque seu próprio quadro, congelado, tem `mx=my=0`). */
function pxEntry(px: Uint8Array, X: number, Y: number, pal: number, fr: AnimFrame, piece: Piece): ObjEntry {
  return { x: X + piece.dx + fr.mx, y: Y + piece.dy + fr.my, size: piece.big ? 32 : 16, pal, prio: 2, hflip: piece.hflip, vflip: piece.vflip, src: { px } };
}

/** Todas as peças do quadro (não só a 1ª): `tile >= COMMON_BASE_TILE` é sempre objeto comum (`objCommon`, paleta
 *  OBJ 7 — mesma regra de `sprites.ts` para ovo/reserva/projétil); as demais usam o papel do chamador (personagem
 *  ou montaria) com a paleta do slot/vaga. Fix round 2 (T14): nenhuma tabela medida hoje empacota mais de 1 peça
 *  por quadro (conferido com `ASSETS.anim(addr)` em todas as tabelas de personagem/montaria) — as peças extras da
 *  fixture da T4 (dança, remonte) são objetos OAM separados que a T4 agregou por raio, não peças destes quadros;
 *  ver relatório da T14. Este código já trata corretamente qualquer peça extra que uma tabela venha a empacotar. */
function entriesFor(a: RomAssets, stage: number, X: number, Y: number, fr: AnimFrame, role: 'char' | 'mount', roleId: number, rolePal: number): ObjEntry[] {
  const ctx = role === 'char' ? { role: 'char' as const, char: roleId, stage } : { role: 'mount' as const, type: roleId, stage };
  return fr.pieces.map(piece => {
    const pal = piece.tile >= COMMON_BASE_TILE ? COMMON_PAL : rolePal;   // piecePx() redireciona a peça (tile absoluto) para objCommon
    return pxEntry(piecePx(a, piece, ctx), X, Y, pal, fr, piece);
  });
}

function charPieces(a: RomAssets, stage: number, p: Player, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  return entriesFor(a, stage, X, Y, fr, 'char', p.char, pal);
}

/** Plano B: `MOUNT_GFX[type].format === 'unknown'` — varrer a ROM pelos `pxSha1` medidos não é permitido em tempo
 *  de execução (spec §"Plano B" da T14). A montaria sai da arte por código do fallback (`fallbackMountFrame`), com
 *  a posição/tamanho do próprio fallback (ignora `fr`: não há quadro de ROM confiável para essa montaria). */
function mountPieces(a: RomAssets, stage: number, type: number, face: 0 | 2 | 4 | 6, step: 0 | 1, X: number, Y: number, pal: number, fr: AnimFrame): ObjEntry[] {
  if (MOUNT_GFX[type].format === 'unknown') {
    const { px } = fallbackMountFrame(type, face, step);
    return [{ x: X - 16, y: Y - 18, size: 32, pal, prio: 2, hflip: false, vflip: false, src: { px } }];
  }
  return entriesFor(a, stage, X, Y, fr, 'mount', type, pal);
}

// `frame` = visualTick (5º argumento, tick do core congelado no TIME UP; sem ele, o quadro do host) — base de `actT0`/`t0` (T16).
export const riderHook: RomPlayerHook = (s, p, a, hostFrame, frame = hostFrame) => {
  const r = rider(p);
  const X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256);
  const pal = PLAYER_OBJ_PAL[p.slot] ?? 0;

  if (!r) {
    if (p.act !== 'dance') return null;
    const t = frame - p.actT0;
    const { frame: fr } = sampleSeq(a, DANCE_ANIMS, t);
    return charPieces(a, s.stage, p, X, Y, pal, fr);
  }

  const mountPal = 1 + (r.slot || 1);
  const face = (p.face & 6) as 0 | 2 | 4 | 6;
  const step: 0 | 1 = p.moveDir !== 8 ? ((frame >> 3) & 1) as 0 | 1 : 0;

  if (r.phase === 'riding') {
    const dirIdx = dirIdxOf(p.face);
    const walking = p.moveDir !== 8;
    const riderList = walking ? RIDER_ANIMS[r.type][dirIdx].walk : RIDER_ANIMS[r.type][dirIdx].idle;
    const mountList = walking ? MOUNT_ANIMS[r.type][dirIdx].walk : MOUNT_ANIMS[r.type][dirIdx].idle;
    const t = frame - p.actT0;
    const rf = sampleSeq(a, riderList, t).frame, mf = sampleSeq(a, mountList, t).frame;
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
  }

  const t = frame - r.t0;
  if (r.phase === 'mounting') {
    const rf = sampleSeq(a, MOUNTING_ANIMS[r.type], t).frame;
    const mf = sampleSeq(a, MOUNTING_MOUNT_ANIMS[r.type], t).frame;
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
  }

  // dismount
  if (r.remount) {
    const rf = sampleSeq(a, REMOUNT_ANIMS, t).frame;
    const mf = sampleSeq(a, REMOUNT_MOUNT_ANIMS, t).frame;
    return [...charPieces(a, s.stage, p, X, Y, pal, rf), ...mountPieces(a, s.stage, r.type, face, step, X, Y, mountPal, mf)];
  }
  const rf = sampleSeq(a, DISMOUNT_ANIMS, t).frame;
  return charPieces(a, s.stage, p, X, Y, pal, rf);
};
