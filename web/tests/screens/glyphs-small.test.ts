import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { missingGlyphs, buildRomFont, timeUpLabel, layoutText, decodeStrip, shrinkTop, fontFromParts, styleColors, type RomFont } from '../../src/render/text/text';
import type { IndexedImage, StyleRomDef } from '../../src/render/text/types';
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
  it('banner: meta.timeUpWidth = largura de "TIME UP!" na faixa (x 32-102) e na captura', () => {
    expect(GLYPH_MAPS.banner!.meta!.timeUpWidth).toBe(71);
  });
});

const img = (rows: string[]): IndexedImage => ({ w: rows[0].length, h: rows.length, px: Uint8Array.from(rows.join('').split('').map(Number)) });
const rowsOf = (g: IndexedImage): string[] => Array.from({ length: g.h }, (_, y) => [...g.px.subarray(y * g.w, y * g.w + g.w)].join(''));

describe('shrinkTop (acento em fonte sem linha livre em cima)', () => {
  // A do ascii8: linhas 2=3 e 5=6 repetidas, barra na linha 4
  const A = img(['11131111', '11313111', '13111311', '13111311', '13333311', '13111311', '13111311', '11111111']);
  it('tira a linha repetida mais perto do meio e mantém a barra do A', () => {
    expect(rowsOf(shrinkTop(A, 1))).toEqual(['00000000', '11131111', '11313111', '13111311', '13333311', '13111311', '13111311', '11111111']);
  });
  it('com 2 linhas tira as duas repetidas', () => {
    expect(rowsOf(shrinkTop(A, 2))).toEqual(['00000000', '00000000', '11131111', '11313111', '13111311', '13333311', '13111311', '11111111']);
  });
  it('sem linha repetida reamostra (mesmo tamanho, n linhas vazias no topo)', () => {
    const g = shrinkTop(img(['1', '2', '3', '4']), 1);
    expect(g.h).toBe(4);
    expect(rowsOf(g)[0]).toBe('0');
    expect(rowsOf(g).slice(1)).toEqual(expect.arrayContaining(['1', '4']));
  });
  it('n = 0 devolve a base', () => expect(shrinkTop(A, 0)).toBe(A));
});

describe('GlyphCut.spans (divisa por linha em fonte cursiva)', () => {
  const def: StyleRomDef = {
    strips: {}, height: 2, spacing: 0, spaceWidth: 1, palette: { kind: 'rom', addr: 0, size: 4 },
    cuts: [{ ch: 'a', strip: 's', x: 0, w: 3, spans: [[0, 2], [0, 1]] }, { ch: 'b', strip: 's', x: 1, w: 3, spans: [[2, 4], [1, 4]] }],
  };
  const f = fontFromParts('banner', def, { s: img(['1233', '1233']) }, []);
  it('zera o que está fora do intervalo da linha', () => {
    expect(rowsOf(f.glyphs.get('a')!)).toEqual(['120', '100']);
    expect(rowsOf(f.glyphs.get('b')!)).toEqual(['033', '233']);
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
    // com a ROM: "TEMPO ESGOTADO!" mede muito mais que 1,25 × 71 px, então sai "TEMPO!"
    expect(timeUpLabel(ASSETS)).toBe('TEMPO!');
  });
  it('banner: "PAUSE!" remontado com os recortes = a faixa original no mesmo x (pixel a pixel)', () => {
    const f = buildRomFont('banner', ASSETS!)!;
    const strip = decodeStrip(GLYPH_MAPS.banner!.strips.top, ASSETS!);
    const lay = layoutText(f, 'PAUSE!');
    expect(lay.w).toBe(65);
    let same = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < lay.w; x++) if (lay.px[y * lay.w + x] === strip.px[y * strip.w + 8 + x]) same++;
    expect(same / (16 * lay.w)).toBeGreaterThanOrEqual(0.97);
    expect(same).toBe(16 * lay.w);
  });
  it('banner e spriteBlue: todo glifo tem 16 px de altura', () => {
    for (const st of ['banner', 'spriteBlue'] as const) for (const [ch, g] of buildRomFont(st, ASSETS!)!.glyphs) expect(g.h, `${st} ${ch}`).toBe(16);
  });
  it('spriteBlue: "Select a stage!" remontado ≈ a linha 0 da faixa (x 1-108)', () => {
    const f = buildRomFont('spriteBlue', ASSETS!)!;
    const strip = decodeStrip(GLYPH_MAPS.spriteBlue!.strips.f, ASSETS!);
    const lay = layoutText(f, 'Select a stage!');
    expect(Math.abs(lay.w - 108)).toBeLessThanOrEqual(1);
    let same = 0, ink = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < Math.min(lay.w, 108); x++) {
      const a = lay.px[y * lay.w + x], b = strip.px[y * strip.w + 1 + x];
      if (a || b) { ink++; if (a === b) same++; }
    }
    expect(same / ink).toBeGreaterThanOrEqual(0.97);   // medido: 98,7 % (o 2º e / a vêm de outra ocorrência)
    // palavra a palavra, cada uma no seu x original
    for (const [word, x0] of [['Select', 1], ['a', 51], ['stage!', 64]] as const) {
      const w = layoutText(f, word);
      let eq = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < w.w; x++) if (w.px[y * w.w + x] === strip.px[y * strip.w + x0 + x]) eq++;
      expect(eq / (16 * w.w), word).toBeGreaterThanOrEqual(0.97);
    }
  });
  it('spriteBlue: paleta = CGRAM linha 9 da stagesel (contorno (0,16,248) … branco)', () => {
    const c = styleColors(GLYPH_MAPS.spriteBlue!, ASSETS!);
    expect(c[1]).toBe((31 << 10) | (2 << 5));   // BGR555 de (0,16,248)
    expect(c[15]).toBe(0x7fff);
  });
  it('ascii8: Ã mantém a barra do A (linha 13333311) com o til em cima', () => {
    const g = buildRomFont('ascii8', ASSETS!)!.glyphs.get('Ã')!;
    const rows = rowsOf(g);
    expect(rows).toContain('13333311');
    expect(rows[0]).toMatch(/3/);
  });
  it('recortes não ficam vazios', () => {
    for (const st of STYLES) {
      const f = buildRomFont(st, ASSETS!)!;
      for (const c of GLYPH_MAPS[st]!.cuts) expect(f.glyphs.get(c.ch)!.px.filter(v => v !== 0).length, `${st} ${c.ch}`).toBeGreaterThan(0);
    }
  });
});
