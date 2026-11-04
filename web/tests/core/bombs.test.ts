import { arena, put, setCell, codeAt, run, runUntil, C, withStage } from './kit';
import { addBomb, armStops, placeBomb, detonateRemote, tickBombs, bombAt, bombOccupies, fuseOf, bombFireOf, canPlaceBomb } from '../../src/core/bombs';
import { BURN, CODE, FLAME_PIECE, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { centerX, colOf, linOf } from '../../src/core/units';
import { tickFlyers } from '../../src/core/flyers';
import { crossCells } from '../../src/core/ai/danger';

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
  it('caveira no braço não queima: pula para outra casa e segura a chama', () => {
    const s = arena(); setCell(s, 5, 1, itemCode(0x23));
    const b = addBomb(s, 0, C(4, 1), { fuse: 0 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLOOR, CODE.FLOOR]);
    expect(s.flyers).toEqual([expect.objectContaining({ kind: 'item', ref: 0x23 })]);
    for (let i = 0; i < 200 && s.flyers.length; i++) { s.tick++; tickFlyers(s, []); }
    expect(s.flyers).toEqual([]);
    expect(Array.from(s.grid).filter(v => v === itemCode(0x23))).toHaveLength(1);
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

describe('propagação do braço ($C1:403A): bomba no caminho segura o fogo', () => {
  // Rotina que anda casa a casa: casa com bomba parada (C900) ganha o bit de chama (D900 = marcada para a cadeia,
  // $C1:40FF–$C1:4104) e o braço termina ali (RTL), sem acender a casa da bomba e sem testar o tipo da bomba.
  // D900 (bomba já marcada) também termina o braço ($C1:40F1). Emulador: alcance 10 com bomba na 7ª casa → chama
  // só nas 6 casas antes dela; a outra explode 2 ticks depois com o próprio alcance.
  const arm = (s: ReturnType<typeof arena>, from: number, to: number) => {
    const out: number[] = [];
    for (let c = from; c <= to; c++) out.push(codeAt(s, c, 1));
    return out;
  };
  it('exemplo do usuário: alcance 10, bomba parada na 7ª casa → o braço vai só até a casa antes dela, sem ponta', () => {
    const s = arena();
    const a = addBomb(s, 0, C(2, 1), { fuse: 0, fire: 8 }); a.born = 0;   // fogo 8 = alcance 10 (até a col 12)
    addBomb(s, 1, C(9, 1), { fire: 0 });                                   // 7ª casa; alcance 2 (até a col 11)
    expect(run(s, 1).filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(2, 1), owner: 0 }]);
    const F = CODE.FLAME;
    expect(arm(s, 3, 12)).toEqual([F, F, F, F, F, F, CODE.BOMB, CODE.FLOOR, CODE.FLOOR, CODE.FLOOR]);
    // braço cortado antes do alcance termina com a peça do meio: a ponta só vai na casa de índice = alcance ($C1:51BC;
    // emulador, aj-fogo/chain.py 10 7 2 2: a casa 8 fica $030A, braço, não $0306, ponta)
    expect([s.cellAux[C(7, 1)], s.cellAux[C(8, 1)]]).toEqual([FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_RIGHT]);
    run(s, 1);
    expect(codeAt(s, 9, 1)).toBe(CODE.BOMB);
    expect(run(s, 1).filter(e => e.type === 'explosion')).toEqual([{ type: 'explosion', cell: C(9, 1), owner: 1 }]);
    expect(arm(s, 3, 12)).toEqual([F, F, F, F, F, F, F, F, F, CODE.FLOOR]);  // a segunda acende 10 e 11 com o alcance dela
    // o braço esquerdo dela (alcance 2) vem de frente sobre o braço da primeira: a peça de braço da direção oposta não
    // segura ($C1:40C4/$C1:40C9 só comparam com a própria direção), a casa vira dela, com ponta no alcance inteiro
    expect([s.cellAux[C(7, 1)], s.cellAux[C(8, 1)], s.cellT0[C(7, 1)], s.cellT0[C(6, 1)]])
      .toEqual([FLAME_PIECE.TIP_LEFT, FLAME_PIECE.ARM_LEFT, 103, 101]);
  });
  it('sem a segunda bomba o mesmo braço chega à 10ª casa', () => {
    const s = arena();
    const a = addBomb(s, 0, C(2, 1), { fuse: 0, fire: 8 }); a.born = 0;
    run(s, 1);
    expect([codeAt(s, 12, 1), codeAt(s, 13, 1), s.cellAux[C(12, 1)]]).toEqual([CODE.FLAME, CODE.FLOOR, FLAME_PIECE.TIP_RIGHT]);
  });
  it('perfurante também para na bomba (o desvio da bomba não olha o tipo)', () => {
    const s = arena();
    const a = addBomb(s, 0, C(2, 1), { fuse: 0, fire: 8, type: 2 }); a.born = 0;
    addBomb(s, 1, C(9, 1));
    run(s, 1);
    expect([codeAt(s, 8, 1), codeAt(s, 9, 1), codeAt(s, 10, 1)]).toEqual([CODE.FLAME, CODE.BOMB, CODE.FLOOR]);
  });
  it('bomba já marcada pela cadeia também segura o braço e não tem a cadeia adiada', () => {
    const s = arena();
    const a = addBomb(s, 0, C(2, 1), { fuse: 0, fire: 8 }); a.born = 0;
    const o = addBomb(s, 1, C(9, 1), { chainAt: 101 });
    run(s, 1);                                       // tick 101: as duas explodem; a ordem do vetor decide quem vê quem
    expect(o.chainAt).toBe(101);
    expect(codeAt(s, 13, 1)).toBe(CODE.FLOOR);
  });
  it('bomba chutada em movimento não está na grade: o braço passa e ela explode 1 tick depois (emulador)', () => {
    const s = arena();
    const a = addBomb(s, 0, C(2, 1), { fuse: 0, fire: 8 }); a.born = 0;
    addBomb(s, 1, C(6, 1), { state: 'kicked', dir: 2, step: 3, x: centerX(6) + 6 * 256 });
    const ev1 = run(s, 1);                           // tick 101
    expect(ev1.filter(e => e.type === 'explosion').length).toBe(1);
    expect([codeAt(s, 6, 1), codeAt(s, 7, 1), codeAt(s, 12, 1)]).toEqual([CODE.FLAME, CODE.FLAME, CODE.FLAME]);
    expect(run(s, 1).filter(e => e.type === 'explosion').map(e => e.type === 'explosion' && e.owner)).toEqual([1]);   // tick 102
  });
  it('perfurante: item queima e o braço segue; bloco queimando não segura ($C1:405B, $C1:411A)', () => {
    const s = arena();
    setCell(s, 5, 1, itemCode(0x03)); setCell(s, 7, 1, CODE.BURNING); s.cellT0[C(7, 1)] = 100;
    const b = addBomb(s, 0, C(4, 1), { fuse: 0, fire: 4, type: 2 }); b.born = 0;   // alcance 6 (até a col 10)
    run(s, 1);
    expect(arm(s, 5, 11)).toEqual([CODE.BURNING, CODE.FLAME, CODE.BURNING, CODE.FLAME, CODE.FLAME, CODE.FLAME, CODE.FLOOR]);
    expect(s.cellAux[C(10, 1)]).toBe(FLAME_PIECE.TIP_RIGHT);
  });
  it('comum: o mesmo item segura o braço', () => {
    const s = arena();
    setCell(s, 5, 1, itemCode(0x03));
    const b = addBomb(s, 0, C(4, 1), { fuse: 0, fire: 4 }); b.born = 0;
    run(s, 1);
    expect(arm(s, 5, 6)).toEqual([CODE.BURNING, CODE.FLOOR]);
  });
  it('perfurante: caveira pula e o braço segue', () => {
    const s = arena(); setCell(s, 5, 1, itemCode(0x23));
    const b = addBomb(s, 0, C(4, 1), { fuse: 0, fire: 4, type: 2 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 5, 1), codeAt(s, 6, 1)]).toEqual([CODE.FLOOR, CODE.FLAME]);
    expect(s.flyers).toEqual([expect.objectContaining({ kind: 'item', ref: 0x23 })]);
  });
  it('crossCells (perigo da IA) segue as mesmas regras', () => {
    const s = arena();
    setCell(s, 5, 1, itemCode(0x03)); setCell(s, 7, 1, CODE.BURNING); addBomb(s, 1, C(9, 1));
    const p = crossCells(s, C(4, 1), 8, true);
    expect([p.cells.includes(C(6, 1)), p.cells.includes(C(8, 1)), p.cells.includes(C(7, 1)), p.bombs]).toEqual([true, true, false, [C(9, 1)]]);
    expect(p.cells.includes(C(10, 1))).toBe(false);
    const n = crossCells(s, C(4, 1), 8, false);
    expect([n.cells.includes(C(5, 1)), n.cells.includes(C(6, 1))]).toEqual([true, false]);
  });
});

