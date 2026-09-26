import type { Rom } from './core-rom.ts';
import { header, nums, pairs } from './core-emit.ts';

export function stageList(rom: Rom, stage: number): [number, number][] {
  // rd24(rom24(0xC3:6233) + 3*(stage-1)) no itemsim.py: rom24() só traduz endereço → offset do
  // arquivo, não lê memória; rom.u24 já faz essa tradução, então aqui é 1 leitura, não 2.
  const rec = rom.u24(0xc36233 + 3 * (stage - 1));   // variante A
  const a0 = rom.u24(rec + 24);
  const out: [number, number][] = [];
  for (let a = a0;;) { const c = rom.u16(a); if (c === 0xffff) return out; out.push([c, rom.u16(a + 2)]); a += 4; }
}

export function freeCellOffsets(rom: Rom): number[] {
  const out: number[] = [];
  for (let a = 0xc41327; ; a += 2) { const v = rom.u16(a); if (v === 0xffff) return out; out.push(v); }
}

export function renderItems(rom: Rom): string {
  return header('core-items.ts', rom.sha1, ['listas de itens escondidos: registro p24($C3:6233 + 3·(fase−1)), lista em rec+24,',
    'pares (u16 romOff, u16 item) até $FFFF; romOff $0044 = casa sorteada']) + [
    '/** Índice 0..9 = fases 1..10. [romOff, item] na ordem da ROM (a ordem importa para o sorteio). */',
    'export const STAGE_ITEMS: readonly (readonly [number, number])[][] = [',
    ...Array.from({ length: 10 }, (_, k) => `  ${pairs(stageList(rom, k + 1), 8).replace(/\n/g, '\n  ')},`),
    '];',
    '',
  ].join('\n');
}

export function renderCells(rom: Rom): string {
  const cells = freeCellOffsets(rom).map(off => (off >> 6) * 17 + ((off & 0x3f) >> 1));
  if (cells.length !== 113) throw new Error(`$C4:1327 com ${cells.length} casas`);
  return header('core-items.ts', rom.sha1, ['lista $C4:1327 (113 casas sem pilar, romOff → cell = lin·17 + col)']) +
    `export const FREE_CELLS: readonly number[] = ${nums(cells)};\n`;
}
