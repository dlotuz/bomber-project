import { readScene } from '../../src/render/rom/adapt';
import { newMemo } from '../../src/render/rom/scene';
import { FLAME_PIECE, BURN, type Bomb, type Flyer } from '../../src/core';
import { fakeRound } from './fakes';

const bomb = (over: Partial<Bomb>): Bomb => ({
  id: 1, owner: 0, bad: false, cell: 19, x: 31 * 256, y: 47 * 256, fuse: 126, fire: 0, type: 0, state: 'idle',
  dir: 0, step: 0, kickedBy: -1, turn: -1, chainAt: 0, born: 100, ...over });
const flyer = (over: Partial<Flyer>): Flyer => ({
  id: 9, kind: 'item', ref: 0x03, x: 80 * 256, y: 96 * 256, z: -10, dir: 1, flight: 'item', script: 0, i: 0, born: 0, ...over });

describe('readScene', () => {
  it('bomba parada vai para a grade com tipo e born', () => {
    const s = fakeRound();
    s.bombs.push(bomb({ cell: 19, type: 1, born: 77 }));
    const sc = readScene(s, 100, newMemo());
    expect(sc.gridBombs.get(19)).toEqual({ type: 1, born: 77 });
    expect(sc.objs).toEqual([]);
  });
  it('bomba chutada = OBJ no chão; no ar = só o voador', () => {
    const s = fakeRound();
    s.bombs.push(bomb({ id: 1, state: 'kicked', x: 100 * 256 + 128, y: 80 * 256 }), bomb({ id: 2, state: 'air' }));
    s.flyers.push(flyer({ kind: 'bomb', ref: 2, x: 60 * 256, y: 70 * 256, z: -9 }));
    expect(readScene(s, 0, newMemo()).objs).toEqual([
      { kind: 'bomb', item: 0, x: 100, y: 80, z: 0 },
      { kind: 'bomb', item: 0, x: 60, y: 70, z: 9 }]);
  });
  it('bomba na mão: sobe 6, 10, 14, 16 no levantamento e fica a 16 (D13)', () => {
    const s = fakeRound();
    const p = s.players[0];
    p.carry = 5; p.act = 'lift'; p.actT0 = 200; p.x = 64 * 256; p.y = 96 * 256;
    s.bombs.push(bomb({ id: 5, state: 'held' }));
    expect([200, 201, 202, 203, 204].map(t => readScene(s, t, newMemo()).objs[0].z)).toEqual([6, 10, 14, 16, 16]);
    p.act = 'carryWalk';
    expect(readScene(s, 300, newMemo()).objs[0]).toEqual({ kind: 'bomb', item: 0, x: 64, y: 96, z: 16 });
  });
  it('bomba na mão do Bad Bomber: na posição dele', () => {
    const s = fakeRound();
    s.bad.push({ slot: 3, x: 15, y: 120, phase: 'patrol', face: 2, live: -1, readyAt: 0, born: 0 });
    s.bombs.push(bomb({ id: 8, owner: 3, bad: true, state: 'held' }));
    expect(readScene(s, 0, newMemo()).objs[0]).toEqual({ kind: 'bomb', item: 0, x: 15, y: 120, z: 16 });
  });
  it('item voando: id em ref, altura = −z', () => {
    const s = fakeRound();
    s.flyers.push(flyer({ ref: 0x21, z: -12 }));
    expect(readScene(s, 0, newMemo()).objs).toEqual([{ kind: 'item', item: 0x21, x: 80, y: 96, z: 12 }]);
  });
  it('peças da chama e tipo de queima pelo cellAux', () => {
    const s = fakeRound();
    const names = ['center', 'armU', 'armR', 'armD', 'armL', 'tipU', 'tipR', 'tipD', 'tipL'];
    Object.values(FLAME_PIECE).forEach((v, k) => { s.cellAux[20 + k] = v; });
    const sc = readScene(s, 0, newMemo());
    expect(Object.values(FLAME_PIECE).map((_, k) => sc.flame(20 + k))).toEqual(names);
    s.cellAux[40] = BURN.ITEM; s.cellAux[41] = BURN.SOFT;
    expect([sc.burn(40), sc.burn(41)]).toEqual(['item', 'soft']);
  });
  it('pressão: Falling do núcleo + cauda de 2 ticks depois do pouso (D11)', () => {
    const s = fakeRound();
    const m = newMemo();
    s.pressure.falling.push({ cell: 19, t0: 100, land: 138 });
    expect(readScene(s, 120, m).drops).toEqual([{ cell: 19, t0: 100, land: 138 }]);
    s.pressure.falling.length = 0;
    expect(readScene(s, 138, m).drops).toEqual([{ cell: 19, t0: 100, land: 138 }]);
    expect(readScene(s, 139, m).drops).toHaveLength(1);
    expect(readScene(s, 140, m).drops).toEqual([]);
  });
  it('times', () => {
    const s = fakeRound();
    expect(readScene(s, 0, newMemo()).team).toBe(false);
    s.rules.mode = 'team';
    expect(readScene(s, 0, newMemo()).team).toBe(true);
  });
});
