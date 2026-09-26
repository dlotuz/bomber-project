import type { Rom } from './core-rom.ts';
import { header, nums, pairs } from './core-emit.ts';

const LEVELS = [224, 256, 288, 320, 352, 384, 512, 128];
const DIRS: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 0]];
const a20 = (i: number): number => (i < 8 ? 7 - i : i < 16 ? 0 : -(i - 15));

export function renderMovement(rom: Rom): string {
  for (let lv = 0; lv < 8; lv++) for (let d = 0; d < 9; d++) {
    const a = 0xc32a50 + lv * 64 + d * 4;
    const [ex, ey] = [DIRS[d][0] * LEVELS[lv], DIRS[d][1] * LEVELS[lv]];
    if (rom.s16(a) !== ex || rom.s16(a + 2) !== ey) throw new Error(`SPEED ≠ fórmula em nível ${lv}, dir ${d}`);
  }
  for (let i = 0; i < 24; i++) if (rom.s16(0xc32a20 + 2 * i) !== a20(i)) throw new Error(`A20 ≠ fórmula em ${i}`);
  const tbl = [0xc32c60, 0xc32d40, 0xc32cd0].map(a => rom.bytes(a, 0x70));
  const diam: [number, number][] = Array.from({ length: 256 }, (_, i) => [rom.s16(0xc32620 + 4 * i), rom.s16(0xc32622 + 4 * i)]);
  return header('core-movement.ts', rom.sha1, [
    'SPEED $C3:2A50 e A20 $C3:2A20 (conferidos contra a fórmula), DPAD $C3:2C50, SUBPOS $C3:2520 (& 15),',
    'TBL $C3:2C60 / $C3:2D40 / $C3:2CD0, DIAM $C3:2620, PAR $C2:4F25, KICK_MASK $C3:2EB0, KICK_DIRBIT $C2:4068[face]',
  ]) + [
    `export const SPEED_BY_LEVEL: readonly number[] = ${JSON.stringify(LEVELS).replace(/,/g, ', ')};`,
    `export const DIR_VEC: readonly (readonly [number, number])[] = ${pairs(DIRS, 9)};`,
    'export function speedVec(level: number, dir: number): [number, number] {',
    '  const v = SPEED_BY_LEVEL[level] ?? 0; const d = DIR_VEC[dir] ?? DIR_VEC[8];',
    '  return [d[0] * v, d[1] * v];',
    '}',
    'export const a20 = (i: number): number => (i < 8 ? 7 - i : i < 16 ? 0 : -(i - 15));',
    'export const A20: readonly number[] = Array.from({ length: 24 }, (_, i) => a20(i));',
    `export const DPAD: readonly number[] = ${nums(rom.bytes(0xc32c50, 16))};`,
    `export const SUBPOS: readonly number[] = ${nums(rom.bytes(0xc32520, 256).map(v => v & 15))};`,
    `const T_CROSS = ${nums(tbl[0], true)};`,
    `const T_VERT = ${nums(tbl[1], true)};`,
    `const T_HORIZ = ${nums(tbl[2], true)};`,
    '/** Índice = PAR[paridade]: 0 e 3 cruzamento, 1 corredor vertical, 2 corredor horizontal (como TBL do movesim.py). */',
    'export const TBL: readonly (readonly number[])[] = [T_CROSS, T_VERT, T_HORIZ, T_CROSS];',
    `export const DIAM: readonly (readonly [number, number])[] = ${pairs(diam)};`,
    `export const PAR: readonly number[] = ${nums(rom.bytes(0xc24f25, 4))};`,
    `export const KICK_MASK: readonly number[] = ${nums(rom.bytes(0xc32eb0, 256), true)};`,
    `export const KICK_DIRBIT: readonly number[] = ${nums([0, 2, 4, 6].map(f => rom.u8(0xc24068 + f)), true)};`,
    '',
  ].join('\n');
}
