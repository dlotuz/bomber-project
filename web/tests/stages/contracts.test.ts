import { STAGES } from '../../src/core/stages';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/layers-index';
import { armIndex, rnd255, floorWord, wrapPx } from '../../src/core/stages/kit';
import { STAGE_SFX } from '../../src/core/stages/events';
import { stageArena, mirror, arena, put, run, setCell, C } from './kit';
import { cellOf } from '../../src/core/units';
import { addBomb } from '../../src/core/bombs';
import { speedLevel } from '../../src/core/disease';
import { CODE } from '../../src/core/types';

describe('contratos do plano 8', () => {
  it('STAGES[2..10] são os módulos do plano 8', () => {
    for (let n = 2; n <= 10; n++) expect(STAGES[n], `fase ${n}`).toBeDefined();
    expect(STAGES.length).toBe(11);
  });
  it('camadas registradas, uma por arquivo', () => {
    expect(romLayers.map(l => l.id).filter(id => id.startsWith('stage')).sort())
      .toEqual(['stage10', 'stage2', 'stage3', 'stage7', 'stage8', 'stage9']);
    expect(fallbackLayers.map(l => l.id).filter(id => id.startsWith('stage')).sort())
      .toEqual(['stage2', 'stage3', 'stage5', 'stage6', 'stage7', 'stage8', 'stage9']);
  });
  it('rnd255 é o $C3:5489 (n efetivo $FF)', () => {
    const s = stageArena(1);
    const m = mirror(s.rng.seed);
    expect(rnd255(s)).toBe(m.rnd(0xff));
    expect(s.rng.seed).toBe(m.seed());
  });
  it('armIndex: 0..3 = cima, direita, baixo, esquerda; 4 = centro', () => {
    expect([armIndex(0), armIndex(2), armIndex(4), armIndex(6), armIndex(-1)]).toEqual([0, 1, 2, 3, 4]);
  });
  it('floorWord: 0 em floor[] = palavra padrão pedida', () => {
    const s = stageArena(1);
    expect(floorWord(s, cellOf(5, 5), 0x1c06)).toBe(0x1c06);
    s.floor[cellOf(5, 5)] = 0x1c0a;
    expect(floorWord(s, cellOf(5, 5), 0x1c06)).toBe(0x1c0a);
  });
  it('wrapPx: x < −24 soma 272; x > 278 subtrai 272', () => {
    expect([wrapPx(-25), wrapPx(-24), wrapPx(279), wrapPx(278)]).toEqual([247, -24, 7, 278]);
  });
  it('tabela de SFX dos eventos de arena', () => {
    expect(STAGE_SFX).toEqual({ a2_warn: 0x26, a5_shock: 0x18, a6_reverse: 0x0a, a8_click: 0x01, a8_brake: 0x27, a8_prize: 0x17, a8_drop: 0x12 });
  });
});

// Acordos de interface com o plano 6 (Task 1, itens 3, 9 e 14): travados aqui para que a onda 2 possa confiar neles.
describe('contratos do núcleo usados pelas arenas', () => {
  it('item 3: onFlameCell em toda casa alcançada; centro (−1) primeiro, braços cima, dir, baixo, esq; soft já queimando', () => {
    const s = arena(); setCell(s, 6, 3, CODE.SOFT);
    const calls: [number, number, number][] = [];
    STAGES[1] = { onFlameCell: (q, cell, dir) => { calls.push([cell, dir, q.grid[cell]]); } };
    try {
      const b = addBomb(s, 0, C(4, 3), { fuse: 0 }); b.born = 0;
      run(s, 1);
    } finally { STAGES[1] = {}; }
    const F = CODE.FLAME;
    expect(calls).toEqual([
      [C(4, 3), -1, F],
      [C(4, 2), 0, F], [C(4, 1), 0, F],
      [C(5, 3), 2, F], [C(6, 3), 2, CODE.BURNING],
      [C(4, 4), 4, F], [C(4, 5), 4, F],
      [C(3, 3), 6, F], [C(2, 3), 6, F],
    ]);
  });
  it('item 9: bomba sem dono (owner −1) explode sem indexar players[−1]', () => {
    const s = arena();
    const free = s.players.map(p => p.bombsFree);
    const b = addBomb(s, -1, C(8, 5), { fire: 4, fuse: 0 }); b.born = 0;
    const ev = run(s, 1);
    expect(ev).toContainEqual({ type: 'explosion', cell: C(8, 5), owner: -1 });
    expect(s.players.map(p => p.bombsFree)).toEqual(free);
  });
  it('item 14: o nível da arena vence doença e efeito lento (D10); o gancho recebe o nível já com ambos', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    const got: number[] = [];
    p.effect = { kind: 2, left: 64 };
    STAGES[1] = { speedLevel: (_s, _p, lv) => { got.push(lv); return 6; } };
    try { expect(speedLevel(s, p)).toBe(6); } finally { STAGES[1] = {}; }
    expect(got).toEqual([7]);
    expect(speedLevel(s, p)).toBe(7);
  });
});
