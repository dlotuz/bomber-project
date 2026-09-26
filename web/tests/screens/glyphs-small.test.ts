import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { missingGlyphs, buildRomFont, timeUpLabel, type RomFont } from '../../src/render/text/text';
import { ASSETS } from './rom';

const STYLES = ['ascii8', 'banner', 'spriteBlue'] as const;
const TONES: Record<string, string[]> = { banner: ['green'] };
const FIXTURE = join(__dirname, '../fixtures/rom/glyphs-small.json');

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
  it('banner: meta.timeUpWidth medido', () => {
    expect(GLYPH_MAPS.banner!.meta!.timeUpWidth).toBeGreaterThan(0);
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
  it('R27: timeUpLabel() usa TEMPO ESGOTADO! ou TEMPO! conforme a largura de TIME UP! na ROM', () => {
    expect(['TEMPO ESGOTADO!', 'TEMPO!']).toContain(timeUpLabel());
  });
  it('recortes não ficam vazios', () => {
    for (const st of STYLES) {
      const f = buildRomFont(st, ASSETS!)!;
      for (const c of GLYPH_MAPS[st]!.cuts) expect(f.glyphs.get(c.ch)!.px.filter(v => v !== 0).length, `${st} ${c.ch}`).toBeGreaterThan(0);
    }
  });
});
