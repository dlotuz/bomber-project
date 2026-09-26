/** Cabeçalho dos arquivos gerados. */
export function header(script: string, sha1: string, sources: string[]): string {
  return [
    `// GERADO por scripts/rom-facts/${script} — NÃO EDITAR. Rode: SB4_ROM=… node scripts/rom-facts/core-all.ts`,
    `// ROM SHA-1 ${sha1}`,
    ...sources.map(s => `// ${s}`),
    '',
  ].join('\n');
}

const h = (v: number): string => (v < 0 ? `-0x${(-v).toString(16)}` : `0x${v.toString(16)}`);

/** Lista de números, 16 por linha. */
export function nums(values: readonly number[], useHex = false, perLine = 16): string {
  const f = useHex ? h : String;
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += perLine) lines.push('  ' + values.slice(i, i + perLine).map(f).join(', ') + ',');
  return `[\n${lines.join('\n')}\n]`;
}

export function pairs(values: readonly (readonly [number, number])[], perLine = 8): string {
  const lines: string[] = [];
  for (let i = 0; i < values.length; i += perLine) lines.push('  ' + values.slice(i, i + perLine).map(([a, b]) => `[${a}, ${b}]`).join(', ') + ',');
  return `[\n${lines.join('\n')}\n]`;
}
