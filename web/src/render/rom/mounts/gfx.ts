// Utilidades de gráfico e amostragem de animação das montarias (T14, spec §7.4/§7.2, ANI §2.1).
import type { RomAssets, Tiles, Anim, AnimFrame, Piece } from '../../../rom/types';
import { decodeZte } from '../../../rom/decode/zte';
import { decodeTiles } from '../../../rom/decode/tiles';
import { sheetFrame } from '../../../rom/assets-char';
import { mountPix } from '../../fallback/mounts/art';
import { MOUNT_GFX } from './facts';

/** As peças "comuns" (ovo/reserva/projétil, `EGG_ANIMS`/`RESERVE_EGG_ANIMS`/`PROJ_ANIMS`, e qualquer peça extra que
 *  uma tabela de personagem/montaria venha a empacotar no mesmo quadro — T14 fix round 2) trazem `tile` pequeno
 *  (0..~230) quando vêm de uma tabela dedicada de objeto comum; o tile OBJ real em `objCommon` é `tile + 256`
 *  (conferido: fixture tile 258/300 = decodeAnim 2/44 + 256). Peças extras poderiam também trazer o tile já
 *  absoluto (>= 256): tratamos os dois casos (ver `piecePx`). */
export const COMMON_BASE_TILE = 256;

const gfxCache = new Map<number, Tiles>();

/** Tiles decodificados de `MOUNT_GFX[type]` (ZTE ou cru), em cache por tipo (T4: todos os 7 tipos são 'raw'). Não
 *  chame para um tipo com `format: 'unknown'` — nesse caso não há decodificação segura em tempo de execução
 *  (Plano B, ver `piecePx`/`PieceCtx`). */
export function mountGfx(a: RomAssets, type: number): Tiles {
  let t = gfxCache.get(type);
  if (!t) {
    const g = MOUNT_GFX[type];
    if (!g) throw new RangeError(`tipo de montaria inválido: ${type}`);
    if (g.format === 'unknown') throw new RangeError(`montaria ${type.toString(16)}: format 'unknown' (Plano B), sem tiles decodificáveis`);
    const bytes = g.format === 'zte' ? decodeZte(a.rom.data, g.src).data : a.rom.bytes(g.src, 0x4000);
    t = decodeTiles(bytes, 4);
    gfxCache.set(type, t);
  }
  return t;
}

/** Recorta uma peça `size`×`size` (16 ou 32) de `tiles` a partir do tile OBJ `baseTile + tile` (layout OBJ: `col =
 *  (n&15)+tx`, `row = (n>>4)+ty`, 16 tiles por linha — [ANI §1.4]). Usado para peças cujo campo `tile` é um número
 *  de tile literal (ovos, reservas, projéteis), ao contrário das peças do jogador/montaria (que usam `sheetFrame`
 *  com `tile` como quadro `g`). */
export function objPx(tiles: Tiles, baseTile: number, tile: number, size: 16 | 32): Uint8Array {
  const n = size / 8, out = new Uint8Array(size * size);
  for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
    const t = baseTile + tile + tx + 16 * ty;
    const off = t * 64;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
      out[(ty * 8 + y) * size + tx * 8 + x] = tiles.px[off + y * 8 + x] ?? 0;
  }
  return out;
}

/** Onde `piece.tile` procura o pixel: `char` → quadro `g` de `CharacterAssets.frame` (jogador); `mount` → quadro
 *  `g` de `MOUNT_GFX[type]` via `sheetFrame` (montaria); `common` → tile literal em `objCommon` (+`COMMON_BASE_TILE`,
 *  ovo/reserva/projétil). Toda peça carrega `stage` (para `objCommon`, que é por arena — ainda que arena-invariante
 *  nos tiles usados aqui). */
export type PieceCtx = ({ role: 'char'; char: number } | { role: 'mount'; type: number } | { role: 'common' }) & { stage: number };

/** Pixels (`size²` índices) de uma peça de metasprite, segundo o contexto (T14, spec §7.4).
 *  Fix round 2: qualquer peça com `tile >= COMMON_BASE_TILE` fora do papel `common` é tratada como objeto comum
 *  (`objCommon[tile − COMMON_BASE_TILE]`, paleta OBJ 7 — decidida por quem monta o `ObjEntry`, não aqui). Isso
 *  cobre peças extras que uma tabela de personagem/montaria (`RIDER_ANIMS`, `DANCE_ANIMS`, `REMOUNT_ANIMS`…) possa
 *  empacotar no mesmo quadro. **Nenhuma tabela medida hoje passa por este ramo**: conferi diretamente
 *  (`ASSETS.anim(addr)`) que toda tabela de personagem/montaria tem exatamente 1 peça por quadro — as peças extras
 *  visíveis na fixture da T4 durante `dance`/`remount` (notas, ovo brilhando) são objetos OAM independentes,
 *  agregados pela T4 por raio de captura (relatório da T4: "dança com raio 32… ovos/reserva/projéteis só tiles ≥
 *  $100"), não peças do mesmo quadro de `RIDER_ANIMS`/`DANCE_ANIMS`/`REMOUNT_ANIMS`. Ver relatório da T14. */
