import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { missingGlyphs, buildRomFont, layoutText, decodeStrip, type RomFont } from '../../src/render/text/text';
import type { IndexedImage } from '../../src/render/text/types';
import { ASSETS } from './rom';

const STYLES = ['titleMenu', 'menuTitle', 'menuItem'] as const;
const TONES: Record<string, string[]> = { titleMenu: ['gray'], menuItem: ['gray', 'green', 'red', 'blue'] };
const FIXTURE = join(__dirname, '../fixtures/rom/glyphs-menus.json');

function glyphHash(f: RomFont): string {
  const h = createHash('sha1');
  for (const ch of [...f.glyphs.keys()].sort()) { const g = f.glyphs.get(ch)!; h.update(`${ch}:${g.w}x${g.h}:`); h.update(g.px); }
  return h.digest('hex');
}

describe('glifos: mapas e cobertura (sem ROM)', () => {
  it.each(STYLES)('%s tem mapa e cobre todo texto do jogo neste estilo', st => {
    expect(GLYPH_MAPS[st]).not.toBeNull();
    const miss = STRING_USES.filter(u => u.style === st).flatMap(u => missingGlyphs(st, u.text).map(c => `"${u.text}" → ${c}`));
    expect(miss).toEqual([]);
  });
  it.each(STYLES)('%s: tons usados pelas telas existem', st => {
    for (const t of TONES[st] ?? []) expect(GLYPH_MAPS[st]!.tones?.[t as never], `${st}.${t}`).toBeDefined();
  });
});

describe.skipIf(!ASSETS)('glifos com ROM', () => {
  it.each(STYLES)('%s: hash dos glifos decodificados = fixture', st => {
    const f = buildRomFont(st, ASSETS!)!;
    const got = { glyphs: f.glyphs.size, sha1: glyphHash(f) };
    const fx = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : { rom: '38f4394986bd39fcbe32a722a3fe103ee6177d9b', styles: {} };
    if (process.env.UPDATE_FIXTURES) { fx.styles[st] = got; writeFileSync(FIXTURE, JSON.stringify(fx, null, 2) + '\n'); }
    expect(fx.styles[st]).toEqual(got);
  });
});

/** Fidelidade (T16, fix round 3): cada frase da ROM é remontada com `layoutText` (o caminho do jogo: um glifo por
 *  letra, reusado onde repete, com o kerning do estilo) e comparada pixel a pixel com a faixa crua (com a sombra da
 *  ROM, que o estilo redesenha por `outline`). "tinta" = só a união dos pixels não nulos das duas imagens. Limiares
 *  um pouco abaixo do medido (ver task-16-report.md, Fix report 3). BATTLE GAME fica em ~96,5 % de tinta: os dois T e
 *  o L encostados têm bordas antisserrilhadas diferentes em cada par, e um glifo só por letra não reproduz as duas. */
const FIDELITY: { style: 'titleMenu' | 'menuTitle' | 'menuItem'; strip: string; row: number; x: number; text: string; all: number; ink: number }[] = [
  { style: 'menuItem', strip: 'vs', row: 2, x: 0, text: 'Championship', all: 0.99, ink: 0.99 },
  { style: 'menuItem', strip: 'vs', row: 3, x: 0, text: 'Bombermania', all: 0.99, ink: 0.98 },
  { style: 'menuItem', strip: 'vs', row: 1, x: 0, text: 'Battle Royale', all: 0.98, ink: 0.97 },
  { style: 'menuTitle', strip: 'vs', row: 0, x: 0, text: 'Select a VS mode!', all: 0.99, ink: 0.97 },
  { style: 'titleMenu', strip: 'normalgame', row: 0, x: 7, text: 'NORMAL GAME', all: 0.98, ink: 0.97 },
  { style: 'titleMenu', strip: 'battlegame', row: 0, x: 7, text: 'BATTLE GAME', all: 0.97, ink: 0.96 },
  { style: 'titleMenu', strip: 'password', row: 0, x: 7, text: 'PASSWORD', all: 0.98, ink: 0.97 },
];
function fidelity(f: RomFont, strip: IndexedImage, row: number, x0: number, text: string): { all: number; ink: number } {
  const r = layoutText(f, text);
  let total = 0, match = 0, ink = 0, inkMatch = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < r.w; x++) {
    const a = r.px[y * r.w + x], X = x0 + x, b = X < strip.w ? strip.px[(row * 16 + y) * strip.w + X] : 0;
    total++; if (a === b) match++;
    if (a || b) { ink++; if (a === b) inkMatch++; }
  }
  return { all: match / total, ink: inkMatch / ink };
}
describe.skipIf(!ASSETS)('fidelidade: frases da ROM remontadas por layoutText', () => {
  it.each(FIDELITY)('$style "$text"', ({ style, strip, row, x, text, all, ink }) => {
    const f = buildRomFont(style, ASSETS!)!;
    const got = fidelity(f, decodeStrip(GLYPH_MAPS[style]!.strips[strip], ASSETS!), row, x, text);
    expect(got.all, 'todos os pixels').toBeGreaterThanOrEqual(all);
    expect(got.ink, 'só tinta').toBeGreaterThanOrEqual(ink);
  });
});
