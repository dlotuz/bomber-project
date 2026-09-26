import '../../src/core/stages';
import { stage10 } from '../../src/core/stages/stage10';
import { romLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage10';
import { stageArena, fullRound, fakeBuilder, fakeAssets } from './kit';

describe('arena 10', () => {
  it('sem mecânica própria; 8 trajes vêm da lista de itens do núcleo', () => {
    expect(Object.keys(stage10)).toEqual([]);
    expect(fullRound(10).hidden.filter(([, i]) => i === 0x0f).length).toBe(8);
  });
  it('paleta 5: quadros 0, 1, 2, 3, 0 nos ticks 0, 15, 30, 45, 60', () => {
    const s = stageArena(10);
    const layer = romLayers.find(l => l.id === 'stage10')!;
    const got: number[] = [];
    for (const t of [0, 15, 30, 45, 60]) {
      const { b, calls } = fakeBuilder();
      s.tick = t;
      layer.draw(s, b, fakeAssets(), 0);
      got.push(((calls.cgram.get(80)! - (0xd7e47c & 0x7fff)) / 32));
      expect(calls.cgram.size).toBe(16);
    }
    expect(got).toEqual([0, 1, 2, 3, 0]);
  });
});
