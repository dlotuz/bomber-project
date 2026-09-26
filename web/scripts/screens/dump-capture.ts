// Ferramenta de pesquisa: despeja mapas de BG, OAM e folhas de tiles de uma captura (SB4_CAPTURES) em OUT.
// Uso: SB4_CAPTURES=… OUT=<scratchpad> node scripts/screens/dump-capture.ts <cena> [linhaPaleta]
// Nunca escreve dentro do repositório (aborta se OUT estiver sob web/ ou docs/). Não importa nada de src/.
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from 'node:fs';
import { join, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.ts';

const CAPTURES = process.env.SB4_CAPTURES;
const OUT = process.env.OUT;
const scene = process.argv[2];
const palRow = Number(process.argv[3] ?? 0) & 15;
if (!CAPTURES || !OUT || !scene) {
  console.error('uso: SB4_CAPTURES=… OUT=<pasta fora do repositório> node scripts/screens/dump-capture.ts <cena> [linhaPaleta]');
  process.exit(1);
}

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoDir = resolve(webDir, '..');
function refuseInsideRepo(out: string): void {
  for (const forbidden of [join(repoDir, 'web'), join(repoDir, 'docs')]) {
    for (const f of new Set([forbidden, existsSync(forbidden) ? realpathSync(forbidden) : forbidden])) {
      if (out === f || out.startsWith(f + sep)) {
        console.error(`OUT (${out}) está dentro de ${f}: recusado, as capturas não entram no repositório.`);
        process.exit(2);
      }
    }
  }
}
refuseInsideRepo(resolve(OUT));        // antes de criar a pasta
mkdirSync(OUT, { recursive: true });
const out = realpathSync(resolve(OUT));
refuseInsideRepo(out);                 // de novo, com links resolvidos

const read = (ext: string) => new Uint8Array(readFileSync(join(CAPTURES, `${scene}.${ext}`)));
const vram = read('vram');
const cgBytes = read('cgram');
const cgram = new Uint16Array(256);
for (let i = 0; i < 256; i++) cgram[i] = cgBytes[i * 2] | (cgBytes[i * 2 + 1] << 8);
const oam = read('oam');

const hex = (v: number, n: number) => v.toString(16).padStart(n, '0');

// Mapas de BG (endereços de palavra da VRAM das cenas).
for (const [name, addr] of [['bg1', 0x4000], ['bg2', 0x4400], ['bg3', 0x5400]] as const) {
  const lines: string[] = [];
  for (let l = 0; l < 32; l++) {
    const row: string[] = [];
    for (let c = 0; c < 32; c++) {
      const i = (addr + l * 32 + c) * 2;
      row.push(hex(vram[i] | (vram[i + 1] << 8), 4));
    }
    lines.push(`${hex(l, 2)}: ${row.join(' ')}`);
  }
  writeFileSync(join(out, `${scene}-${name}.txt`), lines.join('\n') + '\n');
}

// OAM (mesma lógica de tests/screens/captures.ts → parseOam).
const oamLines: string[] = [];
for (let i = 0; i < 128; i++) {
  const hi = (oam[512 + (i >> 2)] >> ((i & 3) * 2)) & 3;
  let x = oam[i * 4] | ((hi & 1) << 8); if (x >= 256) x -= 512;
  const y = oam[i * 4 + 1];
  if (y >= 224 && y < 240) continue;   // escondido
  const attr = oam[i * 4 + 3];
  const tile = oam[i * 4 + 2] | ((attr & 1) << 8);
  oamLines.push(`#${String(i).padStart(3)} x=${String(x).padStart(4)} y=${String(y).padStart(3)} tile=$${hex(tile, 3)} pal=${(attr >> 1) & 7}`
    + ` prio=${(attr >> 4) & 3} h=${(attr & 0x40) ? 1 : 0} v=${(attr & 0x80) ? 1 : 0} big=${(hi & 2) ? 1 : 0}`);
}
writeFileSync(join(out, `${scene}-oam.txt`), oamLines.join('\n') + '\n');

// Folhas de tiles 8×8 em 32 colunas.
function sheet(byteOff: number, count: number, bpp: 2 | 4, palBase: number): Buffer {
  const cols = 32, rows = Math.ceil(count / cols);
  const w = cols * 8, h = rows * 8;
  const rgba = new Uint8Array(w * h * 4);
  const tileBytes = bpp * 8;
  const c8 = (v: number) => (v << 3) | (v >> 2);
  for (let t = 0; t < count; t++) {
    const base = byteOff + t * tileBytes;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const bit = 7 - x;
      let idx = 0;
      for (let p = 0; p < bpp; p++) {
        const b = vram[(base + (p >> 1) * 16 + y * 2 + (p & 1)) & 0xffff] ?? 0;
        idx |= ((b >> bit) & 1) << p;
      }
      const px = ((Math.floor(t / cols) * 8 + y) * w + (t % cols) * 8 + x) * 4;
      if (idx === 0) { rgba[px] = 255; rgba[px + 1] = 0; rgba[px + 2] = 255; rgba[px + 3] = 255; continue; }
      const c = cgram[(palBase + idx) & 255];
      rgba[px] = c8(c & 31); rgba[px + 1] = c8((c >> 5) & 31); rgba[px + 2] = c8((c >> 10) & 31); rgba[px + 3] = 255;
    }
  }
  return encodePng(w, h, rgba);
}
writeFileSync(join(out, `${scene}-bg-tiles.png`), sheet(0x0000, 1024, 4, palRow * 16));
writeFileSync(join(out, `${scene}-obj-tiles.png`), sheet(0xc000, 512, 4, (8 + (palRow & 7)) * 16));
writeFileSync(join(out, `${scene}-bg3-tiles.png`), sheet(0xa000, 256, 2, (palRow & 7) * 4));
console.log(`escrito em ${out}: ${scene}-{bg1,bg2,bg3,oam}.txt, ${scene}-{bg,obj,bg3}-tiles.png`);
