// Gera web/src/core/stages/tables.ts a partir da ROM. Uso: SB4_ROM=… node scripts/rom-facts/stages.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface StageTables { [k: string]: unknown }

function view(rom0: Uint8Array) {
  const rom = rom0.length % 0x8000 === 512 ? rom0.subarray(512) : rom0;
  const off = (a: number): number => ((a >> 16) & 0x3f) << 16 | (a & 0xffff);
  const u8 = (a: number): number => rom[off(a)];
  const u16 = (a: number): number => u8(a) | (u8(a + 1) << 8);
  const s8 = (a: number): number => { const v = u8(a); return v >= 0x80 ? v - 0x100 : v; };
  return { rom, u8, u16, s8 };
}
const cellPair = (off: number): [number, number] => [(off & 0x3f) >> 1, off >> 6];   // offset $2800 → (col, lin)
const list = (u8: (a: number) => number, a: number): number[] => { const n = u8(a); return Array.from({ length: n }, (_, i) => u8(a + 1 + i)); };

export function extractStageTables(rom0: Uint8Array): StageTables {
  const { u8, u16, s8 } = view(rom0);
  const words = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => u16(a + 2 * i));
  const bytes = (a: number, n: number): number[] => Array.from({ length: n }, (_, i) => u8(a + i));
  // arena 3: $C3:9401 = lista de offsets terminada em 0
  const orbs: [number, number][] = [];
  for (let a = 0xc39401; u16(a) !== 0; a += 2) orbs.push(cellPair(u16(a)));
  // $C3:087D: 4 ponteiros de 3 bytes → tabelas de 4 bytes no banco C3
  const turn = [0, 1, 2, 3].map(i => bytes(0xc30000 | u16(0xc3087d + 3 * i), 4));
  // arena 7: $C3:918E = (offset, palavra) até offset 0
  const arrows: [number, number, number][] = [];
  for (let a = 0xc3918e; u16(a) !== 0; a += 4) { const [c, l] = cellPair(u16(a)); arrows.push([c, l, u16(a + 2)]); }
  // arena 8: pads nas chamadas de $C3:1291 (LDY #$01C8/$01D0/$01D8)
  const pads = [u16(0xc31294), u16(0xc3129b), u16(0xc312a2)].map(cellPair);
  const colsOf = (a: number): number[] => { const r: number[] = []; for (let x = a; u16(x) !== 0; x += 2) r.push(u16(x)); return r; };
  // $C1:6984: 16 × (ptr16, dir, 0) → scripts (dx, dy) por tick até $80; guardamos só dy
  const fallPick = Array.from({ length: 16 }, (_, i) => u16(0xc16984 + 4 * i));
  const fallDy: Record<number, number[]> = {};
  const script = (p: number): number[] => { const r: number[] = []; for (let a = 0xc10000 | p; u8(a) !== 0x80; a += 2) r.push(s8(a + 1)); return r; };
  // bomba que cai ($C1:1D2D): 8 grupos de 4 ponteiros (cima, dir, baixo, esq); usa o de baixo
  const bombFall = Array.from({ length: 8 }, (_, i) => u16((0xc10000 | u16(0xc11d2d + 3 * i)) + 4));
  for (const p of [...fallPick, ...bombFall]) fallDy[p] ??= script(p);
  const saws: [number, number, number][] = [];
  for (let a = 0xc39524; u16(a) !== 0xffff; a += 4) { const [c, l] = cellPair(u16(a + 2)); saws.push([u16(a), c, l]); }
  return {
    A2_MODES: bytes(0xc30b11, 32),
    A3_ORBS: orbs,
    A3_TURN: turn,
    A6_REPAINT: words(0xc15558, 16),
    A7_ARROWS: arrows,
    A8_PADS: pads,
    A8_PRIZE: words(0xc31414, 64),
    A8_L149F: list(u8, 0xc3149f), A8_L14A9: list(u8, 0xc314a9), A8_L14B6: list(u8, 0xc314b6),
    A8_L14BE: bytes(0xc314be, 3), A8_L14C1: list(u8, 0xc314c1), A8_L14C5: bytes(0xc314c5, 9), A8_L14CE: list(u8, 0xc314ce),
    A8_RAIN: bytes(0xc31494, 8),
    A8_PRESET: [0, 1, 2, 3].map(i => words(0xc31b61 + 4 * i, 2)),
    A8_REEL_ROWS: words(0xc311a5, 16),
    A8_COLS_ALL: colsOf(0xc31173),
    A8_COLS: [colsOf(0xc31187), colsOf(0xc31191), colsOf(0xc3119b)],
    A8_FALL_PICK: fallPick,
    A8_FALL_DY: fallDy,
    A8_BOMB_FALL: bombFall,
    A8_EGGS: bytes(0xc15da4, 14),
    A9_SAWS: saws,
    A9_PAL: 0xd7dddc,
    A10_PAL: 0xd7e47c,
  };
}

