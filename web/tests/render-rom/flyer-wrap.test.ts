import { buildBattleFrame } from '../../src/render/rom/battle';
import { renderPpu } from '../../src/render/ppu';
import { addBomb } from '../../src/core/bombs';
import { cellOf } from '../../src/core/units';
import type { RoundState } from '../../src/core';
import { blankImage } from './fakes';
import { ASSETS } from './rom-fixture';
import { newRound, toPlay } from './core-fixture';

/** Pixels que mudam com uma bomba voando em (x, y) px do núcleo: [linhas, colunas] da tela. */
function diff(s: RoundState, x: number, y: number): [number[], number[]] {
  const img = (on: boolean): Uint8ClampedArray => {
    s.flyers = []; s.bombs = [];
    if (on) {
      const b = addBomb(s, 0, cellOf(2, 3), { state: 'air' });
      s.flyers.push({ id: 999, kind: 'bomb', ref: b.id, x: x * 256, y: y * 256, z: 0, dir: 0, flight: 'punch', script: 0, i: 0, born: 0 });
    }
    const o = blankImage();
    renderPpu(buildBattleFrame(s, { crowns: [0, 0, 0, 0, 0] }, ASSETS!, 0), o);
    return o.data;
  };
  const a = img(false), b = img(true), rows = new Set<number>(), cols = new Set<number>();
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) { rows.add((i >> 2) >> 8); cols.add((i >> 2) & 255); }
  return [[...rows], [...cols]];
}

// Emulador (st_arena05, soco de (2,2) para cima / de (13,3) para a direita): em y = 16 da ROM (linha 13 de $C2:3221)
// a bomba some atrás do HUD; em y = 234..240 fica abaixo da tela; em x = 265 some pela direita. O núcleo é ROM − 1 px.
describe.skipIf(!ASSETS)('bomba dando a volta pela borda ($C1:6566)', () => {
  it('na linha −1/13 fica atrás do HUD ou abaixo da tela; nunca aparece do outro lado', () => {
    const s = newRound(1); toPlay(s);
    for (const [x, y] of [[31, 15], [31, 233], [31, 239], [264, 79]]) expect(diff(s, x, y)).toEqual([[], []]);
    const [rows] = diff(s, 31, 21);                 // descendo de volta: só aparece abaixo do HUD (linha 24)
    expect(Math.min(...rows)).toBe(24);
    const [, cols] = diff(s, 261, 79);               // saindo pela direita: só a borda direita
    expect(Math.min(...cols)).toBeGreaterThan(240);
  });
});
