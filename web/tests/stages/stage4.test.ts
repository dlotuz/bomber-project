import { stage4 } from '../../src/core/stages/stage4';
import { CODE } from '../../src/core/types';
import { fullRound } from './kit';

describe('arena 4 (A10: piso normal)', () => {
  it('módulo sem mecânica própria', () => {
    expect(Object.keys(stage4)).toEqual([]);
  });
  it('rodada real: 70 soft blocks com a semente de boot (nenhum sorteio da arena)', () => {
    const s = fullRound(4);
    expect(s.grid.filter(v => v === CODE.SOFT).length).toBe(70);
  });
});
