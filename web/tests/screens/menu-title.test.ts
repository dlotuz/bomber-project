import { S } from '../../src/render/text/strings';
import { buildRomFont, layoutText } from '../../src/render/text/text';
import { MODE_TITLE } from '../../src/screens/vs';
import { PLAYERS_TITLE } from '../../src/screens/players';
import { RULES_TITLE } from '../../src/screens/rules';
import { ASSETS } from './rom';

/** Faixa de texto do título em cada captura — o 1º retângulo `text` dos CASES de `scene.test.ts` (a área que o teste
 *  de moldura ignora porque o texto é nosso). Copiado aqui para não importar um arquivo de teste. */
const CASES = [
  { scene: 'ffa', text: S.vs.title, at: MODE_TITLE, band: { x0: 60, y0: 60, x1: 194, y1: 78 } },
  { scene: 'players', text: S.players.title, at: PLAYERS_TITLE, band: { x0: 46, y0: 12, x1: 208, y1: 32 } },
  { scene: 'rules', text: S.rules.title, at: RULES_TITLE, band: { x0: 52, y0: 20, x1: 202, y1: 40 } },
] as const;

describe.skipIf(!ASSETS)('título dos menus preso à faixa de texto da captura (fonte menuTitle da ROM)', () => {
  it.for(CASES)('$scene', ({ text, at, band }) => {
    const img = layoutText(buildRomFont('menuTitle', ASSETS!)!, text);
    const x0 = at.x - Math.floor(img.w / 2), y0 = at.y;           // drawText com align 'center'
    const x1 = x0 + img.w - 1, y1 = y0 + img.h - 1;
    // Vertical: dentro da faixa. Horizontal: centrado nela, com 1 px de folga — "Escolha o modo VS!" tem 136 px e a
    // faixa do VS, 135 (um número par de px não centra num ímpar).
    expect([y0 >= band.y0, y1 <= band.y1], `y ${y0}..${y1}`).toEqual([true, true]);
    expect(x0, `x ${x0}..${x1}`).toBeGreaterThanOrEqual(band.x0 - 1);
    expect(x1, `x ${x0}..${x1}`).toBeLessThanOrEqual(band.x1 + 1);
    expect(Math.abs((x0 + x1) - (band.x0 + band.x1))).toBeLessThanOrEqual(2);
  });
});
