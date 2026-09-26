import { readFileSync } from 'node:fs';
import { extractStageTables } from '../../scripts/rom-facts/stages';
import * as T from '../../src/core/stages/tables';

const ROM_PATH = process.env.SB4_ROM;

describe('tabelas das arenas: formas conhecidas (sem ROM)', () => {
  it('arena 2: 16 normal, 13 rápido, 3 lento', () => {
    expect([0, 1, 2].map(m => T.A2_MODES.filter(x => x === m).length)).toEqual([16, 13, 3]);
  });
  it('arena 8: contagens de prêmio (18/12/12/6/4/4/4/1/1/1/1) e cantos da tabela', () => {
    const count = (r: number) => T.A8_PRIZE.filter(x => x === r).length;
    expect([0x14f7, 0x14f9, 0x1611, 0x1526, 0x1662, 0x14d6, 0x163a, 0x15bf, 0x16a2, 0x1682, 0x17ad].map(count))
      .toEqual([18, 12, 12, 6, 4, 4, 4, 1, 1, 1, 1]);
    expect([T.A8_PRIZE[0], T.A8_PRIZE[21], T.A8_PRIZE[42], T.A8_PRIZE[63]]).toEqual([0x15bf, 0x16a2, 0x17ad, 0x1682]);
  });
  it('arena 8: scripts de queda somam 16·n px (n = 1..6)', () => {
    const tot = T.A8_FALL_PICK.map(a => T.A8_FALL_DY[a].reduce((x, y) => x + y, 0));
    expect(tot).toEqual([16, 48, 96, 16, 48, 64, 16, 80, 48, 16, 64, 16, 32, 16, 48, 16]);
    for (const a of Object.keys(T.A8_FALL_DY)) expect(T.A8_FALL_DY[Number(a)].length).toBe(11);
  });
});

describe.skipIf(!ROM_PATH)('tabelas das arenas = ROM', () => {
  it('extractStageTables(ROM) reproduz tables.ts', () => {
    const t = extractStageTables(new Uint8Array(readFileSync(ROM_PATH!)));
    const { A9_PAL, A10_PAL, ...rest } = T;
    expect(t).toEqual({ ...rest, A9_PAL, A10_PAL });
  });
});
