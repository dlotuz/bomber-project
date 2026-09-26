import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRom } from './core-rom.ts';
import type { Rom } from './core-rom.ts';
import { renderMovement } from './core-movement.ts';
import { renderStages } from './core-stages.ts';
import { renderItems, renderCells } from './core-items.ts';
import { renderFlights } from './core-flights.ts';
import { renderMisc } from './core-misc.ts';

export const GENERATORS: { name: string; render(rom: Rom): string }[] = [
  { name: 'movement', render: renderMovement },
  { name: 'stages', render: renderStages },
  { name: 'items', render: renderItems },
  { name: 'cells', render: renderCells },
  { name: 'flights', render: renderFlights },
  { name: 'misc', render: renderMisc },
];

if (fileURLToPath(import.meta.url) === process.argv[1]) {   // caminho com espaços: comparar caminhos, não URLs
  const path = process.env.SB4_ROM;
  if (!path) throw new Error('defina SB4_ROM');
  const rom = loadRom(path);
  for (const g of GENERATORS) {
    const out = fileURLToPath(new URL(`../../src/core/tables/${g.name}.ts`, import.meta.url));
    writeFileSync(out, g.render(rom));
    console.log(`gerado ${out}`);
  }
}
