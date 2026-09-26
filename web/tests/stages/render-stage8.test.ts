import '../../src/core/stages';
import { reelRowSources, tile4bpp, reelWindowPx } from '../../src/render/rom/stages/stage8';
import '../../src/render/fallback/stages/stage8';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import { st8, PADS, PAD_IDLE } from '../../src/core/stages/stage8';
import { CODE } from '../../src/core/types';
import { stageArena, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 8: desenho', () => {
  it('linhas da janela do rolo: pos 0 → 9680 9480 9280 9080; pos 30 dá a volta', () => {
    expect(reelRowSources(0)).toEqual([0x9680, 0x9480, 0x9280, 0x9080]);
    expect(reelRowSources(30)).toEqual([0x90c0, 0x9680, 0x9480, 0x9280]);
  });
  it('tile 4bpp planar: plano 0 da linha 0 = $80 → pixel (0,0) = 1; plano 3 da linha 7 = $01 → pixel (7,7) = 8', () => {
    const b = new Uint8Array(32);
    b[0] = 0x80; b[16 + 15] = 0x01;
    const t = tile4bpp(b, 0);
    expect([t[0], t[63], t[1]]).toEqual([1, 8, 0]);
  });
  it('janela 16×32: a linha k vem da fita no offset (fonte − $9000), 2 tiles lado a lado', () => {
    const strip = new Uint8Array(0x800);
    strip[0x680] = 0x80;                 // linha 0 (fonte $9680), tile esquerdo, plano 0, 1º pixel
    strip[0x480 + 32] = 0x80;            // linha 1 (fonte $9480), tile direito, plano 0, 1º pixel
    const px = reelWindowPx(strip, 0);
    expect(px.length).toBe(16 * 32);
    expect([px[0], px[8 * 16 + 8], px[1]]).toEqual([1, 1, 0]);
  });
  /** Arena 8 com pads na grade (a T9 roda em paralelo: não depender do init dela). */
  const arena8 = () => { const s = stageArena(8); for (const c of PADS) s.grid[c] = CODE.PAD; return s; };
  it('ROM: cor 0 = $0000, palavra dos pads, 1 sprite por peça de cada queda', () => {
    const s = arena8();
    const a = st8(s);
    a.falls.push({ kind: 'item', id: 1, x: 48, y: 64, script: 0x69c4, i: 0, born: 0 });
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage8')!.draw(s, b, fakeAssets(), 0);
    expect(calls.cgram.get(0)).toBe(0);
    expect(PADS.map(c => calls.bg2.get(`${c % 17},${Math.floor(c / 17)}`))).toEqual([PAD_IDLE, PAD_IDLE, PAD_IDLE]);
    expect(calls.sprites.filter(x => x.e.x === 40 && x.e.y === 56).length).toBe(1);
  });
  it('ROM: pad sob chama não recebe palavra', () => {
    const s = arena8();
    s.grid[PADS[0]] = CODE.FLAME;
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage8')!.draw(s, b, fakeAssets(), 0);
    expect(calls.bg2.has('4,7')).toBe(false);
  });
  it('fallback: pads, rolos e quedas', () => {
    const s = arena8();
    st8(s).falls.push({ kind: 'bomb', id: 0, x: 64, y: 70, script: 0x745c, i: 0, born: 0 });
    const c = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage8')!.draw(s, c.ctx, {} as never, 0);
    expect(c.log.filter(x => x === 'fillRect').length).toBeGreaterThanOrEqual(6);
    expect(c.log).toContain('arc');
  });
});
