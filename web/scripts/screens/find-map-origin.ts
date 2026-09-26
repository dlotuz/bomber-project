// Ferramenta de pesquisa (A14): procura na ROM a origem dos mapas de BG de uma captura.
// Uso: SB4_ROM=… SB4_CAPTURES=… node scripts/screens/find-map-origin.ts <cena>
// Só lê e imprime (endereços e porcentagens); não grava nada. Não importa nada de src/.
//  (a) busca crua de cada linha de 64 B dos mapas (VRAM $4000/$4400, WRAM $7E:5000/$7E:2000) na ROM inteira;
//  (b) a mesma busca só com o byte baixo das palavras (paleta/flip livres);
//  (c) decodifica [ARN §2.3] a partir de cada par de ponteiros de 24 bits em ±$100 dos scripts gráficos e dos
//      descritores de tela (`$C1:BF88`: script, BG1 fluxo/tabela, BG2 fluxo/tabela) e compara;
//  (d) lista as cópias cruas para $7E:5000 (`LDA $bb:aaaa,X` + `STA $7E5000,X`, rotinas da tradução) e compara.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROM_PATH = process.env.SB4_ROM, CAPTURES = process.env.SB4_CAPTURES, scene = process.argv[2];
if (!ROM_PATH || !CAPTURES || !scene) {
  console.error('uso: SB4_ROM=… SB4_CAPTURES=… node scripts/screens/find-map-origin.ts <cena>');
  process.exit(1);
}
const rom = new Uint8Array(readFileSync(ROM_PATH));
const read = (ext: string) => {
  const p = join(CAPTURES, `${scene}.${ext}`);
  return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
};
const vram = read('vram'), wram = read('wram');
if (!vram) { console.error(`sem ${scene}.vram em ${CAPTURES}`); process.exit(1); }

const hex = (a: number) => `$${(a >>> 16).toString(16).toUpperCase().padStart(2, '0')}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
const off = (a: number): number => {
  const b = (a >>> 16) & 0xff, o = a & 0xffff;
  if (b >= 0xc0) return ((b - 0xc0) << 16) | o;
  if (b >= 0x40 && b < 0x7e) return ((b - 0x40) << 16) | o;
  if (o >= 0x8000 && (b < 0x40 || (b >= 0x80 && b < 0xc0))) return ((b & 0x3f) << 16) | o;
  return -1;
};
const inRom = (a: number) => { const o = off(a); return o >= 0 && o + 1 < rom.length; };
const u16 = (a: number) => { const o = off(a); return rom[o] | (rom[o + 1] << 8); };
const u24 = (a: number) => { const o = off(a); return rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16); };
const words = (b: Uint8Array, byteOff: number, n: number) => {
  const w = new Uint16Array(n);
  for (let i = 0; i < n; i++) w[i] = b[byteOff + 2 * i] | (b[byteOff + 2 * i + 1] << 8);
  return w;
};

const targets: [string, Uint16Array][] = [['BG1 VRAM $4000', words(vram, 0x8000, 1024)], ['BG2 VRAM $4400', words(vram, 0x8800, 1024)]];
if (wram) targets.push(['WRAM $7E:5000', words(wram, 0x5000, 480)], ['WRAM $7E:2000', words(wram, 0x2000, 1024)]);

/** Casas 16×16 visíveis (14 linhas × 16 colunas) iguais, e iguais no mapa todo. `mask` tira bits da comparação
 *  (ex.: $DFFF ignora a prioridade, que o título liga depois com `$C4:680C`). */
function score(a: Uint16Array, b: Uint16Array, mask = 0xffff): { vis: number; all: number } {
  let v = 0, t = 0;
  for (let l = 0; l < 14; l++) for (let c = 0; c < 16; c++) { t++; if (((a[l * 32 + c] ^ b[l * 32 + c]) & mask) === 0) v++; }
  const n = Math.min(a.length, b.length);
  let s = 0; for (let i = 0; i < n; i++) if (((a[i] ^ b[i]) & mask) === 0) s++;
  return { vis: v / t, all: s / n };
}
const pct = (x: number) => `${(100 * x).toFixed(1)} %`;

function findAll(needle: Uint8Array, stride = 1, max = 4): number[] {
  const hits: number[] = [];
  outer: for (let o = 0; o + needle.length * stride <= rom.length; o++) {
    for (let i = 0; i < needle.length; i++) if (rom[o + i * stride] !== needle[i]) continue outer;
    hits.push(0xc00000 + o);
    if (hits.length >= max) break;
  }
  return hits;
}

console.log(`# ${scene}`);
// (a) e (b)
for (const [name, m] of targets) {
  const rows = Math.min(15, m.length / 32);
  const raw: string[] = [], low: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row = m.subarray(r * 32, r * 32 + 32);
    if (new Set(row).size < 3) continue;   // linha lisa: acha em qualquer lugar
    const bytes = new Uint8Array(64); row.forEach((w, i) => { bytes[2 * i] = w & 0xff; bytes[2 * i + 1] = w >> 8; });
    const h = findAll(bytes, 1, 1);
    if (h.length) raw.push(`linha ${r} em ${hex(h[0])}`);
    const lo = findAll(Uint8Array.from(row, w => w & 0xff), 2, 1);
    if (lo.length) low.push(`linha ${r} em ${hex(lo[0])}`);
  }
  console.log(`(a) ${name}: ${raw.length ? raw.join(', ') : 'nenhuma linha crua'}`);
  console.log(`(b) ${name}: ${low.length ? low.join(', ') : 'nenhuma linha só com o byte baixo'}`);
}

