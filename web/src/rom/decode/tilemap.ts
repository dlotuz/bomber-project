// Mapas das arenas [ARN §2.3] ($C4:08D3 / $C4:0901). Porte de arena_rom.decode_map / map_to_entries / logic_of.
import type { RomView } from '../view';

export const LOGIC_TABLE = 0xc40892;

/** Decodifica `n` códigos: 1 byte ignorado; tokens u16 LE `código = t & $3FF`, `repetições extras = t >> 10`. */
export function decodeMapCodes(rom: RomView, addr: number, n = 1024): { codes: Uint16Array; used: number } {
  const codes = new Uint16Array(n);
  let a = addr + 1, k = 0;
  while (k < n) {
    const t = rom.u16(a); a += 2;
    const code = t & 0x3ff;
    for (let r = 0; r <= t >> 10 && k < n; r++) codes[k++] = code;
  }
  return { codes, used: a - addr };
}

/** Código → palavra de tilemap pela tabela `tbl` (u16 por código). */
export function codesToEntries(rom: RomView, codes: Uint16Array, tbl: number): Uint16Array {
  const out = new Uint16Array(codes.length);
  for (let i = 0; i < codes.length; i++) out[i] = rom.u16(tbl + 2 * codes[i]);
  return out;
}

/** Código → lógico: `código < 16 ? u16($C4:0892 + 2·código) : $EC40`. */
export function logicOf(rom: RomView, code: number): number {
  return code < 16 ? rom.u16(LOGIC_TABLE + 2 * code) : 0xec40;
}

export function codesToLogic(rom: RomView, codes: Uint16Array): Uint16Array {
  const out = new Uint16Array(codes.length);
  for (let i = 0; i < codes.length; i++) out[i] = logicOf(rom, codes[i]);
  return out;
}
