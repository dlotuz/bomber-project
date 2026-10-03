// Rastreio de leitura da ROM nos testes (scripts/rom-pack): com SB4_TRACE=<pasta>, a ROM dos testes passa por
// src/rom/trace.ts e, ao fim de cada arquivo de teste, as faixas lidas vão para <pasta>/cov-*.json. Sem SB4_TRACE,
// devolve a própria ROM.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { traceRom } from '../../src/rom/trace';

let seq = 0;

export function maybeTrace(rom: Uint8Array): Uint8Array {
  const dir = process.env.SB4_TRACE;
  if (!dir) return rom;
  const t = traceRom(rom);
  const file = `${dir}/cov-${process.pid}-${Date.now()}-${seq++}-${Math.random().toString(36).slice(2, 8)}.json`;
  const flush = (): void => {
    mkdirSync(dir, { recursive: true });
    if (t.whole.length) writeFileSync(file.replace('.json', '.whole.txt'), t.whole.join('\n\n'));
    const g = globalThis as { expect?: { getState?: () => { testPath?: string } } };
    writeFileSync(file + '.tmp', JSON.stringify({ test: g.expect?.getState?.().testPath ?? '?', ranges: t.ranges() }));
    renameSync(file + '.tmp', file);   // grava e renomeia: a saída do processo pode cortar a escrita
  };
  // os testes rodam em threads (sem 'exit' por arquivo): grava no fim de cada arquivo e, por garantia, na saída
  (globalThis as { afterAll?: (fn: () => void) => void }).afterAll?.(flush);
  process.on('exit', flush);
  return t.view;
}
