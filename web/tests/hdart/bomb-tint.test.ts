import type { Bomb } from '../../src/core';
import { drawHdBattle, hdClock } from '../../src/render/hdart/draw';
import { BOMB_COLORS } from '../../src/render/fx/bomb-tint';
import { fakeRound } from '../render-rom/fakes';
import { IMG_A, recCtx, still, testPack } from './helpers';

const at = (col: number, lin: number) => ({ x: (16 * col) * 256, y: (16 * lin + 32) * 256 });
const bomb = (over: Partial<Bomb>): Bomb => ({
  id: 1, owner: 0, bad: false, cell: 0, x: 0, y: 0, fuse: 100, fire: 2, type: 0, state: 'idle', dir: 0, step: 0,
  kickedBy: -1, turn: -1, chainAt: 0, born: 0, ...over,
});

describe('arte HD: bomba na cor do dono (a base não tem a bomba para o efeito pintar)', () => {
  it('parada e chutada saem do recorte pintado na cor do dono; sem o gancho, a arte do pacote', () => {
    const s = fakeRound({ stage: 1, tick: 100 });
    s.bombs.push(bomb({ ...at(4, 4), owner: 2 }), bomb({ id: 2, ...at(6, 4), owner: 3, state: 'kicked' }));
    const asked: [unknown, readonly number[], number][] = [];
    const TINTED = { id: 'pintada', width: 64, height: 64 } as unknown as CanvasImageSource;
    const out = recCtx();
    drawHdBattle(out, s, testPack({ 'bomb/0': still(128) }), 1, 1, 0, 0, hdClock(s), {
      cats: new Set(['bombs']),
      bombTint: (img, rect, color) => { asked.push([img, rect, color]); return TINTED; },
    });
    expect(asked.map(a => a[2])).toEqual([BOMB_COLORS[2], BOMB_COLORS[3]]);
    expect(asked[0][0]).toBe(IMG_A);
    expect(asked[0][1]).toEqual([128, 0, 64, 64]);
    expect(out.calls.map(c => [c.img, c.sx, c.sy, c.sw, c.sh])).toEqual([[TINTED, 0, 0, 64, 64], [TINTED, 0, 0, 64, 64]]);
    const plain = recCtx();
    drawHdBattle(plain, s, testPack({ 'bomb/0': still(128) }), 1, 1, 0, 0, hdClock(s), { cats: new Set(['bombs']) });
    expect(plain.calls.map(c => [c.img, c.sx])).toEqual([[IMG_A, 128], [IMG_A, 128]]);
  });
});
