import { S, STRING_USES, STAGE_NAMES_PT, RACER_PRIZE_NAMES } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { EXTRA_GLYPHS } from '../../src/render/text/extra-glyphs';
import { TEXT_STYLES, type StyleRomDef, type IndexedImage, type TextStyleId } from '../../src/render/text/types';
import {
  parseExtra, fontFromParts, layoutText, glyphChars, missingGlyphs, fallbackMissing, indexedToRgba, timeUpLabel, drawText,
  buildRomFont, textWidth,
} from '../../src/render/text/text';
import { ASSETS } from './rom';

const img = (w: number, h: number, fill = 1): IndexedImage => ({ w, h, px: new Uint8Array(w * h).fill(fill) });
const def = (cuts: StyleRomDef['cuts'], extra: Partial<StyleRomDef> = {}): StyleRomDef => ({
  strips: { a: { kind: 'raw', rows: [0], tiles: 4, bpp: 4 } }, cuts, height: 8, spacing: 1, spaceWidth: 4,
  palette: { kind: 'rom', addr: 0, size: 16 }, ...extra,
});

describe('strings PT-BR (spec §6)', () => {
  it('nomes das 10 fases', () => {
    expect(STAGE_NAMES_PT).toEqual(['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
      'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria']);
  });
  it('textos da spec, na caixa do original', () => {
    expect([S.title.normal, S.title.battle, S.title.options, S.title.pressStart]).toEqual(['JOGO NORMAL', 'JOGO DE BATALHA', 'OPÇÕES', 'APERTE START!']);
    expect([S.vs.title, S.vs.royale, S.vs.champ, S.vs.mania, S.vs.ffa, S.vs.team])
      .toEqual(['Escolha o modo VS!', 'Battle Royale', 'Campeonato', 'Bombermania', 'Todos contra Todos', 'Em Equipes']);
    expect(S.players.row).toEqual(['1º Jogador', '2º Jogador', '3º Jogador', '4º Jogador', '5º Jogador']);
    expect([S.players.human, S.players.cpu, S.players.off]).toEqual(['Humano', 'CPU', 'Nenhum']);
    expect(S.rules.labels).toEqual(['Nível da CPU', 'Coroas', 'Tempo', 'Morte Súbita', 'Bomber Vingador', 'Corrida Bônus']);
    expect(S.rules.time).toEqual(['1:00', '2:00', '3:00', '5:00', '∞']);
    expect([S.stage.title, S.stage.stage(7), S.stage.battle]).toEqual(['Escolha a fase!', 'Fase 7', 'BATALHA!']);
    expect([S.battle.pause, S.battle.hurry, S.battle.timeUp, S.battle.timeUpShort, S.battle.disconnected(3)])
      .toEqual(['PAUSA!', 'RÁPIDO!!', 'TEMPO ESGOTADO!', 'TEMPO!', 'CONTROLE 3 DESCONECTADO']);
    expect([S.score.title, S.draw.title, S.victory.title, S.racer.press]).toEqual(['PLACAR', 'EMPATE', 'VITÓRIA!', 'APERTE B!']);
    expect([S.chars.title, S.teams.title]).toEqual(['Escolha um personagem!', 'Escolha as equipes!']);
  });
  it('nome PT-BR para cada chave de prêmio do Racer', () => {
    expect(Object.keys(RACER_PRIZE_NAMES).sort()).toEqual(['bomb+1', 'fire+1', 'fullFire', 'glove', 'heart', 'kick', 'none', 'p',
      'passBomb', 'passSoft', 'pierce', 'punch', 'remote+glove', 'speed+1', 'speed-1'].sort());
  });
  it('STRING_USES cobre cada estilo e não repete pares', () => {
    for (const st of TEXT_STYLES) expect(STRING_USES.some(u => u.style === st), st).toBe(true);
    const keys = STRING_USES.map(u => `${u.style}|${u.text}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('fallback: todo texto do jogo tem glifo (sem ROM)', () => {
    const miss = STRING_USES.flatMap(u => fallbackMissing(u.text).map(c => `${u.text} → ${c}`));
    expect(miss).toEqual([]);
  });
});

describe('registros de estilo', () => {
  it('um mapa e uma lista de glifos próprios por estilo', () => {
    expect(Object.keys(GLYPH_MAPS).sort()).toEqual([...TEXT_STYLES].sort());
    expect(Object.keys(EXTRA_GLYPHS).sort()).toEqual([...TEXT_STYLES].sort());
  });
  it('glifos próprios bem formados: linhas do mesmo tamanho, altura do estilo, caracteres válidos', () => {
    for (const st of TEXT_STYLES) {
      const d = GLYPH_MAPS[st];
      for (const g of EXTRA_GLYPHS[st]) {
        const w = g.rows[0].length;
        expect(g.rows.every(r => r.length === w), `${st} ${g.ch}`).toBe(true);
        if (d) expect(g.rows.length, `${st} ${g.ch} altura`).toBe(d.height);
        const legal = new Set(['.', ...(g.legend ? Object.keys(g.legend) : '0123456789abcdef'.split(''))]);
        expect(g.rows.join('').split('').every(c => legal.has(c)), `${st} ${g.ch} caracteres`).toBe(true);
      }
    }
  });
});

describe('motor (puro, sem ROM)', () => {
  it('parseExtra: hex por padrão, "." = 0, legenda opcional', () => {
    expect(Array.from(parseExtra({ ch: 'X', rows: ['1.', '.f'] }).px)).toEqual([1, 0, 0, 15]);
    const g = parseExtra({ ch: 'P', rows: ['#+'], legend: { '#': 0x41, '+': 0x42 } });
    expect([g.w, g.h, ...g.px]).toEqual([2, 1, 0x41, 0x42]);
  });
  it('fontFromParts recorta pela x/largura da faixa; o recorte da ROM vence o glifo próprio', () => {
    const strip: IndexedImage = { w: 8, h: 8, px: new Uint8Array(64).map((_, i) => (i % 8) + 1) };
    const f = fontFromParts('menuItem', def([{ ch: 'A', strip: 'a', x: 2, w: 3 }]), { a: strip },
      [{ ch: 'A', rows: Array(8).fill('9') }, { ch: 'B', rows: Array(8).fill('77') }]);
    expect(f.glyphs.get('A')!.w).toBe(3);
    expect(f.glyphs.get('A')!.px[0]).toBe(3);                 // coluna x = 2 → índice 3
    expect(f.glyphs.get('B')!.w).toBe(2);
  });
  it('layoutText: glifos + espaçamento + espaço', () => {
    const f = fontFromParts('menuItem', def([]), {}, [{ ch: 'A', rows: Array(8).fill('11') }, { ch: 'B', rows: Array(8).fill('222') }]);
    const t = layoutText(f, 'A B');
    expect([t.w, t.h]).toEqual([2 + 1 + 4 + 1 + 3, 8]);
    expect(t.px[0]).toBe(1);
    expect(t.px[2]).toBe(0);                                   // espaçamento transparente
  });
  it('glyphChars e missingGlyphs (sem ROM: só os fatos)', () => {
    const maps = { ...GLYPH_MAPS, menuItem: def([{ ch: 'A', strip: 'a', x: 0, w: 2 }]) } as typeof GLYPH_MAPS;
    const extras = { ...EXTRA_GLYPHS, menuItem: [{ ch: 'Ç', rows: Array(8).fill('1') }] } as typeof EXTRA_GLYPHS;
    expect([...glyphChars('menuItem', maps, extras)].sort()).toEqual(['A', 'Ç']);
    expect(missingGlyphs('menuItem', 'AÇ AB', maps, extras)).toEqual(['B']);
  });
  it('indexedToRgba: 0 transparente, índices pela paleta', () => {
    const rgba = indexedToRgba({ w: 2, h: 1, px: new Uint8Array([0, 1]) }, new Uint16Array([0, 0x001f]));
    expect(Array.from(rgba)).toEqual([0, 0, 0, 0, 255, 0, 0, 255]);
  });
  it('TEMPO ESGOTADO! sem ROM', () => { expect(timeUpLabel()).toBe('TEMPO ESGOTADO!'); });
});

describe('bodyOnly + outline (fonte cursiva com contorno compartilhado entre letras)', () => {
  // Faixa 8×8: linha de índice 2 (contorno) nas bordas e no meio (encostaria a letra vizinha), 9 (corpo) no resto.
  const strip: IndexedImage = {
    w: 8, h: 8, px: new Uint8Array([
      2, 2, 2, 2, 2, 2, 2, 2,
      2, 9, 9, 2, 2, 9, 9, 2,
      2, 9, 9, 2, 2, 9, 9, 2,
      2, 2, 2, 2, 2, 2, 2, 2,
      2, 9, 9, 2, 2, 9, 9, 2,
      2, 9, 9, 2, 2, 9, 9, 2,
      2, 2, 2, 2, 2, 2, 2, 2,
      2, 2, 2, 2, 2, 2, 2, 2,
    ]),
  };
  it('sem bodyOnly/outline: recorte simples traz o contorno junto (comportamento de antes, sem mudança)', () => {
    const f = fontFromParts('menuItem', def([{ ch: 'A', strip: 'a', x: 0, w: 4 }]), { a: strip }, []);
    const g = f.glyphs.get('A')!;
    expect(g.px[0]).toBe(2);                         // contorno preservado no recorte cru
  });
  it('bodyOnly: cutGlyph zera tudo que não é corpo (some o contorno do recorte)', () => {
    const f = fontFromParts('menuItem', def([{ ch: 'A', strip: 'a', x: 0, w: 4, h: 4 }], { bodyOnly: [9] }), { a: strip }, []);
    const g = f.glyphs.get('A')!;
    expect(Array.from(g.px)).toEqual([0, 0, 0, 0, 0, 9, 9, 0, 0, 9, 9, 0, 0, 0, 0, 0]);
  });
  it('outline sem bodyOnly não muda nada (a frase já não tem pixel 0 colado no corpo)', () => {
    const f = fontFromParts('menuItem', def([{ ch: 'A', strip: 'a', x: 1, w: 2, y: 1, h: 2 }], { outline: { index: 3 }, height: 2 }), { a: strip }, []);
    const t = layoutText(f, 'A');
    expect(Array.from(t.px)).toEqual([9, 9, 9, 9]);   // sem 0 adjacente ao corpo dentro do recorte: nada pra contornar
  });
  it('bodyOnly + outline: recorta só o corpo de duas letras vizinhas e redesenha o contorno na frase montada', () => {
    const bodyDef = def([{ ch: 'A', strip: 'a', x: 0, w: 3 }, { ch: 'B', strip: 'a', x: 4, w: 3 }],
      { bodyOnly: [9], outline: { index: 2 }, spacing: 0, height: 3 });
    const f = fontFromParts('menuItem', bodyDef, { a: strip }, []);
    const t = layoutText(f, 'AB');
    // A = colunas 0-2 (corpo em 1-2), B = colunas 4-6 (corpo em 5-6) de uma faixa 3 alta (linhas 1-3 do strip)
    expect(t.w).toBe(6);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) {
      const v = t.px[y * 6 + x];
      expect(v === 0 || v === 9 || v === 2, `x=${x} y=${y} v=${v}`).toBe(true);
    }
    expect(Array.from(t.px).some(v => v === 9)).toBe(true);   // corpo preservado
    expect(Array.from(t.px).some(v => v === 2)).toBe(true);   // contorno regenerado
    // as duas letras não se fundem: a coluna do meio (gap entre A e B) não vira uma mancha sólida de corpo
    expect(t.px[1 * 6 + 3]).not.toBe(9);
  });
});

describe('drawText no fallback', () => {
  const bank = { text: (s: string, c: string) => ({ width: s.length * 6 - 1 + 2, height: 12, tag: `${s}|${c}` }) };
  const calls: { tag: string; x: number; y: number; w: number }[] = [];
  const ctx = { drawImage: (im: { tag: string; width: number }, x: number, y: number, w?: number) => calls.push({ tag: im.tag, x, y, w: w ?? im.width }) };
  beforeEach(() => { calls.length = 0; });
  it('centraliza e usa a cor do tom', () => {
    const w = drawText(ctx as never, bank as never, 'menuItem', 'CPU', 100, 50, { align: 'center', tone: 'red' });
    expect(calls).toHaveLength(1);
    expect(calls[0].x).toBe(100 - Math.floor(w / 2));
    expect(calls[0].tag.endsWith('#e8402a')).toBe(true);
  });
  it('estilos grandes com escala 2', () => {
    const w = drawText(ctx as never, bank as never, 'bigVictory', 'VITÓRIA!', 0, 0);
    expect(calls[0].w).toBe(w);
    expect(w).toBe(2 * (8 * 6 - 1 + 2));
  });
  it('textWidth no fallback bate com o desenho', () => {
    expect(textWidth('ascii8', 'ABC')).toBe(3 * 6 - 1 + 2);
  });
});

describe.skipIf(!ASSETS)('estilos com ROM', () => {
  it.each(TEXT_STYLES as unknown as TextStyleId[])('%s: cada glifo tem a altura do estilo e pixels não nulos', st => {
    const d = GLYPH_MAPS[st];
    if (!d) return;
    const f = buildRomFont(st, ASSETS!)!;
    expect(f).not.toBeNull();
    for (const [ch, g] of f.glyphs) {
      expect(g.h, `${st} ${ch}`).toBe(d.height);
      expect(g.px.some(v => v !== 0), `${st} ${ch} vazio`).toBe(true);
    }
  });
});
