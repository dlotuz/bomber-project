import { ROM, fixture, sha1Hex, hudWithStart } from './helpers';
import { RomView } from '../../src/rom/view';
import { loadArena } from '../../src/rom/assets-arena';
import { buildArena, staticObjects, applyStatic } from '../../src/rom/arena-build';
import { renderPpu, createImage, type PpuFrame } from '../../src/render/ppu';

function arenaFrame(view: RomView, stage: number, bg1Hofs: number): PpuFrame {
  const a = loadArena(view, stage);
  const b = buildArena(view, stage);
  applyStatic(b.bg2, staticObjects(view, stage));
  const bg1 = a.bg1.slice(); bg1.set(hudWithStart(a.hudMap), 28 * 32);
  const cgram = new Uint16Array(256); cgram.set(a.bgCgram, 0);
  const math = a.colorMath;
  return {
    cgram, oam: [],
    bg1: { map: bg1, mapW: 32, tiles: a.bgTiles, tile16: true, hofs: 8, vofs: -25 },
    bg2: { map: b.bg2, mapW: 32, tiles: a.bgTiles, tile16: true, hofs: 8, vofs: -25 },
    bands: [
      { y0: 0, y1: 24, bg1Tile16: false, bg1: [8, -33], main: 1, sub: 0, math: 'none' },
      { y0: 24, y1: 224, bg1Tile16: true, bg1: [bg1Hofs, -25], bg2: [8, -25], main: 3, sub: math === 'none' ? 0 : 2, math },
    ],
  };
}

describe.skipIf(!ROM)('render só de BG = render_rom.py', () => {
  const view = new RomView(ROM!);
  const fx = fixture<{ arenas: { stage: number; bg1Hofs: number; tileCopies: [number, number][]; sha1: string }[] }>('gfx-render-bg.json');
  for (const r of fx.arenas) it(`arena ${r.stage} (HOFS do BG1 ${r.bg1Hofs})`, () => {
    expect(r.tileCopies).toEqual([]);
    const img = createImage();
    renderPpu(arenaFrame(view, r.stage, r.bg1Hofs), img);
    expect(sha1Hex(new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength))).toBe(r.sha1);
  });
  it('renderPpu de uma arena abaixo de 4 ms', () => {
    const f = arenaFrame(view, 2, 8), img = createImage(), t: number[] = [];
    for (let i = 0; i < 40; i++) { const t0 = performance.now(); renderPpu(f, img); t.push(performance.now() - t0); }
    t.sort((x, y) => x - y);
    console.log('mediana ms', t[20]);
    expect(t[20]).toBeLessThan(4);
  });
});
