// Gera web/public/rom-pack.dat (src/rom/pack.ts): as faixas da ROM que o jogo lê, comprimidas com gzip.
//
// As faixas vêm de dois rastreios gravados na mesma pasta, com a ROM real:
//   1. os testes:  SB4_ROM=<rom.sfc> SB4_TRACE=<pasta> npx vitest run   (tests/rom/trace.ts; o
//      tests/rom/pack-coverage.test.ts passa por todos os assets)
//   2. o jogo:     SB4_ROM=<rom.sfc> SB4_TRACE=<pasta> node scripts/rom-pack/play.mjs   (partidas só de CPUs em todas
//      as arenas, no navegador: animações de arena, montaria e vitória que nenhum teste desenha)
// e depois       SB4_ROM=<rom.sfc> SB4_TRACE=<pasta> node scripts/rom-pack/build.mjs
// Conferência: SB4_PACK=public/rom-pack.dat npx vitest run  (os testes de ROM com o pacote no lugar da ROM).
// As fatias do áudio entram sempre inteiras. Regere sempre que o jogo passar a ler faixas novas da ROM.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROM_SIZE = 0x400000;
const MAGIC = 0x4b504243, VERSION = 1;
/** Faixas separadas por até tantos bytes viram uma só (menos entradas; o custo é pouco). */
const JOIN_GAP = 64;
/** Áudio (src/audio/host/image.ts): [$C0:0190, $C0:07EB) e [$D9:0000, $DE:9C95). */
const ALWAYS = [[0x000190, 0x0007eb], [0x190000, 0x1e9c95]];
/** Testes que leem a ROM inteira sem ser para desenhar nem tocar nada (validação do arquivo). */
const SKIP = ['tests/rom/validate.test.ts'];

const romPath = process.env.SB4_ROM, traceDir = process.env.SB4_TRACE;
if (!romPath || !traceDir) { console.error('use: SB4_ROM=<rom.sfc> SB4_TRACE=<pasta do rastreio> node scripts/rom-pack/build.mjs'); process.exit(1); }
let rom = new Uint8Array(readFileSync(romPath));
if (rom.length % 0x8000 === 512) rom = rom.subarray(512);
if (rom.length !== ROM_SIZE) { console.error(`ROM com ${rom.length} bytes (esperado ${ROM_SIZE})`); process.exit(1); }

const seen = new Uint8Array(ROM_SIZE);
const files = readdirSync(traceDir).filter(f => f.startsWith('cov-') && f.endsWith('.json'));
if (!files.length) { console.error(`nenhum rastreio em ${traceDir}`); process.exit(1); }
for (const f of files) {
  const { test, ranges } = JSON.parse(readFileSync(`${traceDir}/${f}`, 'utf8'));
  if (SKIP.some(s => test.replaceAll('\\', '/').endsWith(s))) continue;
  for (const [a, b] of ranges) seen.fill(1, a, b);
}
for (const [a, b] of ALWAYS) seen.fill(1, a, b);

const ranges = [];
for (let i = 0; i < ROM_SIZE;) {
  if (!seen[i]) { i++; continue; }
  let j = i;
  while (j < ROM_SIZE && seen[j]) j++;
  const last = ranges[ranges.length - 1];
  if (last && i - last[1] <= JOIN_GAP) last[1] = j; else ranges.push([i, j]);
  i = j;
}
const total = ranges.reduce((s, [a, b]) => s + b - a, 0);
const raw = new Uint8Array(12 + 8 * ranges.length + total);
const dv = new DataView(raw.buffer);
dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true); dv.setUint32(8, ranges.length, true);
let p = 12 + 8 * ranges.length;
ranges.forEach(([a, b], i) => {
  dv.setUint32(12 + 8 * i, a, true); dv.setUint32(16 + 8 * i, b - a, true);
  raw.set(rom.subarray(a, b), p); p += b - a;
});
const out = process.env.ROM_PACK_OUT ?? fileURLToPath(new URL('../../public/rom-pack.dat', import.meta.url));
const gz = gzipSync(raw, { level: 9 });
writeFileSync(out, gz);
console.log(`${files.length} rastreios, ${ranges.length} faixas, ${total} bytes da ROM (${(100 * total / ROM_SIZE).toFixed(1)}%), ${gz.length} bytes comprimidos → ${out}`);
