import { loadRom } from '../../scripts/rom-facts/core-rom.ts';
import { extractPressureSteps } from '../../scripts/rom-facts/core-misc.ts';
import { pressureSpiral } from '../../src/core/pressure';

const path = process.env.SB4_ROM;
const rom = path ? loadRom(path) : null;

describe.skipIf(!rom)('espiral da pressão = $C1:724E', () => {
  it('mesma ordem; marcador $7000 depois de 80 passos', () => {
    const steps = extractPressureSteps(rom!);
    const cells: number[] = [];
    let off = 0x44, marker = -1;
    for (const d of steps) {
      if (d === -0x8000) break;
      if (d === 0x7000) { marker = cells.length; continue; }
      off += d;
      cells.push((off >> 6) * 17 + ((off & 0x3f) >> 1));
    }
    expect(marker).toBe(80);
    expect(cells).toEqual([...pressureSpiral()]);
  });
});