// (c) Decodificador $C4:08D3 a partir de pares de ponteiros.
function decode(stream: number, table: number, n = 1024): Uint16Array | null {
  const out = new Uint16Array(n);
  let a = stream + 1, k = 0, guard = 0;
  while (k < n) {
    if (!inRom(a) || ++guard > 4096) return null;
    const t = u16(a); a += 2;
    const e = table + 2 * (t & 0x3ff);
    if (!inRom(e)) return null;
    const w = u16(e);
    for (let r = 0; r <= t >> 10 && k < n; r++) out[k++] = w;
  }
  return out;
}
const SCRIPTS = [0xc1c182, 0xc1c1b2, 0xc1c1e2, 0xc29c35];
const windows = [...SCRIPTS.map(s => [s - 0x100, s + 0x100]), [0xc1c00e, 0xc1c182], [0xc29c17, 0xc29c35]];
const pointers = new Set<number>();
for (const [a0, a1] of windows) for (let a = a0; a <= a1; a++) {
  const p = u24(a);
  if (p >>> 16 >= 0xc0 && inRom(p)) pointers.add(a);
}
const best = new Map<string, { at: number; stream: number; table: number; vis: number; all: number }>();
for (const at of pointers) {
  const stream = u24(at), table = u24(at + 3);
  if (table >>> 16 < 0xc0) continue;
  const m = decode(stream, table);
  if (!m) continue;
  for (const [name, t] of targets) {
    const s = score(m, t, 0xdfff);
    const b = best.get(name);
    if (!b || s.vis + s.all > b.vis + b.all) best.set(name, { at, stream, table, ...s });
  }
}
for (const [name] of targets) {
  const b = best.get(name);
  console.log(`(c) ${name}: ${b ? `melhor par em ${hex(b.at)}: fluxo ${hex(b.stream)}, tabela ${hex(b.table)} → visível ${pct(b.vis)}, mapa ${pct(b.all)} (sem o bit de prioridade)` : 'nada decodificável'}`);
}

// (d) Cópias cruas de 2048 B para $7E:5000: BF ll hh bb 9F 00 50 7E.
for (let o = 0; o + 8 <= rom.length; o++) {
  if (rom[o] !== 0xbf || rom[o + 4] !== 0x9f || rom[o + 5] !== 0x00 || rom[o + 6] !== 0x50 || rom[o + 7] !== 0x7e) continue;
  const src = rom[o + 1] | (rom[o + 2] << 8) | (rom[o + 3] << 16);
  if (!inRom(src + 2046)) continue;
  const m = new Uint16Array(1024); for (let i = 0; i < 1024; i++) m[i] = u16(src + 2 * i);
  const s = score(m, targets[0][1]);
  console.log(`(d) cópia crua em ${hex(0xc00000 + o)} de ${hex(src)}: BG1 visível ${pct(s.vis)}, mapa ${pct(s.all)}`);
}
