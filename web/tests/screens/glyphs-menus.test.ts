import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { missingGlyphs, buildRomFont, layoutText, decodeStrip, type RomFont } from '../../src/render/text/text';
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

/** Fidelidade da reconstrução (T16, Fix report 2): `menuItem` recompõe "Battle Royale" com `layoutText` (o
 *  mesmo caminho usado em jogo — um glifo por letra, reusado onde repete) e compara pixel a pixel com a faixa
 *  crua original (`bodyOnly` desligado por dentro do `decodeStrip`, então esta faixa ainda tem o contorno cru
 *  da ROM tal como `layoutText` reconstrói via `outline`). Não bate 100%: os dois "t"/"l"/"e" de "Battle" têm
 *  larguras um pouco diferentes no desenho original (kerning cursivo variável), e um glifo só reusado nas duas
 *  ocorrências não capta isso — ver comentário de `l` em maps/menuItem.ts. Limiar com folga sobre os ~90%/~83%
 *  medidos, pra não quebrar por uma correção fina de 1 px num recorte. */
describe.skipIf(!ASSETS)('menuItem: fidelidade da reconstrução (Fix report 2)', () => {
  it('"Battle Royale" recomposto por layoutText bate a faixa original', () => {
    const f = buildRomFont('menuItem', ASSETS!)!;
    const original = decodeStrip(GLYPH_MAPS.menuItem!.strips.items, ASSETS!);
    const recon = layoutText(f, 'Battle Royale');
    let total = 0, match = 0, inkUnion = 0, inkMatch = 0;
    const w = Math.min(recon.w, original.w), h = 16;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      total++;
      const a = recon.px[y * recon.w + x], b = original.px[y * original.w + x];
      if (a === b) match++;
      if (a || b) { inkUnion++; if (a === b) inkMatch++; }
    }
    expect(match / total, 'acerto total de pixels').toBeGreaterThanOrEqual(0.85);
    expect(inkMatch / inkUnion, 'acerto só nos pixels com tinta').toBeGreaterThanOrEqual(0.75);
  });
});
