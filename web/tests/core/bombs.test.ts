import { arena, put, setCell, codeAt, run, runUntil, C, withStage } from './kit';
import { addBomb, placeBomb, detonateRemote, tickBombs, bombAt, bombOccupies, fuseOf, bombFireOf, canPlaceBomb } from '../../src/core/bombs';
import { BURN, CODE, FLAME_PIECE, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { centerX } from '../../src/core/units';

const explodedAt = (s: ReturnType<typeof arena>, max = 400) => runUntil(s, (_s, ev) => ev.some(e => e.type === 'explosion'), max);

describe('colocação', () => {
  it('A coloca na casa do jogador; gasta 1 bomba; não coloca em cima de outra', () => {
    const s = arena(); const p = put(s, 0, 4, 1); const ev: GameEvent[] = [];
    expect(placeBomb(s, p, ev)).toBe(true);
    expect([codeAt(s, 4, 1), p.bombsFree]).toEqual([CODE.BOMB, 0]);
    expect(ev).toEqual([{ type: 'bomb_placed', slot: 0, cell: C(4, 1) }]);
    p.bombsFree = 1;
    expect(placeBomb(s, p, ev)).toBe(false);
  });
  it('bombOccupies: parada na casa; chutada na origem, no centro e (em movimento) na próxima', () => {
    const s = arena();
    const a = addBomb(s, 1, C(4, 1));
    expect([bombOccupies(s, C(4, 1)), bombOccupies(s, C(4, 1), a), bombOccupies(s, C(5, 1))]).toEqual([true, false, false]);
    const k = addBomb(s, 1, C(6, 3), { state: 'kicked', dir: 2, step: 0 });
    expect([bombOccupies(s, C(6, 3)), bombOccupies(s, C(7, 3))]).toEqual([true, false]);
    k.step = 1; k.x += 2 * 256;
    expect([bombOccupies(s, C(6, 3)), bombOccupies(s, C(7, 3)), bombOccupies(s, C(8, 3))]).toEqual([true, true, false]);
  });
  it('não coloca na casa por onde passa uma bomba chutada', () => {
    const s = arena(); const p = put(s, 0, 5, 1);
    addBomb(s, 1, C(4, 1), { state: 'kicked', dir: 2, step: 3, x: centerX(4) + 6 * 256 });   // de (4,1) para (5,1)
    expect(placeBomb(s, p, [])).toBe(false);
  });
  it('só em casa de piso', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    setCell(s, 4, 1, itemCode(3));
    expect(placeBomb(s, p, [])).toBe(false);
  });
  it('M6: nem em seta (arena 7, lógico $0040) nem em pad (arena 8, lógico $0C00) — confirmado em $C1:1D65/1D79 '
    + 'da ROM (ARROW/PAD sobrevivem à máscara $EFC0, mesmo desvio de rejeição de item/bomba)', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    setCell(s, 4, 1, CODE.ARROW);
    expect(placeBomb(s, p, [])).toBe(false);
    setCell(s, 4, 1, CODE.PAD);
    expect(placeBomb(s, p, [])).toBe(false);
  });
  it('doenças: $27/$28 mudam o contador; $25 fogo 10 e só com todas livres; $24 impede; fogo total = 7', () => {
    const p = arena().players[0];
    p.disease = 0x27; expect(fuseOf(p)).toBe(62);
    p.disease = 0x28; expect(fuseOf(p)).toBe(253);
    p.disease = 0; expect(fuseOf(p)).toBe(126);
    p.fullFire = true; expect(bombFireOf(p)).toBe(7);
    p.disease = 0x25; expect(bombFireOf(p)).toBe(10);
    p.bombsCap = 2; p.bombsFree = 1; expect(canPlaceBomb(p)).toBe(false);
    p.bombsFree = 2; expect(canPlaceBomb(p)).toBe(true);
    p.disease = 0x24; expect(canPlaceBomb(p)).toBe(false);
  });
});

