// Carrega o registro STAGES antes do módulo da arena: importar stage3 primeiro fecha o ciclo
// stage3 → kit → bombs → stages/index → stage3 com STAGES[3] = undefined.
import '../../src/core/stages';
import { stage3, st3 } from '../../src/core/stages/stage3';
import { stage3Ai } from '../../src/core/ai/stages/stage3';
import { CODE } from '../../src/core/types';
import { cellOf } from '../../src/core/units';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage3';
import '../../src/render/fallback/stages/stage3';
import { stageArena, fullRound, run, put, setCell, codeAt, stageEvents, mirror, fakeBuilder, fakeAssets, fakeCtx } from './kit';

/** Chama à esquerda da bola de (6,5) no tick atual e aviso de chama na bola: dispara no tick seguinte, para a direita. */
function fire(s: ReturnType<typeof stageArena>, col = 5, lin = 5): void {
  setCell(s, col, lin, CODE.FLAME);
  s.cellT0[cellOf(col, lin)] = s.tick;
  stage3.onFlameCell!(s, cellOf(6, 5), 6, []);
}
const orb65 = (s: ReturnType<typeof stageArena>) => st3(s).orbs[1];

describe('arena 3: carga', () => {
  it('golden: bolas em (10,7) e (6,5), nessa ordem; semente depois dos itens $C9B1 (nenhum sorteio da arena) [D1]', () => {
    const s = fullRound(3);
    expect(s.rng.seed).toBe(0xc9b1);
    expect(st3(s).orbs.map(o => o.cell)).toEqual([cellOf(10, 7), cellOf(6, 5)]);
    expect(codeAt(s, 10, 7)).toBe(CODE.ORB);
    expect(codeAt(s, 6, 5)).toBe(CODE.ORB);
    expect(st3(s).orbs.map(o => [o.x, o.y])).toEqual([[159, 143], [95, 111]]);
  });
});

describe('arena 3: disparo e rolagem', () => {
  it('sai para o lado oposto à chama, 1 px/tick, 16 ticks por casa, 8 casas; 1 rnd255 no disparo', () => {
    const s = stageArena(3);
    const m = mirror(0x12);
    fire(s);
    const ev = run(s, 1);                                      // tick 101: dispara
    const o = orb65(s);
    expect([o.rolling, o.dir, o.cellsLeft, o.turnSet]).toEqual([true, 1, 8, m.rnd(0xff) & 3]);
    expect(s.rng.seed).toBe(m.seed());
    expect(codeAt(s, 6, 5)).toBe(CODE.FLOOR);
    expect(stageEvents(ev, 'a3_roll').length).toBe(1);
    run(s, 16);                                                // tick 117: chega em (7,5)
    expect([o.x, o.cell]).toEqual([111, cellOf(7, 5)]);
    run(s, 112);                                               // tick 229: 8ª casa, (14,5)
    expect([o.x, o.rolling, o.cell]).toEqual([223, false, cellOf(14, 5)]);
    run(s, 1);
    expect(codeAt(s, 14, 5)).toBe(CODE.ORB);
  });
  it('sem chama vizinha não dispara; chama criada neste tick só vale no próximo (D4)', () => {
    const s = stageArena(3);
    stage3.onFlameCell!(s, cellOf(6, 5), 6, []);
    run(s, 1);
    expect(orb65(s).rolling).toBe(false);
    expect(codeAt(s, 6, 5)).toBe(CODE.ORB);
  });
  it('ordem de checagem das vizinhas: baixo antes de esquerda', () => {
    const s = stageArena(3);
    setCell(s, 6, 6, CODE.FLAME); s.cellT0[cellOf(6, 6)] = s.tick;
    fire(s);
    run(s, 1);
    expect(orb65(s).dir).toBe(0);                              // chama embaixo → sobe
  });
  it('bloqueio no 1º passo: vira pela tabela e não destrói o soft (softArmed = false no disparo)', () => {
    const s = stageArena(3);
    setCell(s, 7, 5, CODE.SOFT);
    fire(s);
    run(s, 1);
    const o = orb65(s);
    expect(o.turnSet).toBe(2);                                 // 66 & 3
    expect(o.dir).toBe(2);                                     // 1 + A3_TURN[2][0] = 2 (baixo)
    expect(codeAt(s, 7, 5)).toBe(CODE.SOFT);
  });
  it('depois de andar, o 1º soft em que bate queima (24 ticks) e a bola vira', () => {
    const s = stageArena(3);
    setCell(s, 9, 5, CODE.SOFT);
    fire(s);
    run(s, 33);                                                // tick 133: chega em (8,5)
    expect(codeAt(s, 9, 5)).toBe(CODE.BURNING);
    expect(orb65(s).dir).toBe(2);
  });
  it('4 falhas seguidas: para e volta a ORB na grade', () => {
    const s = stageArena(3);
    setCell(s, 8, 5, CODE.HARD);
    fire(s);
    run(s, 10);                                                // tick 110: a bola já saiu de (6,5)
    setCell(s, 6, 5, CODE.SOFT);
    run(s, 7);                                                 // tick 117: em (7,5): dir, baixo(pilar), cima(pilar), esq(soft queima)
    const o = orb65(s);
    expect([o.rolling, o.cell]).toEqual([false, cellOf(7, 5)]);
    expect(codeAt(s, 6, 5)).toBe(CODE.BURNING);
    run(s, 1);
    expect(codeAt(s, 7, 5)).toBe(CODE.ORB);
  });
  it('item no caminho é esmagado', () => {
    const s = stageArena(3);
    setCell(s, 8, 5, 0x0941);
    fire(s);
    run(s, 17);                                                // em (7,5) avalia (8,5): livre, vira piso
    expect(codeAt(s, 8, 5)).toBe(CODE.FLOOR);
  });
  it('parada sobre pressão: a bola some', () => {
    const s = stageArena(3);
    setCell(s, 6, 5, CODE.PRESSURE);
    run(s, 1);
    expect(orb65(s).alive).toBe(false);
  });
});

