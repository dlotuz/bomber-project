import type { PlayerAct } from '../../../core/types';
import type { RomAssets } from '../../../rom/types';
import { sheetFrame } from '../../../rom/assets-char';
import type { ObjEntry } from '../../ppu';
import type { RomPlayerHook } from '../../battle-layers';
import { COSTUME_ANIMS, COSTUME_SHEETS, SHEET2 } from './facts';
import { sampleSeq } from './gfx';

const SLOT_PAL = [0, 1, 4, 5, 6];   // paleta OBJ por vaga (spec T14 "Paleta: jogador → OBJ do slot")
const NO_ANIM = new Set<PlayerAct>(['punch', 'pPunch', 'throw', 'dying']);   // sem entrada medida (L18)

/** Recorta 32×32 → topo-esquerda `size`×`size` (peças pequenas não ocorrem no traje medido; defensivo). */
function cropTL(full: Uint8Array, size: number): Uint8Array {
  if (size === 32) return full;
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y * size + x] = full[y * 32 + x];
  return out;
}

/** Gancho do traje da fase 10 (spec §5.3, L18): troca o desenho do jogador pela animação medida (T4).
 *  Não interfere se montado, morto/fora, sem traje, ou em ação sem entrada medida (soco, arremesso, morte) —
 *  nesses casos devolve `null` e o desenho padrão (plano 7) assume. */
// `frame` = visualTick (5º argumento, tick do core congelado no TIME UP; sem ele, o quadro do host) — base de `actT0` (T16).
export const costumeHook: RomPlayerHook = (_s, p, a: RomAssets, hostFrame, frame = hostFrame) => {
  if (p.costume < 0 || p.state !== 'alive' || p.mount || NO_ANIM.has(p.act)) return null;
  const c = p.costume & 7, dirIdx = (p.face >> 1) as 0 | 1 | 2 | 3;
  const kind = p.moveDir !== 8 ? 'walk' : 'idle';
  const addrs = COSTUME_ANIMS[c][dirIdx][kind];
  // Laço estável = só o ÚLTIMO endereço medido (o 1º de `walk` ↑/↓ é o quadro de transição da troca de animação,
  // ver ruling da T14 sobre o atraso de DMA); o amostrador é o mesmo das montarias (`sampleSeq`, T16).
  const f = sampleSeq(a, [addrs[addrs.length - 1]], frame - p.actT0).frame;
  const X = Math.floor(p.x / 256), Y = Math.floor(p.y / 256), pal = SLOT_PAL[p.slot] ?? 0;
  return f.pieces.map((pc): ObjEntry => {
    const sheet = pc.tile & 0x100 ? SHEET2 : COSTUME_SHEETS[c];
    const size = pc.big ? 32 : 16;
    const px = cropTL(sheetFrame(a.rom, sheet, pc.tile & 0xff), size);
    return { x: X + pc.dx, y: Y + pc.dy, size, pal: pal + pc.palAdd, prio: 2, hflip: pc.hflip, vflip: pc.vflip, src: { px } };
  });
};