describe('pavio', () => {
  it('explode 127 ticks depois do tick da colocação (t24)', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    placeBomb(s, p, []);                         // tick 100
    expect(explodedAt(s)).toBe(227);
  });
  it('pavio $27 = 63 ticks; $28 = 254 ticks', () => {
    for (const [d, t] of [[0x27, 163], [0x28, 354]]) {
      const s = arena(); const p = put(s, 0, 4, 1); p.disease = d;
      placeBomb(s, p, []);
      expect(explodedAt(s)).toBe(t);
    }
  });
  it('fuseStep da arena: 2 por tick → 64 ticks', () => {
    withStage(1, { fuseStep: () => 2 }, () => {
      const s = arena(); placeBomb(s, put(s, 0, 4, 1), []);
      expect(explodedAt(s)).toBe(164);
    });
  });
  it('remota não explode pelo pavio; B detona a mais antiga no mesmo tick', () => {
    const s = arena(); const p = put(s, 0, 2, 1);
    const a = addBomb(s, 0, C(4, 1), { type: 1 }); const b = addBomb(s, 0, C(6, 1), { type: 1 });
    expect(run(s, 300).some(e => e.type === 'explosion')).toBe(false);
    expect(detonateRemote(s, p, [])).toBe(true);
    const ev = run(s, 1);
    expect(ev.filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: a.cell, owner: 0 }]);
    expect(s.bombs).toEqual([b]);
  });
  it('em `won` as bombas congelam', () => {
    const s = arena(); const b = addBomb(s, 0, C(4, 1));
    s.phase = 'won';
    tickBombs(s, []); s.tick++; tickBombs(s, []);
    expect(b.fuse).toBe(126);
  });
});