export function piecePx(a: RomAssets, piece: Piece, ctx: PieceCtx): Uint8Array {
  if (ctx.role !== 'common' && piece.tile >= COMMON_BASE_TILE)
    return objPx(a.arena(ctx.stage).objCommon, 0, piece.tile - COMMON_BASE_TILE, piece.big ? 32 : 16);
  if (ctx.role === 'char') return a.character(ctx.char).frame(piece.tile);
  if (ctx.role === 'mount') return sheetFrame(a.rom, MOUNT_GFX[ctx.type].src, piece.tile);
  return objPx(a.arena(ctx.stage).objCommon, COMMON_BASE_TILE, piece.tile, piece.big ? 32 : 16);
}

function rgbToBgr555(r: number, g: number, b: number): number {
  return ((b >> 3) << 10) | ((g >> 3) << 5) | (r >> 3);
}

/** Plano B (spec da T14, "se a T4 marcou `format: 'unknown'`"): varrer a ROM pelos `pxSha1` medidos não é permitido
 *  em tempo de execução, então a montaria sai da arte por código do fallback (`mountPix`, `render/fallback/mounts`)
 *  em vez da ROM. Converte o `Pix` RGBA (24×20) em índices de paleta (0 = transparente) centralizados num quadro
 *  32×32, e devolve também as até 15 cores usadas (BGR555; índice 0 = cor 0, sempre transparente/preto). Nenhum
 *  dos 7 tipos medidos está em `format: 'unknown'` hoje — existe para não quebrar se isso mudar. */
export function fallbackMountFrame(type: number, face: 0 | 2 | 4 | 6, step: 0 | 1): { px: Uint8Array; colors: Uint16Array } {
  const pix = mountPix(type, face, step);
  const out = new Uint8Array(32 * 32);
  const seen = new Map<string, number>();
  const colors: number[] = [];
  const ox = Math.floor((32 - pix.w) / 2), oy = Math.floor((32 - pix.h) / 2);
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    const o = (y * pix.w + x) * 4;
    if (pix.data[o + 3] === 0) continue;
    const key = `${pix.data[o]},${pix.data[o + 1]},${pix.data[o + 2]}`;
    let idx = seen.get(key);
    if (idx === undefined) {
      idx = colors.length < 15 ? colors.length + 1 : 15;
      if (idx === colors.length + 1) { colors.push(rgbToBgr555(pix.data[o], pix.data[o + 1], pix.data[o + 2])); }
      seen.set(key, idx);
    }
    out[(oy + y) * 32 + (ox + x)] = idx;
  }
  const cgram = new Uint16Array(16);
  colors.forEach((c, i) => { cgram[i + 1] = c; });
  return { px: out, colors: cgram };
}

export interface SeqSample { addr: number; frame: AnimFrame }

/** Amostra uma lista de animações [ANI §2.1, spec §7.4]: percorre os quadros pela duração; quando a lista tem mais
 *  de 1 endereço, avança para o seguinte quando a duração do anterior termina; `dur = 255` no ÚLTIMO quadro do
 *  ÚLTIMO endereço congela para sempre; nos demais casos, tudo em loop. `t` já deve ser `tick − t0`.
 *  Um `dur = 255` que NÃO seja o último quadro é tratado como duração 1 (placeholder): sem isso a lista nunca
 *  avançaria para o endereço seguinte (caso de `MOUNTING_ANIMS`/`DISMOUNT_ANIMS`, cujo 1º endereço reaproveita uma
 *  animação `idle` de 1 quadro congelado). Essa é uma simplificação nossa quando a ROM não documenta a duração
 *  exata da transição entre endereços (ver relatório da T14). */
export function sampleSeq(a: RomAssets, addrs: readonly number[], t: number): SeqSample {
  const seqs = addrs.map(addr => ({ addr, frames: a.anim(addr) as Anim }));
  const lastSeq = seqs[seqs.length - 1], lastFrame = lastSeq.frames[lastSeq.frames.length - 1];
  const freezesAtEnd = lastFrame.dur === 255;
  let total = 0;
  for (const { frames } of seqs) for (const fr of frames) total += fr.dur === 255 ? 1 : fr.dur;
  let tt = t < 0 ? 0 : t;
  if (freezesAtEnd) tt = Math.min(tt, Math.max(0, total - 1));
  else if (total > 0) tt = tt % total;
  for (const { addr, frames } of seqs) {
    for (const fr of frames) {
      const dur = fr.dur === 255 ? 1 : fr.dur;
      if (tt < dur) return { addr, frame: fr };
      tt -= dur;
    }
  }
  return { addr: lastSeq.addr, frame: lastFrame };
}
