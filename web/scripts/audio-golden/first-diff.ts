// Primeira diferença entre dois logs de MMIO (formato do spctrace: 8 bytes por registro).
// Uso: node scripts/audio-golden/first-diff.ts <referência/mmio.bin> <ts/nome.mmio.bin>
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map(p => new Uint8Array(readFileSync(p)));
const rec = (x: Uint8Array, i: number) => {
  const o = i * 8;
  const cyc = (x[o] | (x[o + 1] << 8) | (x[o + 2] << 16) | (x[o + 3] << 24)) >>> 0;
  return `ciclo ${cyc} ${String.fromCharCode(x[o + 4])} $00${x[o + 5].toString(16).toUpperCase().padStart(2, '0')} = $${x[o + 6].toString(16).toUpperCase().padStart(2, '0')}`;
};
const n = Math.min(a.length, b.length) / 8;
for (let i = 0; i < n; i++) {
  for (let k = 0; k < 8; k++) {
    if (a[i * 8 + k] !== b[i * 8 + k]) {
      console.log(`registro ${i}:`);
      for (let j = Math.max(0, i - 5); j <= i; j++) console.log(`  ref ${rec(a, j)}   |   ts ${rec(b, j)}`);
      process.exit(1);
    }
  }
}
console.log(a.length === b.length ? 'iguais' : `prefixo igual; tamanhos ${a.length / 8} × ${b.length / 8}`);
