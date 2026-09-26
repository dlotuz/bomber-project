import { STRING_USES, S } from '../../src/render/text/strings';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { TEXT_STYLES } from '../../src/render/text/types';
import { missingGlyphs, fallbackMissing, buildRomFont, layoutText } from '../../src/render/text/text';
import { ASSETS } from './rom';

describe('cobertura de glifos (aceite do plano 10)', () => {
  it.each([...TEXT_STYLES])('%s: tem mapa da ROM', st => { expect(GLYPH_MAPS[st]).not.toBeNull(); });
  it('com ROM (fatos): todo texto tem glifo no seu estilo', () => {
    expect(STRING_USES.flatMap(u => missingGlyphs(u.style, u.text).map(c => `${u.style} "${u.text}" → ${c}`))).toEqual([]);
  });
  it('sem ROM: todo texto tem glifo na fonte do fallback', () => {
    expect(STRING_USES.flatMap(u => fallbackMissing(u.text).map(c => `"${u.text}" → ${c}`))).toEqual([]);
  });
  it.skipIf(!ASSETS)('com a ROM de verdade: todo texto rende com largura > 0 e sem glifo vazio', () => {
    for (const u of STRING_USES) {
      const img = layoutText(buildRomFont(u.style, ASSETS!)!, u.text);
      expect(img.w, `${u.style} "${u.text}"`).toBeGreaterThan(0);
    }
  });
  it.skipIf(!ASSETS)('com a ROM de verdade: rodapés e avisos em ascii8 cabem nos 256 px da tela', () => {
    const f = buildRomFont('ascii8', ASSETS!)!;
    const lines = [S.chars.help, S.chars.allReady, S.teams.help, S.options.pressKey, S.options.pressPad, S.options.forgetAsk,
      ...[1, 2, 3, 4].map(S.battle.disconnected)];
    expect(lines.filter(t => layoutText(f, t).w > 256)).toEqual([]);
  });
});
