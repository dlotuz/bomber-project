import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STRING_USES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { EXTRA_GLYPHS } from '../../src/render/text/extra-glyphs';
import { missingGlyphs, buildRomFont, fontFromParts, layoutText, maskCut, type RomFont } from '../../src/render/text/text';
import type { IndexedImage, StyleRomDef } from '../../src/render/text/types';
import { ASSETS } from './rom';

const STYLES = ['bigBattle', 'bigScore', 'bigVictory', 'bigDraw'] as const;
const TONES: Record<string, string[]> = {};
const FIXTURE = join(__dirname, '../fixtures/rom/glyphs-big.json');

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
  it('glifos próprios obrigatórios estão no EXTRA; Ó usa o O da ROM como base', () => {
    const own = (st: typeof STYLES[number]) => EXTRA_GLYPHS[st].map(g => g.ch).sort();
    expect(own('bigBattle')).toEqual(['H']);
    expect(own('bigScore')).toEqual(['L', 'P']);
    expect(own('bigVictory')).toEqual(['A', 'Ó']);
    expect(own('bigDraw')).toEqual(['P', 'T']);
    expect(EXTRA_GLYPHS.bigVictory.find(g => g.ch === 'Ó')!.base).toBe('O');
    expect(GLYPH_MAPS.bigVictory!.cuts.some(c => c.ch === 'O')).toBe(true);
  });
});

describe('motor: extensões da T18 (puro)', () => {
  const def = (extra: Partial<StyleRomDef> = {}): StyleRomDef => ({
    strips: {}, cuts: [], height: 3, spacing: 0, spaceWidth: 2, palette: { kind: 'rom', addr: 0, size: 16 }, ...extra,
  });
  it('maskCut: inunda pelos índices de preenchimento e cresce pelo contorno; o vizinho some', () => {
    const g: IndexedImage = { w: 7, h: 1, px: new Uint8Array([1, 5, 5, 1, 1, 6, 1]) };
    expect(Array.from(maskCut(g, [[1, 0]], { fill: [5, 6], edge: [1], grow: 1 }).px)).toEqual([1, 5, 5, 1, 0, 0, 0]);
    expect(Array.from(maskCut(g, [[5, 0]], { fill: [5, 6], edge: [1], grow: 2 }).px)).toEqual([0, 0, 0, 1, 1, 6, 1]);
  });
  it('glifo com base: a letra recortada com o desenho por cima (pixels "." mantêm a base)', () => {
    const strip: IndexedImage = { w: 2, h: 3, px: new Uint8Array([0, 0, 7, 7, 7, 7]) };
    const f = fontFromParts('bigVictory', def({ cuts: [{ ch: 'O', strip: 's', x: 0, w: 2 }] }), { s: strip },
      [{ ch: 'Ó', base: 'O', rows: ['.3', '..', '..'] }]);
    expect(Array.from(f.glyphs.get('Ó')!.px)).toEqual([0, 3, 7, 7, 7, 7]);
    expect(Array.from(f.glyphs.get('O')!.px)).toEqual([0, 0, 7, 7, 7, 7]);
  });
  it('kern por par soma ao spacing só entre aquele par (largura e posição)', () => {
    const f = fontFromParts('bigVictory', def({ spacing: 1, kern: { AB: -2 } }), {}, [{ ch: 'A', rows: ['11', '11', '11'] }, { ch: 'B', rows: ['22', '22', '22'] }]);
    expect(layoutText(f, 'AB').w).toBe(2 + 1 - 2 + 2);
    expect(Array.from(layoutText(f, 'AB').px.slice(0, 3))).toEqual([1, 2, 2]);
    expect(layoutText(f, 'BA').w).toBe(2 + 1 + 2);
  });
  it('glifo com base só conta como coberto se a letra-base tiver recorte', () => {
    const maps = { ...GLYPH_MAPS, bigVictory: def({ strips: { s: { kind: 'mode7', x: 0, y: 0, w: 1, h: 1 } }, cuts: [{ ch: 'O', strip: 's', x: 0, w: 1 }] }) };
    const extras = { ...EXTRA_GLYPHS, bigVictory: [{ ch: 'Ó', base: 'O', rows: ['.'] }, { ch: 'Ú', base: 'U', rows: ['.'] }] };
    expect(missingGlyphs('bigVictory', 'ÓÚ', maps, extras)).toEqual(['Ú']);
  });
  it('layoutText com espaçamento negativo sobrepõe sem apagar a letra anterior', () => {
    const f = fontFromParts('bigVictory', def({ spacing: -1 }), {}, [{ ch: 'A', rows: ['11', '11', '11'] }, { ch: 'B', rows: ['.2', '.2', '.2'] }]);
    const t = layoutText(f, 'AB');
    expect(t.w).toBe(3);
    expect(Array.from(t.px.slice(0, 3))).toEqual([1, 1, 2]);
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
  it('bigDraw: E, M e A vêm da textura Modo 7; P e T do EXTRA', () => {
    const d = GLYPH_MAPS.bigDraw!;
    for (const ch of ['E', 'M', 'A']) {
      const c = d.cuts.find(k => k.ch === ch)!;
      expect(d.strips[c.strip].kind, ch).toBe('mode7');
      expect(EXTRA_GLYPHS.bigDraw.some(g => g.ch === ch), ch).toBe(false);
    }
    const f = buildRomFont('bigDraw', ASSETS!)!;
    for (const ch of ['P', 'T']) {
      expect(d.cuts.some(k => k.ch === ch), ch).toBe(false);
      expect(f.glyphs.get(ch)!.px.some(v => v !== 0), ch).toBe(true);
    }
  });
  it('recortes mascarados não ficam vazios e as frases PT-BR cabem na tela', () => {
    for (const st of STYLES) {
      const f = buildRomFont(st, ASSETS!)!;
      for (const c of GLYPH_MAPS[st]!.cuts) expect(f.glyphs.get(c.ch)!.px.filter(v => v !== 0).length, `${st} ${c.ch}`).toBeGreaterThan(20);
      for (const u of STRING_USES.filter(k => k.style === st)) expect(layoutText(f, u.text).w, u.text).toBeLessThanOrEqual(256);
    }
  });
  it('VITÓRIA!: o kern TÓ encaixa a barra do T no entalhe do O (sobreposição real de pixels)', () => {
    const f = buildRomFont('bigVictory', ASSETS!)!;
    expect(GLYPH_MAPS.bigVictory!.kern?.['TÓ']).toBe(-20);
    const t = f.glyphs.get('T')!, o = f.glyphs.get('Ó')!, off = t.w + GLYPH_MAPS.bigVictory!.spacing - 20;
    let over = 0;
    for (let y = 0; y < t.h; y++) for (let x = off; x < t.w; x++) if (t.px[y * t.w + x] && o.px[y * o.w + x - off]) over++;
    expect(over).toBeGreaterThan(0);
  });
  it('Ó = O da ROM com o acento por cima (mesmo tamanho, pixels do O preservados onde o acento é vazio)', () => {
    const f = buildRomFont('bigVictory', ASSETS!)!;
    const o = f.glyphs.get('O')!, oa = f.glyphs.get('Ó')!;
    expect([oa.w, oa.h]).toEqual([o.w, o.h]);
    let diff = 0;
    o.px.forEach((v, i) => { if (v !== oa.px[i]) { diff++; expect(v).toBe(0); } });
    expect(diff).toBeGreaterThan(20);
  });
});
