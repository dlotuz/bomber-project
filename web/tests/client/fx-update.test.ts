import { createRound, makeRng, defaultRules, cellOf, CODE, BURN } from '../../src/core';
import { createFx, liveCount } from '../../src/render/fx/state';
import { fxUpdate } from '../../src/render/fx/update';

const boom = (cell: number) => ({ type: 'explosion' as const, cell, owner: 0 });
const round = () => createRound(1, defaultRules(), makeRng());

describe('fxUpdate', () => {
  it('explosão gera 18 faíscas + 6 fumaças e tremor', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [boom(cellOf(5, 5))]);
    expect(liveCount(fx)).toBe(24);
    expect(fx.shake).toBeGreaterThan(0);
  });
  it('tudo some e o tremor zera depois de 60 ticks', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    for (let i = 0; i < 60; i++) fxUpdate(fx, r, []);
    expect(liveCount(fx)).toBe(0);
    expect(fx.shake).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('bloco que vira BURNING (SOFT) solta 8 detritos com a cor amostrada', () => {
    const r = round(), fx = createFx(), c = cellOf(3, 3);
    fxUpdate(fx, r, []);
    r.grid[c] = CODE.BURNING; r.cellAux[c] = BURN.SOFT;
    const asked: number[] = [];
    fxUpdate(fx, r, [], cell => { asked.push(cell); return 0x123456; });
    expect(liveCount(fx)).toBe(8);
    expect(asked).toEqual([c]);
    fxUpdate(fx, r, []);
    expect(liveCount(fx)).toBe(8);   // continua queimando: não solta de novo
  });
  it('player_hit acende o flash e solta 24 partículas', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, [{ type: 'player_hit', slot: 1 }]);
    expect(fx.flash).toBe(1);
    expect(liveCount(fx)).toBe(24);
  });
  it('cadeia: teto de 600 partículas e de 6 px de tremor', () => {
    const r = round(), fx = createFx();
    fxUpdate(fx, r, Array.from({ length: 40 }, () => boom(cellOf(7, 7))));
    expect(liveCount(fx)).toBe(600);
    expect(fx.shake).toBeLessThanOrEqual(6);
  });
  it('TIME UP e fim de rodada não geram efeitos novos', () => {
    const r = round(), fx = createFx();
    r.phase = 'timeUp';
    fxUpdate(fx, r, [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    expect(liveCount(fx)).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('rodada nova zera o que sobrou da anterior', () => {
    const fx = createFx();
    fxUpdate(fx, round(), [boom(cellOf(5, 5)), { type: 'player_hit', slot: 0 }]);
    fxUpdate(fx, round(), []);
    expect(liveCount(fx)).toBe(0);
    expect(fx.shake).toBe(0);
    expect(fx.flash).toBe(0);
  });
  it('determinístico: mesma semente e mesmos eventos = mesmo estado', () => {
    const r = round(), a = createFx(7), b = createFx(7);
    for (const fx of [a, b]) { fxUpdate(fx, r, [boom(cellOf(5, 5))]); fxUpdate(fx, r, []); }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect([a.dx, a.dy]).toEqual([b.dx, b.dy]);
  });
});
