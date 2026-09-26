import type { Rom } from './core-rom.ts';
import { header, nums } from './core-emit.ts';

/** Mapa de arena: 1 byte ignorado + tokens u16 `código | rep << 10` ($C4:08D3), 32×32 entradas. */
function decodeMap(rom: Rom, src: number): number[] {
  const out: number[] = [];
  let a = src + 1;
  while (out.length < 1024) {
    const w = rom.u16(a); a += 2;
    for (let k = 0; k <= (w >> 10); k++) out.push(w & 0x3ff);
  }
  return out.slice(0, 1024);
}
const logicOf = (rom: Rom, code: number): number => (code < 16 ? rom.u16(0xc40892 + 2 * code) : 0xec40);

export function renderStages(rom: Rom): string {
  const table = rom.u24(0xc40074);   // variante 0 (Battle)
  const stages = Array.from({ length: 10 }, (_, idx) => {
    const rec = rom.u24(table + 3 * idx);
    const bg2 = decodeMap(rom, rom.u24(rec + 0x09)), floor = decodeMap(rom, rom.u24(rec + 0x0c));
    const base: number[] = [], floorLogic: number[] = [];
    for (let lin = 0; lin < 13; lin++) for (let col = 0; col < 17; col++) {
      const b = logicOf(rom, bg2[lin * 32 + col]), f = floor[lin * 32 + col];
      base.push(b);
      // piso especial (código ≥ 16, ex.: a grama da fase 4) sobre casa que não é parede = piso normal (§3.5, §4.3, A10)
      floorLogic.push(f >= 16 && b !== 0xec40 ? 0x0000 : logicOf(rom, f));
    }
    return { base, floorLogic, remove: rom.u8(rec + 0x1e) };
  });
  const remove = stages.map(s => s.remove).join(',');
  if (remove !== '14,14,12,4,8,14,4,0,4,14') throw new Error(`ordem das arenas inesperada: ${remove}`);
  return header('core-stages.ts', rom.sha1, [
    'registro da arena: p24(p24($C4:0074) + 3·idx), idx = fase − 1; mapa BG2 rec+$09, piso rec+$0C, N rec+$1E;',
    'lógico $C4:0892[código] (código ≥ 16 → EC40; no piso, código ≥ 16 sobre base ≠ EC40 → 0000, piso normal).',
    'Casa (col, lin) = entrada lin·32 + col do mapa.',
  ]) + [
    'export interface StageFacts { base: readonly number[]; floorLogic: readonly number[]; remove: number }',
    '/** Índice 0..9 = fases 1..10; base/floorLogic com 221 códigos (cell = lin·17 + col). */',
    'export const STAGE_FACTS: readonly StageFacts[] = [',
    ...stages.map(s => `  { remove: ${s.remove},\n    base: ${nums(s.base, true, 17).replace(/\n/g, '\n    ')},\n    floorLogic: ${nums(s.floorLogic, true, 17).replace(/\n/g, '\n    ')} },`),
    '];',
    '',
  ].join('\n');
}
