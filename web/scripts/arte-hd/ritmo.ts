// Lê da ROM do usuário o RITMO das animações que o catálogo da arte HD recomenda (só números: duração de cada quadro
// em ticks de 60 Hz, se dá a volta, quantos desenhos distintos) e grava src/render/hdart/catalog-ritmo.ts.
// Nunca grava pixels, tiles, paletas ou bytes da ROM.
// Uso: SB4_ROM="/caminho/Super Bomberman 4 (USA).sfc" node scripts/arte-hd/ritmo.ts [--conferir]
//      (--conferir só compara com o arquivo versionado; código 1 se estiver desatualizado)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { importar, WEB } from './carregar.ts';

interface Piece { dx: number; dy: number; tile: number; hflip: boolean; vflip: boolean; big: boolean; palAdd: number }
interface AnimFrame { dur: number; mx: number; my: number; pieces: Piece[] }
type Anim = AnimFrame[];
interface RomAssets {
  rom: unknown;
  anim(addr: number): Anim;
  bombScript(type: number): { word: number; dur: number }[];
}
type FonteRom = { kind: 'player'; tab: number; idx: number | null } | { kind: 'seq'; addrs: readonly number[] } | { kind: 'bomb'; type: number };
interface Medida { ticks: number[]; loop: boolean; distinct: number; addr: string }

const hexAddr = (a: number): string => `$${(a >> 16).toString(16).toUpperCase()}:${(a & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;
const distinctOf = (frames: readonly AnimFrame[]): number => new Set(frames.map(f => JSON.stringify(f.pieces))).size;

/** Uma animação como o render a toca (`sampleAnim`): dur 0 = 256, dur 255 congela (e corta o resto). */
function single(anim: Anim, addr: number): Medida {
  const ticks: number[] = [];
  const kept: AnimFrame[] = [];
  let loop = true;
  for (const f of anim) {
    kept.push(f);
    if (f.dur === 255) { ticks.push(1); loop = false; break; }
    ticks.push(f.dur === 0 ? 256 : f.dur);
  }
  return { ticks, loop, distinct: distinctOf(kept), addr: hexAddr(addr) };
}

/** Sequência de animações como `sampleSeq` das montarias: dur 255 vale 1 tick; se o último quadro é 255, congela. */
function seq(a: RomAssets, addrs: readonly number[]): Medida {
  const frames = addrs.flatMap(x => a.anim(x));
  const last = frames[frames.length - 1];
  return { ticks: frames.map(f => (f.dur === 255 ? 1 : f.dur)), loop: last.dur !== 255, distinct: distinctOf(frames),
    addr: addrs.map(hexAddr).join('+') };
}

async function main(): Promise<number> {
  const path = process.env.SB4_ROM;
  if (!path) throw new Error('defina SB4_ROM com o caminho da ROM');
  const { validateRom } = await importar<{ validateRom(b: Uint8Array): Promise<{ ok: boolean; rom: Uint8Array; motivo?: string }> }>('src/rom/validate.ts');
  const { createRomAssets } = await importar<{ createRomAssets(b: Uint8Array): RomAssets }>('src/rom/assets.ts');
  const { animAddr } = await importar<{ animAddr(rom: unknown, ref: { tab: number; idx: number | null }, char: number): number }>('src/render/anim/player-anim.ts');
  const { ritmoFontes } = await importar<{ ritmoFontes(): Map<string, { rom: FonteRom }> }>('src/render/hdart/catalog.ts');
  const { CHARACTERS } = await importar<{ CHARACTERS: readonly unknown[] }>('src/render/art/bomber.ts');

  const v = await validateRom(new Uint8Array(readFileSync(path)));
  if (!v.ok) throw new Error(`SB4_ROM não é a ROM suportada (${v.motivo})`);
  const sha1 = createHash('sha1').update(v.rom).digest('hex');
  const a = createRomAssets(v.rom);

  const out = new Map<string, Medida>();
  for (const [name, f] of ritmoFontes()) {
    const r = f.rom;
    if (r.kind === 'player') {
      const per = CHARACTERS.map((_, c) => { const addr = animAddr(a.rom, r, c); return single(a.anim(addr), addr); });
      const same = per.every(m => m.ticks.join() === per[0].ticks.join() && m.loop === per[0].loop);
      if (!same) console.warn(`aviso: ${name} tem ritmo diferente entre personagens; usando o do personagem 0`);
      out.set(name, per[0]);
    } else if (r.kind === 'seq') {
      out.set(name, seq(a, r.addrs));
    } else {
      const sc = a.bombScript(r.type);
      out.set(name, { ticks: sc.map(s => s.dur), loop: true, distinct: new Set(sc.map(s => s.word)).size, addr: `script de bomba ${r.type}` });
    }
  }

  const lines = [...out.keys()].sort().map(k => {
    const m = out.get(k)!;
    return `  ${JSON.stringify(k)}: { ticks: [${m.ticks.join(', ')}], loop: ${m.loop}, distinct: ${m.distinct}, addr: ${JSON.stringify(m.addr)} },`;
  });
  const src = [
    '// GERADO por scripts/arte-hd/ritmo.ts — NÃO EDITAR. Rode: SB4_ROM=… node scripts/arte-hd/ritmo.ts',
    `// ROM SHA-1 ${sha1}`,
    '// Só números das tabelas de animação do original (ticks de 60 Hz por quadro, loop, desenhos distintos); nenhum pixel.',
    '',
    '/** Ritmo de uma animação do original: só números (duração de cada quadro em ticks de 60 Hz), nunca pixels. */',
    'export interface RitmoRom { ticks: readonly number[]; loop: boolean; distinct: number; addr: string }',
    '',
    `export const RITMO_ROM_SHA1: string | null = ${JSON.stringify(sha1)};`,
    'export const RITMO_ROM: Readonly<Record<string, RitmoRom>> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
  const file = WEB + 'src/render/hdart/catalog-ritmo.ts';
  if (process.argv.includes('--conferir')) {
    const ok = existsSync(file) && readFileSync(file, 'utf8') === src;
    if (!ok) console.error(`desatualizado: ${file} (rode SB4_ROM=… node scripts/arte-hd/ritmo.ts)`);
    return ok ? 0 : 1;
  }
  writeFileSync(file, src);
  console.log(`gerado ${file} (${out.size} animações)`);
  return 0;
}

process.exitCode = await main();