const hex = (v: number): string => '0x' + v.toString(16);
const lit = (v: unknown): string => Array.isArray(v) ? `[${v.map(lit).join(', ')}]`
  : typeof v === 'number' ? (v > 9 ? hex(v) : String(v))
  : `{ ${Object.entries(v as object).map(([k, x]) => `${hex(Number(k))}: ${lit(x)}`).join(', ')} }`;

export function renderTables(t: StageTables, sha1: string): string {
  const doc: Record<string, string> = {
    A2_MODES: '$C3:0B11: modo da arena 2 por (rnd255 & 31). 0 normal, 1 rápido, 2 lento.',
    A3_ORBS: '$C3:9401: bolas da arena 3 (col, lin), na ordem de criação.',
    A3_TURN: '$C3:087D: soma na direção a cada falha, por conjunto (rnd255 & 3).',
    A6_REPAINT: '$C1:5558: piso repintado da arena 6 por v (1..15; índice 0 sem uso).',
    A7_ARROWS: '$C3:918E: setas da arena 7 (col, lin, palavra); face = palavra − 0x1CC0.',
    A8_PADS: '$C3:1291: pads do caça-níquel (col, lin); pad i → rolo i.',
    A8_PRIZE: '$C3:1414: rotina de prêmio por s1·16 + s2·4 + s3.',
    A8_L149F: '$C3:149F', A8_L14A9: '$C3:14A9', A8_L14B6: '$C3:14B6', A8_L14BE: '$C3:14BE (cópia fixa)',
    A8_L14C1: '$C3:14C1', A8_L14C5: '$C3:14C5 (cópia fixa)', A8_L14CE: '$C3:14CE',
    A8_RAIN: '$C3:1494: item de cada onda da chuva (onda & 7).',
    A8_PRESET: '$C3:1B61: contagem inicial dos 2 outros rolos ao ligar, por rnd255 & 3.',
    A8_REEL_ROWS: '$C3:11A5: fonte ($7F:xxxx) de cada linha de 8 px do rolo, por pos/2.',
    A8_COLS_ALL: '$C3:1173: X (px) de queda da chuva e dos ovos dela.',
    A8_COLS: '$C3:1187/1191/119B: X (px) de queda pelo último rolo a parar (1, 2, 3).',
    A8_FALL_PICK: '$C1:6984: script de queda dos itens por rnd255 & 15.',
    A8_FALL_DY: 'dy (px) por tick de cada script de queda.',
    A8_BOMB_FALL: '$C1:1D2D (grupo, script de baixo): queda da bomba do prêmio 1526 por rnd255 & 7.',
    A8_EGGS: '$C1:5DA4: tipo do ovo por rnd(14).',
    A9_SAWS: '$C3:9524: gangorras (estado inicial, col e lin da ponta A); B = A + 2 colunas.',
    A9_PAL: '$D7:DDDC: 6 quadros da paleta 5 da arena 9, 14 ticks cada.',
    A10_PAL: '$D7:E47C: 4 quadros da paleta 5 da arena 10, 15 ticks cada.',
  };
  const lines = [`// GERADO por web/scripts/rom-facts/stages.ts a partir da ROM SHA-1 ${sha1}. Não editar.`];
  for (const [k, v] of Object.entries(t)) {
    const type = k === 'A8_FALL_DY' ? ': Readonly<Record<number, readonly number[]>>' : '';
    lines.push(`/** ${doc[k]} */`, `export const ${k}${type} = ${lit(v)};`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('stages.ts')) {
  const buf = new Uint8Array(readFileSync(process.env.SB4_ROM!));
  const sha1 = createHash('sha1').update(buf.length % 0x8000 === 512 ? buf.subarray(512) : buf).digest('hex');
  writeFileSync(new URL('../../src/core/stages/tables.ts', import.meta.url), renderTables(extractStageTables(buf), sha1));
}
