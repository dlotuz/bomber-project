import type { Rom } from './core-rom.ts';
import { header, pairs } from './core-emit.ts';

/** Script de voo: pares (s8 dx, s8 dy) em $C1:off até um byte $80/$81/$82. */
function script(rom: Rom, off: number): [number, number][] {
  const s: [number, number][] = [];
  for (let a = 0xc10000 | off; ![0x80, 0x81, 0x82].includes(rom.u8(a)); a += 2) {
    s.push([rom.s8(a), rom.s8(a + 1)]);
    if (s.length > 64) throw new Error(`script sem fim em $C1:${off.toString(16)}`);
  }
  return s;
}
const table = (rom: Rom, a: number, n: number): number[] => Array.from({ length: n }, (_, i) => rom.u16(a + 2 * i));
const four = (rom: Rom, a: number): string =>
  `[\n${table(rom, a, 4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n]`;

export function renderFlights(rom: Rom): string {
  const pb = table(rom, 0xc12126, 8);
  const sumOf = (s: [number, number][], k: 0 | 1) => s.reduce((a, v) => a + v[k], 0);
  const items = Array.from({ length: 12 }, (_, i) => {
    const s = script(rom, rom.u16(0xc16715 + 4 * i));
    const dir = rom.u16(0xc16717 + 4 * i);
    const cells = dir === 1 || dir === 3 ? Math.abs(sumOf(s, 0)) / 16 : dir === 0 ? (16 - sumOf(s, 1)) / 16 : (sumOf(s, 1) - 16) / 16;
    if (![3, 4, 5].includes(cells)) throw new Error(`voo de item ${i}: ${cells} casas`);
    return { dir, cells, s };
  });
  return header('core-flights.ts', rom.sha1, [
    'soco e quique $C1:2126 (8 u16: 4 soco + 4 quique), luva $C1:2571/2569/2561/2559 (2/3/4/5 casas),',
    'chute $C1:35C9, itens voando $C1:6715 (12 × {u16 script, u16 dir}); índice de direção 0 ↑ 1 → 2 ↓ 3 ←',
  ]) + [
    'export type Script = readonly (readonly [number, number])[];',
    `export const PUNCH: readonly Script[] = [\n${pb.slice(0, 4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n];`,
    `export const BOUNCE: readonly Script[] = [\n${pb.slice(4).map(p => '  ' + pairs(script(rom, p), 9).replace(/\n/g, '\n  ')).join(',\n')},\n];`,
    `export const KICK_STEP: readonly Script[] = ${four(rom, 0xc135c9)};`,
    'export const THROW: Readonly<Record<2 | 3 | 4 | 5, readonly Script[]>> = {',
    `  2: ${four(rom, 0xc12571).replace(/\n/g, '\n  ')},`,
    `  3: ${four(rom, 0xc12569).replace(/\n/g, '\n  ')},`,
    `  4: ${four(rom, 0xc12561).replace(/\n/g, '\n  ')},`,
    `  5: ${four(rom, 0xc12559).replace(/\n/g, '\n  ')},`,
    '};',
    'export const ITEM_FLIGHT: readonly { dir: 0 | 1 | 2 | 3; cells: 3 | 4 | 5; script: Script }[] = [',
    ...items.map(f => `  { dir: ${f.dir}, cells: ${f.cells}, script: ${pairs(f.s, 12)} },`),
    '];',
    '',
  ].join('\n');
}
