// I1 (mão do título na frente do mascote), M2 (APERTE START! amarelo), M1 (ascii8 sem o campo opaco) e M5 (cache).
import { ASSETS } from './rom';
import { loadCapture, parseOam } from './captures';
import { capturePng, rgbAt, imgAt } from './png-read';
import { renderPpu, createImage } from '../../src/render/ppu';
import { titleFrame, titleScene } from '../../src/render/screens-rom/title';
import { MENU_GEO } from '../../src/render/screens-rom/scene';
import { TITLE } from '../../src/game/timeline';
import { buildRomFont, styledLayout, styleColors } from '../../src/render/text/text';
import { GLYPH_MAPS } from '../../src/render/text/glyph-maps';
import { S } from '../../src/render/text/strings';

describe('título: a mão fica na frente (I1)', () => {
  const cap = loadCapture('title');
  it.skipIf(!cap)('na captura, a mão é o OBJ 0 (índice menor = na frente) em (56, 164)', () => {
    const hand = parseOam(cap!.oam)[0];
    expect([hand.i, hand.x, hand.y, hand.tile, hand.prio]).toEqual([0, TITLE.cursorX, TITLE.rowsY[1], MENU_GEO.titleHand.tile, 3]);
  });
  it.skipIf(!ASSETS)('titleFrame põe a mão no índice 0 do OAM', () => {
    const f = titleFrame(ASSETS!, TITLE.cursorX, TITLE.rowsY[2]);
    expect(f.oam[0]).toMatchObject({ x: TITLE.cursorX, y: TITLE.rowsY[2], src: { tile: MENU_GEO.titleHand.tile } });
  });
  const png = capturePng('title');
  it.skipIf(!ASSETS || !png)('pixels da mão iguais aos da captura (sobre o mascote)', () => {
    const img = createImage();
    renderPpu(titleFrame(ASSETS!, TITLE.cursorX, TITLE.rowsY[1]), img);
    let same = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const X = TITLE.cursorX + x, Y = TITLE.rowsY[1] + y;
      if (imgAt(img, X, Y).every((v, i) => v >> 3 === rgbAt(png!, X, Y)[i] >> 3)) same++;
    }
    expect(same / 256).toBeGreaterThanOrEqual(0.95);
  });
  it.skipIf(!ASSETS)('a cena do título é montada uma vez por ROM (M5)', () => {
    expect(titleScene(ASSETS!)).toBe(titleScene(ASSETS!));
  });
});

describe.skipIf(!ASSETS)('estilos de texto (aditivos)', () => {
  it('titleMenu amarelo (M2): a frase usa a família 5–9 de "PUSH START BUTTON!", e ela é amarela', () => {
    const f = buildRomFont('titleMenu', ASSETS!)!;
    const plain = styledLayout(f, S.title.pressStart), yellow = styledLayout(f, S.title.pressStart, 'yellow');
    expect(plain.px.some(v => v >= 12 && v <= 15)).toBe(true);
    expect(yellow.px.some(v => v >= 11 && v <= 15)).toBe(false);
    expect(yellow.px.some(v => v >= 6 && v <= 9)).toBe(true);
    const cg = styleColors(GLYPH_MAPS.titleMenu!, ASSETS!, 'yellow');
    for (const i of [6, 7, 8, 9]) {
      const c = cg[i], r = c & 31, g = (c >> 5) & 31, b = (c >> 10) & 31;
      expect(r > b && g > b, `índice ${i} = ${c.toString(16)}`).toBe(true);
    }
  });
  it('ascii8 `bare` (M1): o campo da casa (índice 1) só sobra como contorno de 1 px da letra', () => {
    const f = buildRomFont('ascii8', ASSETS!)!;
    const solid = styledLayout(f, 'OPÇÕES'), bare = styledLayout(f, 'OPÇÕES', 'default', true);
    expect(solid.px.filter(v => v === 1).length).toBeGreaterThan(bare.px.filter(v => v === 1).length);
    // Todo pixel restante do índice 1 encosta (8-vizinhos) num pixel da letra (índices 2 e 3).
    const { w, h, px } = bare;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[y * w + x] !== 1) continue;
      let near = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && px[Y * w + X] > 1) near = true;
      }
      expect(near, `(${x}, ${y})`).toBe(true);
    }
    // Os glifos em si não mudam: sem `bare`, igual a antes (mesma largura e mesmos índices 2/3).
    expect(bare.w).toBe(solid.w);
    expect(Array.from(bare.px).map(v => (v > 1 ? v : 0))).toEqual(Array.from(solid.px).map(v => (v > 1 ? v : 0)));
  });
});
