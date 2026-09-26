// Montagem de referência da arena na carga [ARN §2.4]: 3×3 dos spawns + remoção de N soft pelo RNG do jogo.
// Porte de arena_rom.build_arena e render_rom.apply_static_objects. O núcleo (plano 6) tem a sua própria montagem;
// esta serve aos goldens e a ferramentas de conferência.
import type { RomView } from './view';
import { arenaRecord } from './assets-arena';
import { decodeMapCodes, codesToEntries, logicOf } from './decode/tilemap';

export const FALLBACK_LIST = 0xc41327;
/** (col, lin) de P1..P5 [spec §3.1]. */
export const DEFAULT_SPAWNS: ReadonlyArray<readonly [number, number]> = [[2, 1], [14, 11], [14, 1], [2, 11], [8, 6]];
const CLEAR_PATH = [0, -0x40, 2, 0x40, 0x40, -2, -2, -0x40, -0x40];   // $C4:1865, cumulativo

export interface ArenaBuild { bg2: Uint16Array; logic: Uint16Array; floor: Uint16Array; seed: number; soft: number }

/** Offsets (lin·$40 + col·2) da lista $C4:1327, até $FFFF (113 casas). */
export function fallbackList(rom: RomView): number[] {
  const out: number[] = [];
  for (let a = FALLBACK_LIST; ; a += 2) { const v = rom.u16(a); if (v === 0xffff) return out; out.push(v); }
}

export function buildArena(rom: RomView, stage: number, seed = 0xc689, spawns = DEFAULT_SPAWNS): ArenaBuild {
  const r = arenaRecord(rom, stage);
  const codes = decodeMapCodes(rom, r.bg2Map).codes, fcodes = decodeMapCodes(rom, r.floorMap).codes;
  const bg2 = codesToEntries(rom, codes, r.bg2Tbl), floor = codesToEntries(rom, fcodes, r.bg2Tbl);
  const logic = new Uint16Array(1024);
  for (let i = 0; i < 1024; i++) logic[i] = logicOf(rom, codes[i]);
  const clear = (i: number) => { bg2[i] = floor[i]; logic[i] = logicOf(rom, fcodes[i]); };
  for (const [col, lin] of spawns) {
    let off = lin * 0x40 + col * 2;
    for (const d of CLEAR_PATH) { off += d; clear(off >> 1); }
  }
  let s = seed & 0xffff;
  const rnd = (n: number) => { s = ((s | 1) * 0x383) & 0xffff; return (s * (n & 0xff)) >>> 16; };
  const fb = fallbackList(rom);
  let left = r.removeN;
  outer: while (left) {
    let done = false;
    for (let t = 0; t < 15 && !done; t++) {
      const col = rnd(13), lin = rnd(11), i = (lin * 0x40 + col * 2 + 0x44) >> 1;
      if (logic[i] === 0xcc80) { clear(i); left--; done = true; }
    }
    if (done) continue;
    for (const off of fb) if (logic[off >> 1] === 0xcc80) { clear(off >> 1); left--; continue outer; }
    break;
  }
  let soft = 0;
  for (let i = 0; i < 1024; i++) if (logic[i] === 0xcc80) soft++;
  return { bg2, logic, floor, seed: s, soft };
}

/** Elementos fixos que os objetos da arena gravam no BG2 na carga: setas (7), pads (8), gangorras (9). */
export function staticObjects(rom: RomView, stage: number): { off: number; word: number }[] {
  const out: { off: number; word: number }[] = [];
  if (stage === 7) for (let a = 0xc3918e; rom.u16(a) !== 0; a += 4) out.push({ off: rom.u16(a), word: rom.u16(a + 2) });
  if (stage === 8) for (const off of [0x1c8, 0x1d0, 0x1d8]) out.push({ off, word: 0x1c6e });
  if (stage === 9) for (let a = 0xc39524; rom.u16(a) !== 0xffff; a += 4) {
    const o = rom.u16(a), off = rom.u16(a + 2);
    const w = o === 0 ? [0x08ec, 0x48e2, 0x48e0] : [0x08e0, 0x08e2, 0x08e4];
    w.forEach((word, k) => out.push({ off: off + 2 * k, word }));
  }
  return out;
}

export function applyStatic(bg2: Uint16Array, objs: { off: number; word: number }[]): void {
  for (const { off, word } of objs) bg2[off >> 1] = word;
}
