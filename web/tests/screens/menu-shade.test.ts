// I7 (revisão final do plano 10): miolo escurecido dos menus — BG3 $1004 na sub-tela, BG2 − BG3 (CGADSUB = $82).
import { ASSETS } from './rom';
import { loadCapture, capturedMap } from './captures';
import { capturePng, rgbAt, imgAt, type Rgb } from './png-read';
import { renderPpu, createImage, type PpuFrame } from '../../src/render/ppu';
import { sceneGfx, sceneFrame, handCursor, menuMaps, menuShade, shadeMap, MENU_SHADE, type MenuRect } from '../../src/render/screens-rom/scene';
import { vsSceneMaps, modeSceneMaps, VS_FRAME, MODE_FRAME } from '../../src/render/screens-rom/vs';
import { buildPlayersScene, PLAYERS_FRAME } from '../../src/render/screens-rom/players';
import { buildRulesScene, RULES_FRAME } from '../../src/render/screens-rom/rules';
import { optionsPpuFrame } from '../../src/render/screens-rom/options';

const FRAMES: Record<'vsmode' | 'ffa' | 'players' | 'rules', MenuRect> = { vsmode: VS_FRAME, ffa: MODE_FRAME, players: PLAYERS_FRAME, rules: RULES_FRAME };

describe('menuShade (puro)', () => {
  it('casas do miolo a partir da moldura medida', () => {
    expect(menuShade(VS_FRAME)).toEqual({ c0: 1, l0: 7, c1: 30, l1: 22 });
    expect(menuShade(MODE_FRAME)).toEqual({ c0: 1, l0: 9, c1: 30, l1: 20 });
    expect(menuShade(PLAYERS_FRAME)).toEqual({ c0: 1, l0: 3, c1: 30, l1: 26 });
    expect(menuShade(RULES_FRAME)).toEqual({ c0: 1, l0: 4, c1: 30, l1: 25 });
  });
  it('sceneFrame com `shade`: BG3 do miolo (VOFS −1) na principal e na sub-tela, subtração só no BG2', () => {
    const f = sceneFrame({ bgTiles: { bpp: 4, count: 0, px: new Uint8Array(0) }, bg3Tiles: { bpp: 2, count: 0, px: new Uint8Array(0) }, objTiles: { bpp: 4, count: 0, px: new Uint8Array(0) }, cgram: new Uint16Array(256) },
      menuMaps(VS_FRAME, 'vsmode'));
    expect(f.bg3!.vofs).toBe(-1);
    expect(f.bg3!.map[7 * 32 + 1]).toBe(MENU_SHADE.word);
    expect(f.bands[0]).toMatchObject({ main: 1 | 2 | 4 | 16, sub: 4, math: 'sub', mathLayers: 2 });
  });
});

describe.each(Object.entries(FRAMES))('BG3 do miolo × captura %s', (scene, frame) => {
  const cap = loadCapture(scene);
  it.skipIf(!cap)('mapa do BG3 igual ao da captura nas linhas visíveis (0–27)', () => {
    expect(cap!.ppu[0x31]).toBe(0x82);   // CGADSUB
    expect(cap!.ppu[0x2d]).toBe(0x04);   // TS
    expect(Array.from(shadeMap(menuShade(frame)).subarray(0, 28 * 32))).toEqual(Array.from(capturedMap(cap!, 0x5400, 32, 28)));
  });
});

/** Fração de pixels iguais em 5 bits por canal (as capturas expandem c → c·8; o nosso PPU, c·8 + c/4). */
function match5(img: ImageData, cap: Rgb, r: MenuRect, skip: readonly MenuRect[]): number {
  let same = 0, n = 0;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    if (skip.some(s => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1)) continue;
    n++;
    const a = imgAt(img, x, y), b = rgbAt(cap, x, y);
    if (a.every((v, i) => v >> 3 === b[i] >> 3)) same++;
  }
  return same / n;
}

describe.skipIf(!ASSETS)('miolo escurecido renderizado × captura (I7)', () => {
  const a = ASSETS!;
  // Áreas com texto nosso/da captura e a mão (ignoradas): as mesmas faixas de `scene.test.ts`.
  const CASES: { scene: keyof typeof FRAMES; frame: () => PpuFrame; text: MenuRect[] }[] = [
    { scene: 'vsmode', frame: () => sceneFrame(sceneGfx(a, 'vsmode'), vsSceneMaps(), { oam: [handCursor(56, 80)] }), text: [{ x0: 50, y0: 44, x1: 194, y1: 62 }, { x0: 50, y0: 76, x1: 176, y1: 158 }] },
    { scene: 'ffa', frame: () => sceneFrame(sceneGfx(a, 'ffa'), modeSceneMaps(), { oam: [handCursor(61, 96)] }), text: [{ x0: 50, y0: 60, x1: 194, y1: 78 }, { x0: 55, y0: 90, x1: 200, y1: 142 }] },
    { scene: 'players', frame: () => buildPlayersScene(a, { cursor: 0 }), text: [{ x0: 20, y0: 12, x1: 232, y1: 190 }] },
    { scene: 'rules', frame: () => buildRulesScene(a, { cursor: 0 }), text: [{ x0: 12, y0: 20, x1: 232, y1: 196 }] },
  ];
  for (const c of CASES) {
    const cap = capturePng(c.scene);
    it.skipIf(!cap)(`${c.scene}: o miolo tem a cor da captura (BG2 − $2108) e a borda de fora não escurece`, () => {
      const img = createImage();
      renderPpu(c.frame(), img);
      const s = menuShade(FRAMES[c.scene]);
      const inner = { x0: s.c0 * 8, y0: s.l0 * 8, x1: s.c1 * 8 + 7, y1: s.l1 * 8 + 7 };
      expect(match5(img, cap!, inner, c.text), 'miolo').toBeGreaterThanOrEqual(0.97);
      // Faixa acima da moldura (fora do miolo): sem subtração, igual à captura.
      expect(match5(img, cap!, { x0: 0, y0: 0, x1: 255, y1: 5 }, []), 'fora').toBeGreaterThanOrEqual(0.97);
      // Um pixel do miolo é exatamente o pixel de fora do mesmo desenho menos 8 por canal (5 bits).
      const px = imgAt(img, inner.x0 + 40, inner.y1 - 2).map(v => v >> 3), cp = rgbAt(cap!, inner.x0 + 40, inner.y1 - 2).map(v => v >> 3);
      expect(px).toEqual(cp);
    });
  }
  it('opções (moldura das regras): miolo escurecido também', () => {
    const img = createImage();
    renderPpu(optionsPpuFrame(a, 'OPÇÕES', 'menuTitle', 28), img);
    const cap = capturePng('rules');
    if (!cap) return;
    // Mesmo quebra-cabeça: o miolo (entre "Time" e "3:00") bate com o miolo escurecido das regras.
    expect(match5(img, cap, { x0: 100, y0: 96, x1: 150, y1: 104 }, [])).toBeGreaterThanOrEqual(0.97);
  });
});
