import { tileWord, newMap, put, fill, pattern, box, sceneFrame, obj, gfxFromVram, menuMaps, MENU_GEO, handCursor, sceneMaps, menuBg1Vofs, type MenuScene } from '../../src/render/screens-rom/scene';
import { MAP_SOURCES } from '../../src/render/screens-rom/map-sources';
import { loadCapture, capturedMap, parseOam, mapMatch, type Rect } from './captures';

describe('geometria de mapas (pura)', () => {
  it('tileWord: vhopppcc cccccccc', () => {
    expect(tileWord(0x123, 5)).toBe(0x1523);
    expect(tileWord(0x3ff, 7, 1, true, true)).toBe(0xffff);
  });
  it('put/fill/pattern com volta em 32', () => {
    const m = newMap();
    put(m, 33, 0, 7);
    expect(m[1]).toBe(7);
    fill(m, 2, 3, 2, 2, 9);
    expect([m[3 * 32 + 2], m[3 * 32 + 3], m[4 * 32 + 3], m[5 * 32 + 3]]).toEqual([9, 9, 9, 0]);
    pattern(m, 0, 10, 4, 2, [[1, 2], [3, 4]]);
    expect(Array.from(m.subarray(10 * 32, 10 * 32 + 4))).toEqual([1, 2, 1, 2]);
    expect(Array.from(m.subarray(11 * 32, 11 * 32 + 4))).toEqual([3, 4, 3, 4]);
  });
  it('box: cantos, bordas e miolo', () => {
    const m = newMap();
    box(m, 1, 1, 4, 3, { tl: 1, tr: 2, bl: 3, br: 4, top: 5, bottom: 6, left: 7, right: 8, fill: 9 });
    const row = (l: number) => Array.from(m.subarray(l * 32 + 1, l * 32 + 5));
    expect(row(1)).toEqual([1, 5, 5, 2]);
    expect(row(2)).toEqual([7, 9, 9, 8]);
    expect(row(3)).toEqual([3, 6, 6, 4]);
  });
  it('sceneFrame: modo 1 com tiles 16×16 em BG1/BG2, uma faixa, OAM e CGRAM da cena', () => {
    const g = gfxFromVram(new Uint8Array(0x10000), new Uint16Array(256));
    const f = sceneFrame(g, { bg1: newMap(), bg2: newMap() }, { oam: [obj(10, 20, 0, 0)], bg2: [0, 8] });
    expect(f.bg1!.tile16).toBe(true);
    expect(f.bg2!.vofs).toBe(8);
    expect(f.bands).toEqual([{ y0: 0, y1: 224, bg1Tile16: true, main: 1 | 2 | 16, sub: 0, math: 'none' }]);
    expect(f.oam).toHaveLength(1);
    expect(g.bgTiles.count).toBe(1024);
    expect(g.objTiles.count).toBe(512);
  });
  it('sem origem na ROM, sceneMaps usa a geometria', () => {
    const geo = () => ({ bg2: newMap() });
    expect(sceneMaps({} as never, 'draw1', geo)).toEqual(geo());
    expect(typeof MAP_SOURCES).toBe('object');
  });
  it('menuMaps: quebra-cabeça no fundo, corda nas casas da moldura, pontas no título e faixas das regras', () => {
    const vs = menuMaps({ x0: 7, y0: 51, x1: 248, y1: 186 }, 'vsmode', { x0: 64, x1: 190 });
    const r = MENU_GEO.rope.vsmode, at = (m: Uint16Array, c: number, l: number) => m[l * 32 + c];
    expect(at(vs[MENU_GEO.bgLayer]!, 7, 9)).toBe(MENU_GEO.bgPattern[3][1]);
    expect([at(vs.bg1!, 0, 3), at(vs.bg1!, 15, 3), at(vs.bg1!, 0, 11), at(vs.bg1!, 15, 11)]).toEqual([r.tl, r.tr, r.bl, r.br]);
    expect(Array.from(vs.bg1!.subarray(3 * 32, 3 * 32 + 16))).toEqual([r.tl, r.top, r.top, r.titleEnds[0], 0, 0, 0, 0, 0, 0, 0, 0, r.titleEnds[1], r.topRight, r.topRight, r.tr]);
    expect(at(vs.bg1!, 7, 7)).toBe(0);
    expect(menuBg1Vofs('rules', 27)).toBe(-8);
    expect(menuBg1Vofs('rules', 210)).toBe(40);
    const ru = menuMaps({ x0: 7, y0: 27, x1: 248, y1: 210 }, 'rules');
    expect([at(ru.bg1!, 0, 1), at(ru.bg1!, 0, 15)]).toEqual([MENU_GEO.rope.rules.tl, MENU_GEO.rope.rules.bl]);
  });
  it('handCursor: OBJ 16×16 parado com o tile dos menus ou do título', () => {
    expect(handCursor(56, 80)).toMatchObject({ x: 56, y: 80, size: 16, src: { tile: MENU_GEO.hand.tile } });
    expect(handCursor(56, 148, true).src).toEqual({ tile: MENU_GEO.titleHand.tile });
  });
});

