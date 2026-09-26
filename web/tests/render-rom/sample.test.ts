import { animCycle, sampleAnim } from '../../src/render/anim/sample';
import type { Anim } from '../../src/rom/types';
import { fr } from './fakes';

const WALK: Anim = [fr(12, 4), fr(8, 3), fr(12, 5), fr(8, 3)];
const g = (a: Anim, t: number) => sampleAnim(a, t).frame.pieces[0].tile;

describe('sampleAnim', () => {
  it('andar →: g4:12 g3:8 g5:12 g3:8 e loop', () => {
    expect([0, 11, 12, 19, 20, 31, 32, 39, 40, 79, 80].map(t => g(WALK, t))).toEqual([4, 4, 3, 3, 5, 5, 3, 3, 4, 3, 4]);
    expect(animCycle(WALK)).toBe(40);
  });
  it('dur 255 congela o quadro', () => {
    const a: Anim = [fr(5, 1), fr(255, 2), fr(3, 3)];
    expect([0, 4, 5, 1000].map(t => sampleAnim(a, t).index)).toEqual([0, 0, 1, 1]);
    expect(animCycle(a)).toBe(Infinity);
  });
  it('t negativo = 0; dur 0 vale 256', () => {
    expect(sampleAnim(WALK, -5).index).toBe(0);
    const a: Anim = [fr(0, 1), fr(1, 2)];
    expect([255, 256, 257].map(t => sampleAnim(a, t).index)).toEqual([0, 1, 0]);
  });
  it('mx/my acumulados dentro do ciclo', () => {
    const a: Anim = [fr(2, 1, 1, 0), fr(2, 2, 2, -1), fr(2, 3, -3, 1)];
    expect([0, 2, 4, 6].map(t => { const s = sampleAnim(a, t); return [s.ox, s.oy]; })).toEqual([[1, 0], [3, -1], [0, 0], [1, 0]]);
  });
  it('animação vazia é erro', () => {
    expect(() => sampleAnim([], 0)).toThrow();
  });
});
