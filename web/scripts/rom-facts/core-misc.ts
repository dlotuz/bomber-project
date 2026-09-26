import type { Rom } from './core-rom.ts';
import { header, nums } from './core-emit.ts';

/** Passos da espiral da pressão ($C1:724E): deltas s16 cumulativos a partir de $0044; $7000 = fim sem Morte Súbita; −$8000 = fim. */
export function extractPressureSteps(rom: Rom): number[] {
  const out: number[] = [];
  for (let a = 0xc1724e; ; a += 2) { const v = rom.s16(a); out.push(v); if (v === -0x8000) return out; }
}

export function renderMisc(rom: Rom): string {
  const u24list = (a: number, n: number) => Array.from({ length: n }, (_, i) => rom.u16(a + 3 * i));
  return header('core-misc.ts', rom.sha1, [
    'CAPSULE_TYPES $C1:5DA4 (14), FUSE_TABLE $C1:56E8 (3), MAX_CAPS $C0:0B4C/48/50, INVISIBLE_PATTERN $C2:4F68 (64),',
    'RACER_HANDLERS $C2:08F4 (17 × u24, parte baixa), STUN_LOSS_HANDLERS $C2:519D (13 × u24, parte baixa)',
  ]) + [
    `export const CAPSULE_TYPES: readonly number[] = ${nums(rom.bytes(0xc15da4, 14), true)};`,
    `export const FUSE_TABLE: readonly number[] = ${nums(rom.bytes(0xc156e8, 3))};`,
    `export const MAX_CAPS = { bombs: ${rom.u16(0xc00b4c)}, fire: ${rom.u16(0xc00b48)}, speed: ${rom.u16(0xc00b50)} } as const;`,
    `export const INVISIBLE_PATTERN: readonly number[] = ${nums(rom.bytes(0xc24f68, 64), true)};`,
    `export const RACER_HANDLERS: readonly number[] = ${nums(u24list(0xc208f4, 17), true)};`,
    `export const STUN_LOSS_HANDLERS: readonly number[] = ${nums(u24list(0xc2519d, 13), true)};`,
    '',
  ].join('\n');
}
