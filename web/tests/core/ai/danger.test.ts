import { arena, put, setCell, C } from '../kit';
import { blockedUntil, dangerMap, SAFE, kickPath, pressureCells } from '../../../src/core/ai/danger';
import { addBomb, burnCell } from '../../../src/core/bombs';
import { step } from '../../../src/core/step';
import { BURN_TICKS } from '../../../src/core/constants';
import { BURN, CODE } from '../../../src/core/types';

describe('mapa de perigo (offsets a partir do próximo tick)', () => {
  it('bomba recém-colocada: cruz letal a partir do offset 128; resto seguro', () => {
    const s = arena(); addBomb(s, 0, C(6, 1));
    const d = dangerMap(s);
    for (const c of [C(6, 1), C(5, 1), C(4, 1), C(7, 1), C(8, 1), C(6, 2), C(6, 3)]) expect(d[c]).toBe(128);
    expect([d[C(9, 1)], d[C(6, 4)], d[C(10, 5)]]).toEqual([SAFE, SAFE, SAFE]);
  });
  it('pilar e soft param a cruz como no núcleo', () => {
    const s = arena(); addBomb(s, 0, C(5, 1), { fire: 3 }); setCell(s, 7, 1, CODE.SOFT);
    const d = dangerMap(s);
    expect([d[C(5, 2)], d[C(7, 1)], d[C(8, 1)]]).toEqual([SAFE, 128, SAFE]);
  });
  it('cadeia: +2 por elo', () => {
    const s = arena();
    addBomb(s, 0, C(4, 1), { fuse: 10 });
    addBomb(s, 1, C(6, 1), { fuse: 100 });
    const d = dangerMap(s);
    expect([d[C(4, 1)], d[C(6, 1)], d[C(8, 1)]]).toEqual([12, 14, 14]);
  });
  it('chama atual é letal já no próximo tick', () => {
    const s = arena(); setCell(s, 6, 1, CODE.FLAME); s.cellT0[C(6, 1)] = 100;
    expect(dangerMap(s)[C(6, 1)]).toBe(1);
  });
  it('remota de adversário é perigo permanente; a própria não', () => {
    const s = arena(); addBomb(s, 1, C(6, 1), { type: 1 });
    expect(dangerMap(s, 0)[C(6, 1)]).toBe(1);
    expect(dangerMap(s, 1)[C(6, 1)]).toBe(SAFE);
  });
  it('remota de dono que não está de pé: não é perigo permanente (só bloqueia); explode por cadeia', () => {
    const s = arena({ players: 3 }); addBomb(s, 1, C(6, 1), { type: 1 });
    s.players[1].state = 'out';
    const d = dangerMap(s, 0);
    expect([d[C(6, 1)], d[C(7, 1)], d[C(6, 2)]]).toEqual([SAFE, SAFE, SAFE]);
    expect(s.grid[C(6, 1)]).toBe(CODE.BOMB);                   // a casa continua bloqueada (bomba na grade)
    addBomb(s, 2, C(4, 1), { fuse: 10 });                     // cadeia: a órfã explode 2 ticks depois da que a alcança
    expect(dangerMap(s, 0)[C(8, 1)]).toBe(14);
  });
  it('blockedUntil: queima de T0 vira piso no tick T0+24; o 1º passo que pode entrar é o do tick T0+25 (offset +1)', () => {
    const s = arena(); burnCell(s, C(6, 1), BURN.SOFT);         // T0 = 100
    const bu = blockedUntil(s)[C(6, 1)];
    expect(bu).toBe(BURN_TICKS + 1);
    let k = 0;
    while (s.grid[C(6, 1)] === CODE.BURNING) { step(s, [0, 0, 0, 0, 0]); k++; }
    expect([k, s.tick]).toEqual([BURN_TICKS, 100 + BURN_TICKS]);   // limpa no passo de objetos, depois dos jogadores
    expect(bu).toBe(k + 1);
  });
  it('bomba chutada que não para a tempo explode no meio do caminho, com a trilha marcada', () => {
    const s = arena(); put(s, 1, 8, 5);
    const b = addBomb(s, 0, C(5, 1), { fuse: 20 });
    s.grid[C(5, 1)] = CODE.FLOOR; b.state = 'kicked'; b.dir = 2; b.step = 0;
    const k = kickPath(s, b);
    expect([k.cell, k.t]).toEqual([C(7, 1), 21]);
    expect(k.trail).toEqual([C(5, 1), C(6, 1), C(7, 1)]);
    const d = dangerMap(s);
    expect([d[C(6, 1)], d[C(9, 1)]]).toEqual([22, 22]);
  });
  it('pressão: cronograma exato mesmo antes do gatilho (pelo relógio)', () => {
    const s = arena(); s.clock = { sec: 62, sub: 10 };
    const pc = pressureCells(s);
    expect(pc.get(C(2, 1))).toBe(10 + 205 + 38);
    expect(pc.get(C(3, 1))).toBe(10 + 219 + 38);
    // bloco a 253 ticks: além do horizonte, ainda não é perigo (senão todos correm para o centro em 1:00)
    expect(dangerMap(s)[C(2, 1)]).toBe(SAFE);
    s.tick = 1000; s.pressure.trigger = s.tick - 150;        // 150 ticks depois do gatilho: pousa em 93, dentro
    expect([pressureCells(s).get(C(2, 1)), dangerMap(s)[C(2, 1)], dangerMap(s)[C(8, 6)]]).toEqual([93, 94, SAFE]);
  });
});