describe('explosão', () => {
  function boom(col: number, lin: number, fire: number, type: 0 | 1 | 2 = 0) {
    const s = arena();
    const b = addBomb(s, 0, C(col, lin), { fire, type, fuse: 0 });
    b.born = 0;
    const ev = run(s, 1);                          // tick 101
    return { s, ev };
  }
  it('fogo 0 = alcance 2; peças centro/braço/ponta; parede e pilar param', () => {
    const { s } = boom(4, 1, 0);
    expect([codeAt(s, 4, 1), codeAt(s, 5, 1), codeAt(s, 6, 1), codeAt(s, 7, 1)]).toEqual([CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.FLOOR]);
    expect([codeAt(s, 3, 1), codeAt(s, 2, 1), codeAt(s, 4, 2), codeAt(s, 4, 3), codeAt(s, 4, 0)]).toEqual([CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.HARD]);
    const aux = (c: number, l: number) => s.cellAux[C(c, l)];
    expect([aux(4, 1), aux(5, 1), aux(6, 1), aux(3, 1), aux(2, 1), aux(4, 2), aux(4, 3)])
      .toEqual([FLAME_PIECE.CENTER, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.TIP_RIGHT, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.TIP_LEFT, FLAME_PIECE.ARM_DOWN, FLAME_PIECE.TIP_DOWN]);
    const { s: s2 } = boom(3, 1, 3);
    expect(codeAt(s2, 3, 2)).toBe(CODE.HARD);
    expect(codeAt(s2, 3, 3)).toBe(CODE.FLOOR);
  });
  it('alcance por fogo (t64): 7 → 9 casas; 10 → 1 casa', () => {
    const { s } = boom(2, 1, 7);
    expect(codeAt(s, 11, 1)).toBe(CODE.FLAME);
    expect(codeAt(s, 12, 1)).toBe(CODE.FLOOR);
    const { s: s2 } = boom(6, 1, 10);
    expect([codeAt(s2, 7, 1), codeAt(s2, 8, 1)]).toEqual([CODE.FLAME, CODE.FLOOR]);
  });
  it('chama dura 25 ticks em todas as casas (t23)', () => {
    const { s } = boom(4, 1, 0);                   // explodiu no tick 101
    run(s, 24);                                    // tick 125
    expect([codeAt(s, 4, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLAME, CODE.FLAME]);
    run(s, 1);                                     // tick 126 = 101 + 25
    expect([codeAt(s, 4, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLOOR, CODE.FLOOR]);
  });
  it('soft: queima 24 ticks e revela o item escondido; sem item vira piso', () => {
    const s = arena();
    setCell(s, 5, 1, CODE.SOFT); setCell(s, 4, 2, CODE.SOFT);
    s.hidden = [[C(5, 1), 0x03]];
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);                                     // tick 101
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), s.cellAux[C(5, 1)]]).toEqual([CODE.BURNING, CODE.FLOOR, BURN.SOFT]);
    run(s, 23);
    expect(codeAt(s, 5, 1)).toBe(CODE.BURNING);
    run(s, 1);                                     // tick 125 = 101 + 24
    expect([codeAt(s, 5, 1), codeAt(s, 4, 2)]).toEqual([itemCode(0x03), CODE.FLOOR]);
    expect(s.hidden).toEqual([]);
  });
  it('perfurante atravessa e queima todos os soft do alcance', () => {
    const s = arena();
    setCell(s, 5, 1, CODE.SOFT); setCell(s, 6, 1, CODE.SOFT);
    const b = addBomb(s, 0, C(4, 1), { fuse: 0, fire: 2, type: 2 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), codeAt(s, 7, 1), codeAt(s, 8, 1)]).toEqual([CODE.BURNING, CODE.BURNING, CODE.FLAME, CODE.FLAME]);
  });
  it('item no braço queima (some) e segura a chama; não reaparece', () => {
    const s = arena(); setCell(s, 5, 1, itemCode(0x01));
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1), s.cellAux[C(5, 1)]]).toEqual([CODE.BURNING, CODE.FLOOR, BURN.ITEM]);
    run(s, 24);
    expect(codeAt(s, 5, 1)).toBe(CODE.FLOOR);
  });
  it('bloco queimando segura a chama', () => {
    const s = arena(); setCell(s, 5, 1, CODE.BURNING); s.cellT0[C(5, 1)] = 100;
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);
    expect(codeAt(s, 6, 1)).toBe(CODE.FLOOR);
  });
  it('reação em cadeia: a bomba atingida explode 2 ticks depois; o braço não entra na casa dela (t99)', () => {
    const s = arena();
    const a = addBomb(s, 0, C(4, 1), { fuse: 0 }); a.born = 0;
    addBomb(s, 1, C(6, 1));
    const ev1 = run(s, 1);                         // tick 101
    expect(ev1.filter(e => e.type === 'explosion').length).toBe(1);
    expect(codeAt(s, 6, 1)).toBe(CODE.BOMB);
    expect(run(s, 1).some(e => e.type === 'explosion')).toBe(false);
    expect(run(s, 1).filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(6, 1), owner: 1 }]);   // tick 103
  });
  it('explosão devolve a bomba ao dono', () => {
    const s = arena(); const p = put(s, 0, 4, 1);
    placeBomb(s, p, []);
    expect(p.bombsFree).toBe(0);
    explodedAt(s);
    expect(p.bombsFree).toBe(1);
  });
  it('código especial passável: chama onFlameCell e o braço segue', () => {
    const s = arena(); setCell(s, 5, 1, CODE.ARROW);
    const calls: [number, number][] = [];
    withStage(1, { onFlameCell: (_s, cell, dir) => { calls.push([cell, dir]); } }, () => {
      const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
      run(s, 1);
    });
    expect(calls).toEqual([[C(4, 1), -1], [C(5, 1), 2], [C(6, 1), 2], [C(4, 2), 4], [C(4, 3), 4], [C(3, 1), 6], [C(2, 1), 6]]);   // toda casa alcançada (acordo do plano 8)
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1)]).toEqual([CODE.ARROW, CODE.FLAME]);
  });
  it('bombAt só acha bomba parada', () => {
    const s = arena(); const b = addBomb(s, 0, C(4, 1));
    expect(bombAt(s, C(4, 1))).toBe(b);
    b.state = 'held';
    expect(bombAt(s, C(4, 1))).toBeUndefined();
  });
});
