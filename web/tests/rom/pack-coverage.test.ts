// Passa por todos os assets da ROM (arenas, personagens com todas as folhas, rostos do HUD, cenas, Mode 7, scripts de
// bomba, áudio, folhas inteiras das montarias e dos trajes, e cada endereço da ROM citado no código de desenho). Serve de
// fumaça com a ROM real e, com SB4_TRACE (scripts/rom-pack), garante que o pacote embutido leve tudo o que o jogo pode
// desenhar — mesmo o que nenhum outro teste nem as partidas de rastreio chegam a mostrar (ex.: quadros raros do polvo).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROM } from './helpers';
import { createRomAssets } from '../../src/rom/assets';
import { sheetFrame } from '../../src/rom/assets-char';
import { SCENE_IDS } from '../../src/rom/types';
import { COSTUME_SHEETS, MOUNT_GFX } from '../../src/render/rom/mounts/facts';

/** Quadros por folha de personagem: 32 linhas de 4 quadros de 32×32 ($800 por linha) = um banco inteiro. */
const SHEET_FRAMES = 128;
/** Folhas de montaria e de traje: 16 linhas de 4 quadros ($8000 bytes). */
const MOUNT_FRAMES = 64;
/** Em cada endereço citado no código de desenho, quantos bytes ler crus (paletas, tabelas curtas). */
const LITERAL_BYTES = 64;

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
/** Endereços SNES ($C0:0000–$FF:FFFF) escritos no código de desenho e das telas. */
function literalAddrs(): number[] {
  const out = new Set<number>();
  for (const f of [...walk(`${SRC}render`), ...walk(`${SRC}screens`)].filter(f => f.endsWith('.ts'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/0x([c-fC-F][0-9a-fA-F]{5})\b/g)) out.add(parseInt(m[1], 16));
  }
  return [...out].sort((a, b) => a - b);
}

describe.skipIf(!ROM)('pacote da ROM: todos os assets decodificam', () => {
  const a = createRomAssets(ROM!);
  it('arenas 1..10', () => {
    for (let st = 1; st <= 10; st++) expect(a.arena(st).bgTiles).toBeTruthy();
  });
  it('personagens: folhas, vitória, paletas e rostos do HUD', () => {
    for (let c = 0; c < 6; c++) {
      const ch = a.character(c);
      for (let g = 0; g < SHEET_FRAMES; g++) ch.frame(g);
      for (let g = 0; g < 4; g++) ch.victoryFrame(g);           // a vitória tem 4 quadros
      for (let slot = 0; slot < 5; slot++) { ch.hudHead(slot); ch.hudCry(slot); }
      expect(ch.palettes.length).toBe(5);
    }
  });
  it('montarias e trajes: folhas inteiras', () => {
    const sheets = [...Object.values(MOUNT_GFX).map(g => g.src), ...Object.values(COSTUME_SHEETS)];
    for (const src of sheets) {
      for (let g = 0; g < MOUNT_FRAMES; g++) sheetFrame(a.rom, src, g);
      a.rom.bytes(src, 0x4000);                                  // mountGfx lê a folha crua
    }
    expect(sheets.length).toBeGreaterThan(13);
  });
  it('cenas, Mode 7, scripts de bomba e áudio', () => {
    for (const id of SCENE_IDS) expect(a.scene(id).vram.length).toBe(0x10000);
    expect(a.mode7Draw().chr.length).toBe(0x4000);
    for (let t = 0; t < 3; t++) a.bombScript(t);
    const au = a.audioData();
    expect(au.data.bytes.length).toBeGreaterThan(300_000);
  });
  it('cada endereço da ROM citado no código de desenho (animações, paletas, tabelas)', () => {
    const addrs = literalAddrs();
    for (const ad of addrs) {
      try { a.rom.bytes(ad, LITERAL_BYTES); } catch { /* fora da ROM */ }
      try { a.anim(ad); } catch { /* não é animação: os bytes crus já bastam */ }
    }
    expect(addrs.length).toBeGreaterThan(100);
  });
});