describe('arena 3: toque no jogador [D6]', () => {
  it('a < 8 px: atordoa, inv = 64, só uma vez enquanto inv > 0; não mata', () => {
    const s = stageArena(3);
    const p = put(s, 0, 6, 5, 7, 0);                           // 7 px à direita do centro da bola
    const ev = run(s, 10);
    expect(stageEvents(ev, 'a3_hit').length).toBe(1);
    expect(ev.filter(e => e.type === 'stunned').length).toBe(1);
    expect(p.state).toBe('alive');
    expect(p.inv).toBeGreaterThan(50);
  });
  it('a 8 px não toca', () => {
    const s = stageArena(3);
    put(s, 0, 6, 5, 8, 0);
    expect(stageEvents(run(s, 5), 'a3_hit').length).toBe(0);
  });
  it('bola rolando atordoa quem está no caminho', () => {
    const s = stageArena(3);
    const p = put(s, 0, 10, 5);
    fire(s);
    const ev = run(s, 70);
    expect(stageEvents(ev, 'a3_hit').map(e => e.slot)).toEqual([0]);
    expect(p.state).toBe('alive');
  });
});

describe('arena 3: IA e camadas', () => {
  it('danger: casas à frente da bola rolando, com o tempo de chegada', () => {
    const s = stageArena(3);
    fire(s);
    run(s, 1);
    const d = stage3Ai.danger!(s);
    expect(d.get(cellOf(7, 5))).toBe(16);
    expect(d.get(cellOf(8, 5))).toBe(32);
    expect(d.get(cellOf(14, 5))).toBe(128);
    expect(d.has(cellOf(6, 6))).toBe(false);
  });
  it('danger: bola parada com chama pega prevê a rota a partir do tick seguinte', () => {
    const s = stageArena(3);
    fire(s);
    const d = stage3Ai.danger!(s);
    expect(d.get(cellOf(7, 5))).toBe(17);
  });
  it('ROM: um sprite por bola viva, na posição da bola, prioridade 2', () => {
    const s = stageArena(3);
    const { b, calls } = fakeBuilder();
    romLayers.find(l => l.id === 'stage3')!.draw(s, b, fakeAssets(), 0);
    expect(calls.sprites.length).toBe(2);
    expect(calls.sprites.map(c => [c.e.x, c.e.y, c.e.prio])).toEqual([[151, 135, 2], [87, 103, 2]]);
    expect(calls.sprites[0].e.src).toEqual({ tile: 0x100 + 0x7f });   // tile OAM = +$1E ($100) + g; tick 100 = 2º quadro do fake
  });
  it('fallback: desenha as bolas', () => {
    const s = stageArena(3);
    const a = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage3')!.draw(s, a.ctx, {} as never, 0);
    expect(a.log.filter(x => x === 'arc').length).toBe(2);
  });
});

describe('arena 3: bola × bomba chutada (invariante: bola nunca sobre bomba)', () => {
  it('bomba chutada para antes da casa da bola parada e da casa para onde ela rola', () => {
    const s = stageArena(3);
    const o = st3(s).orbs[0];
    const b = { cell: o.cell - 1 } as Parameters<NonNullable<typeof stage3.kickedBombEnter>>[1];
    expect(stage3.kickedBombEnter!(s, b, o.cell)).toBe('stop');
    o.rolling = true; o.dir = 1;                                     // rolando para a direita
    expect(stage3.kickedBombEnter!(s, b, o.cell + 1)).toBe('stop');
    expect(stage3.kickedBombEnter!(s, b, o.cell + 17 * 3)).toBe('go');
  });
});