/** Molduras e títulos medidos [MNT §B.2–B.4] e áreas de texto (ignoradas: o texto é nosso). */
const CASES: { scene: MenuScene; frame: Rect; title: { x0: number; x1: number }; text: Rect[] }[] = [
  { scene: 'vsmode', frame: { x0: 7, y0: 51, x1: 248, y1: 186 }, title: { x0: 64, x1: 190 }, text: [{ x0: 60, y0: 44, x1: 194, y1: 62 }, { x0: 76, y0: 76, x1: 176, y1: 158 }] },
  { scene: 'ffa', frame: { x0: 7, y0: 67, x1: 248, y1: 170 }, title: { x0: 64, x1: 190 }, text: [{ x0: 60, y0: 60, x1: 194, y1: 78 }, { x0: 80, y0: 90, x1: 200, y1: 142 }] },
  { scene: 'players', frame: { x0: 7, y0: 19, x1: 248, y1: 218 }, title: { x0: 50, x1: 204 }, text: [{ x0: 46, y0: 12, x1: 208, y1: 32 }, { x0: 40, y0: 44, x1: 232, y1: 190 }] },
  { scene: 'rules', frame: { x0: 7, y0: 27, x1: 248, y1: 210 }, title: { x0: 56, x1: 198 }, text: [{ x0: 52, y0: 20, x1: 202, y1: 40 }, { x0: 28, y0: 52, x1: 232, y1: 190 }] },
];

describe.each(CASES)('moldura de menu × captura $scene', ({ scene, frame, title, text }) => {
  const cap = loadCapture(scene);
  it.skipIf(!cap)('BG1 e BG2 montados pela geometria batem ≥ 97 % fora do texto', () => {
    const built = menuMaps(frame, scene, title);
    // Nas regras o VOFS do BG1 muda por faixa (HDMA): o texto vai para linhas do mapa pela faixa de cada borda.
    const bg1Text = text.map(r => ({ ...r, y0: r.y0 + menuBg1Vofs(scene, r.y0), y1: r.y1 + menuBg1Vofs(scene, r.y1) }));
    for (const [layer, addr] of [['bg1', 0x4000], ['bg2', 0x4400]] as const) {
      const ours = built[layer];
      if (!ours) continue;
      const [ign, vofs] = layer === 'bg1' ? [bg1Text, 0] : [text, MENU_GEO.scroll.bg2[1]];
      expect(mapMatch(ours, capturedMap(cap!, addr), ign, MENU_GEO.scroll[layer][0], vofs), `${scene} ${layer}`)
        .toBeGreaterThanOrEqual(0.97);
    }
  });
  it.skipIf(!cap)('a mão da captura usa o tile e a paleta de MENU_GEO', () => {
    const hands = parseOam(cap!.oam).filter(r => r.tile === MENU_GEO.hand.tile);
    expect(hands.length).toBeGreaterThan(0);
    expect(hands[0].pal).toBe(MENU_GEO.hand.pal);
  });
});