describe('cruzamento de chamas ($C1:40B2): o braço para no centro de outra explosão e num braço da mesma direção', () => {
  // A rotina do braço, ao chegar numa casa já em chama (bit $1000), compara o tile (AND #$C30E) com o centro ($030C) e
  // com a ponta/braço da própria direção ($4C/$4E): se bater, RTL — para ali sem acender. Medido no emulador (arena 1
  // sem blocos, linha 5): aj-fogo/chain.py, samedir.py e victim.py.
  const F = CODE.FLAME, O = CODE.FLOOR;
  const row = (s: ReturnType<typeof arena>, from: number, to: number, lin = 5) => {
    const out: number[] = [];
    for (let c = from; c <= to; c++) out.push(codeAt(s, c, lin));
    return out;
  };
  /** chain.py 2 2 6 8: A (8,5) alcance 2 explode e acende B (10,5) alcance 6, que explode 2 ticks depois. */
  const chain = (withA = true) => {
    const s = arena({ players: 3 });
    if (withA) { const a = addBomb(s, 0, C(8, 5), { fuse: 0, fire: 0 }); a.born = 0; }
    const b = addBomb(s, 1, C(10, 5), { fuse: withA ? 120 : 0, fire: 4 }); b.born = 0;
    return s;
  };
  it('(a) cadeia em linha: o braço de B na direção de A para no centro de A; as casas além não acendem', () => {
    const s = chain();
    run(s, 1);                                       // tick 101: A
    expect(row(s, 4, 14)).toEqual([O, O, F, F, F, F, CODE.BOMB, O, O, O, O]);
    run(s, 2);                                       // tick 103: B
    expect(row(s, 4, 14)).toEqual([O, O, F, F, F, F, F, F, F, F, F]);
    const aux = (c: number) => s.cellAux[C(c, 5)], t0 = (c: number) => s.cellT0[C(c, 5)];
    // 6..8 continuam de A (ponta, braço, centro); 9 virou de B (braço esquerdo por cima do braço direito de A)
    expect([6, 7, 8, 9, 10].map(aux)).toEqual([FLAME_PIECE.TIP_LEFT, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.CENTER, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.CENTER]);
    expect([6, 7, 8, 9, 10].map(t0)).toEqual([101, 101, 101, 103, 103]);
    // braço direito de B: 11..14 e parede em 15 (4 casas < alcance 6) — sem ponta
    expect([11, 14].map(aux)).toEqual([FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_RIGHT]);
    run(s, 23);                                      // tick 126: A apaga (25 ticks), a casa 9 segue com B até o 128
    expect(row(s, 6, 10)).toEqual([O, O, O, F, F]);
    run(s, 2);
    expect(row(s, 6, 10)).toEqual([O, O, O, O, O]);
  });
  it('(a) sem A, o mesmo braço de B chega à casa 4', () => {
    const s = chain(false);
    run(s, 1);
    expect(row(s, 4, 9)).toEqual([F, F, F, F, F, F]);
    expect(s.cellAux[C(4, 5)]).toBe(FLAME_PIECE.TIP_LEFT);
  });
  it('(g) quem está além do ponto de parada não morre; sem A morre (emulador: victim.py 5 / 5 semA)', () => {
    for (const withA of [true, false]) {
      const s = chain(withA);
      const p = put(s, 2, 5, 5); p.inv = 0;
      for (const q of [0, 1]) s.players[q].inv = 999;
      run(s, 40);
      expect(s.phase).toBe('play');
      expect(p.state === 'alive' && p.act !== 'dying').toBe(withA);
    }
  });
  /** samedir.py: A em `a` explode; 5 ticks depois uma bomba B (alcance 4) explode dentro do braço de A, em `b`
   *  (como uma chutada ou arremessada que pousa na chama). */
  const inside = (a: number, fireA: number, b: number) => {
    const s = arena();
    const A = addBomb(s, 0, a, { fuse: 0, fire: fireA }); A.born = 0;
    run(s, 5);                                       // tick 101: A; tick 105
    const B = addBomb(s, 1, b, { fuse: 0, fire: 2 }); B.born = 0;
    run(s, 1);                                       // tick 106: B
    return s;
  };
  it('(c) mesma direção: dentro do braço direito de A, o braço direito de B para já na casa seguinte', () => {
    const s = inside(C(6, 5), 3, C(8, 5));           // A alcance 5: 7..11
    const aux = (c: number) => s.cellAux[C(c, 5)], t0 = (c: number) => s.cellT0[C(c, 5)];
    expect([6, 7, 8, 9, 10, 11].map(aux)).toEqual([FLAME_PIECE.CENTER, FLAME_PIECE.ARM_LEFT, FLAME_PIECE.CENTER,
      FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.TIP_RIGHT]);
    expect([6, 7, 8, 9, 10, 11].map(t0)).toEqual([101, 106, 106, 101, 101, 101]);   // o esquerdo atravessa 7 e para em 6
    // cima e baixo de B não cruzam nada: alcance 4 inteiro, com ponta
    expect([s.cellAux[C(8, 1)], s.cellAux[C(8, 9)], codeAt(s, 8, 10)]).toEqual([FLAME_PIECE.TIP_UP, FLAME_PIECE.TIP_DOWN, O]);
  });
  it('(c) mesma direção na vertical e para a esquerda', () => {
    const v = inside(C(8, 3), 4, C(8, 5));           // A alcance 6: baixo 4..9
    expect([4, 5, 6].map(l => v.cellT0[C(8, l)])).toEqual([106, 106, 101]);
    expect(v.cellAux[C(8, 4)]).toBe(FLAME_PIECE.ARM_UP);
    const h = inside(C(10, 5), 3, C(8, 5));          // A alcance 5: esquerda 9..5
    expect([7, 8, 9, 10].map(c => h.cellT0[C(c, 5)])).toEqual([101, 106, 106, 101]);
    expect(h.cellAux[C(9, 5)]).toBe(FLAME_PIECE.ARM_RIGHT);
  });
  it('(b) cruzamento perpendicular: o braço passa por cima, toma a casa e segue', () => {
    const s = arena();
    const A = addBomb(s, 0, C(6, 3), { fuse: 0, fire: 2 }); A.born = 0;    // baixo 4..7
    run(s, 3);
    const B = addBomb(s, 1, C(4, 5), { fuse: 0, fire: 2 }); B.born = 0;    // direita 5..8
    run(s, 1);
    expect([s.cellAux[C(6, 5)], s.cellT0[C(6, 5)], s.cellAux[C(8, 5)], s.cellT0[C(6, 6)]])
      .toEqual([FLAME_PIECE.ARM_RIGHT, 104, FLAME_PIECE.TIP_RIGHT, 101]);
  });
  it('ponta só no alcance inteiro ($C1:51BC): braço cortado por bloco, parede ou centro termina com a peça do meio', () => {
    const s = arena();
    setCell(s, 9, 5, CODE.SOFT);
    const b = addBomb(s, 0, C(6, 5), { fuse: 0, fire: 3 }); b.born = 0;   // alcance 5
    run(s, 1);
    const aux = (c: number, l: number) => s.cellAux[C(c, l)];
    expect([aux(7, 5), aux(8, 5), codeAt(s, 9, 5)]).toEqual([FLAME_PIECE.ARM_RIGHT, FLAME_PIECE.ARM_RIGHT, CODE.BURNING]);   // bloco
    expect([aux(2, 5), codeAt(s, 1, 5), aux(6, 1), codeAt(s, 6, 0)])
      .toEqual([FLAME_PIECE.ARM_LEFT, CODE.HARD, FLAME_PIECE.ARM_UP, CODE.HARD]);                                    // parede (4 casas)
    expect([aux(6, 9), aux(6, 10), codeAt(s, 6, 11)]).toEqual([FLAME_PIECE.ARM_DOWN, FLAME_PIECE.TIP_DOWN, CODE.FLOOR]); // 5 casas: ponta
  });
  it('a casa onde o braço para ainda passa pelo gancho da arena ($C1:550B, repintura da arena 6, vem antes de $C1:40B2)', () => {
    const seen: [number, number][] = [];
    withStage(1, { onFlameCell: (_s, c, d) => { seen.push([c, d]); } }, () => {
      const s = chain();
      run(s, 3);
      expect(seen.filter(([c]) => c === C(8, 5))).toEqual([[C(8, 5), -1], [C(8, 5), 6]]);   // centro de A; braço esquerdo de B
      expect(seen.filter(([c, d]) => d === 6 && colOf(c) < 8 && linOf(c) === 5).map(([c]) => colOf(c))).toEqual([7, 6]);  // só os de A
    });
  });
  it('armStops: centro e peças da própria direção seguram; as outras não', () => {
    const P = FLAME_PIECE;
    expect([P.CENTER, P.ARM_UP, P.TIP_UP, P.ARM_DOWN, P.TIP_DOWN, P.ARM_LEFT, P.ARM_RIGHT].map(x => armStops(x, 0)))
      .toEqual([true, true, true, false, false, false, false]);
    expect([P.ARM_RIGHT, P.TIP_RIGHT, P.ARM_LEFT, P.TIP_LEFT].map(x => armStops(x, 6))).toEqual([false, false, true, true]);
  });
});

