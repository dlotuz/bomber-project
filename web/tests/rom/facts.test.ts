import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRom, ROM_SHA1 } from '../../scripts/rom-facts/core-rom.ts';
import { GENERATORS } from '../../scripts/rom-facts/core-all.ts';

const path = process.env.SB4_ROM;
const rom = path ? loadRom(path) : null;
const src = (name: string) => readFileSync(fileURLToPath(new URL(`../../src/core/tables/${name}.ts`, import.meta.url)), 'utf8');

describe.skipIf(!rom)('fatos do núcleo = ROM', () => {
  it('é a ROM suportada', () => {
    expect(rom!.sha1).toBe(ROM_SHA1);
  });
  for (const g of GENERATORS) {
    it(`core/tables/${g.name}.ts regenerado a partir da ROM é idêntico ao versionado`, () => {
      expect(g.render(rom!)).toBe(src(g.name));
    });
  }
});
