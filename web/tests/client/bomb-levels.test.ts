import { drawBombLevels } from '../../src/render/draw-screens';
import { addBomb } from '../../src/core/bombs';
import { arena, C } from '../core/kit';
import type { SpriteBank } from '../../src/render/sprite-bank';
import { cellCenter } from '../../src/core/units';

describe('letra das bombas evoluídas', () => {
  it('desenha D/S/H com a cor do nível no centro da bomba; bomba comum não', () => {
    const s = arena();
    addBomb(s, 0, C(4, 1));
    addBomb(s, 0, C(6, 1), { level: 1 });
    addBomb(s, 0, C(8, 1), { level: 3 });
    const texts: [string, string][] = [];
    const draws: [number, number][] = [];
    const bank = { text: (t: string, c: string) => { texts.push([t, c]); return { width: 6, height: 8 }; } } as unknown as SpriteBank;
    const ctx = { drawImage: (_i: unknown, x: number, y: number) => { draws.push([x, y]); } } as unknown as CanvasRenderingContext2D;
    drawBombLevels(ctx, bank, s);
    expect(texts).toEqual([['D', '#e82818'], ['H', '#f8f8f8']]);
    const at = (c: number) => { const [x, y] = cellCenter(c).map(v => Math.floor(v / 256)); return [x - 3, y - 4 + 1]; };
    expect(draws).toEqual([at(C(6, 1)), at(C(8, 1))]);
  });
});