describe('explosão das bombas evoluídas (área, atravessa blocos)', () => {
  const flame = (s: ReturnType<typeof arena>, c: number, l: number) => codeAt(s, c, l) === CODE.FLAME;
  it('D: todas as casas livres do quadrado 5×5; nada fora', () => {
    const s = arena();
    const b = addBomb(s, 0, C(7, 5), { fuse: 0, level: 1 }); b.born = 0;
    run(s, 1);
    for (const [c, l] of [[5, 3], [9, 3], [5, 7], [9, 7], [6, 4], [8, 6], [7, 3], [7, 7]]) expect(flame(s, c, l), `${c},${l}`).toBe(true);
    expect([codeAt(s, 7, 4), codeAt(s, 7, 6)]).toEqual([CODE.HARD, CODE.HARD]);   // pilares ficam
    for (const [c, l] of [[4, 5], [10, 5], [7, 2], [7, 8]]) expect(flame(s, c, l), `${c},${l}`).toBe(false);
  });
  it('S: quadrado 7×7 e queima blocos atrás de blocos', () => {
    const s = arena();
    setCell(s, 9, 5, CODE.SOFT); setCell(s, 10, 5, CODE.SOFT);
    const b = addBomb(s, 0, C(8, 5), { fuse: 0, level: 2, type: 0 }); b.born = 0;
    run(s, 1);
    expect([codeAt(s, 9, 5), codeAt(s, 10, 5)]).toEqual([CODE.BURNING, CODE.BURNING]);
    expect([flame(s, 5, 5), flame(s, 11, 5), flame(s, 8, 2), flame(s, 8, 8), flame(s, 4, 5)]).toEqual([true, true, true, true, false]);
  });
  it('H: a arena inteira', () => {
    const s = arena();
    const b = addBomb(s, 0, C(7, 5), { fuse: 0, level: 3 }); b.born = 0;
    run(s, 1);
    expect([flame(s, 2, 1), flame(s, 14, 11), flame(s, 2, 11), flame(s, 14, 1)]).toEqual([true, true, true, true]);
  });
});
