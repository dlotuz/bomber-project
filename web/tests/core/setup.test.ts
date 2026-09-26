import { createRound } from '../../src/core/setup';
import { makeRng } from '../../src/core/rng';
import { rules } from './kit';
import { CODE } from '../../src/core/types';
import { cellOf, SPAWNS, spawnX, spawnY } from '../../src/core/units';
import { STAGE_ITEMS } from '../../src/core/tables/items';
import { STAGES } from '../../src/core/stages';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

const around = (col: number, lin: number) => [-1, 0, 1].flatMap(dl => [-1, 0, 1].map(dc => cellOf(col + dc, lin + dl)));

describe('montagem da rodada (§3.3)', () => {
  it('1 chamada rnd($FF) por jogador presente: fase 8 com 5 jogadores termina em $C689; com 2, em $4FAB', () => {
    expect(createRound(8, rules(), makeRng()).rng.seed).toBe(0xc689);
    expect(createRound(8, rules({ active: [true, true, false, false, false] }), makeRng()).rng.seed).toBe(0x4fab);
  });
  it('fase 5: 15 tentativas sem soft e a lista também sem soft → termina (semente $9401)', () => {
    expect(createRound(5, rules(), makeRng()).rng.seed).toBe(0x9401);
  });
  it('3×3 em volta de cada spawn presente fica livre', () => {
    const s = createRound(1, rules(), makeRng());
    for (const [col, lin] of SPAWNS) for (const c of around(col, lin)) expect(s.grid[c] === CODE.SOFT).toBe(false);
  });
  it('spawn ausente não abre o 3×3 (P5 desligado na fase 1)', () => {
    const s = createRound(1, rules({ active: [true, true, true, true, false] }), makeRng());
    expect(around(8, 6).some(c => s.grid[c] === CODE.SOFT)).toBe(true);
  });
  it('itens escondidos só sob soft, sem repetir casa, na quantidade da lista', () => {
    for (const k of [1, 2, 3, 4, 6, 7, 9, 10]) {
      const s = createRound(k, rules(), makeRng());
      expect(s.hidden.length).toBe(STAGE_ITEMS[k - 1].length);
      expect(new Set(s.hidden.map(([c]) => c)).size).toBe(s.hidden.length);
      for (const [c] of s.hidden) expect(s.grid[c]).toBe(CODE.SOFT);
    }
  });
  it('init da arena roda depois da remoção e antes dos itens; init da montaria também', () => {
    const order: string[] = [];
    STAGES[4] = { init: s => { order.push(`stage:${s.hidden.length}`); } };
    MOUNTS.current = { ...NO_MOUNT, init: s => { order.push(`mount:${s.hidden.length}`); } };
    try { createRound(4, rules(), makeRng()); } finally { STAGES[4] = {}; MOUNTS.current = NO_MOUNT; }
    expect(order).toEqual(['stage:0', 'mount:0']);
  });
  it('status inicial: nível 1, 1 bomba, fogo 0, sem invencibilidade; nos spawns, olhando para baixo', () => {
    const s = createRound(1, rules(), makeRng());
    s.players.forEach((p, i) => {
      expect([p.speedLv, p.bombsCap, p.bombsFree, p.fire, p.inv, p.face]).toEqual([1, 1, 1, 0, 0, 4]);
      expect([p.x, p.y]).toEqual([spawnX(SPAWNS[i][0]), spawnY(SPAWNS[i][1])]);
      expect(p.act).toBe('idle');
    });
    expect(s.phase).toBe('intro');
  });
  it('fase 5: 5 bombas, fogo 4, chute, soco, luva e P', () => {
    const p = createRound(5, rules(), makeRng()).players[0];
    expect([p.bombsCap, p.bombsFree, p.fire, p.kick, p.punch, p.glove, p.pItem]).toEqual([5, 5, 4, true, true, true, true]);
  });
  it('prêmio do Racer vale só com a regra ligada, em Todos contra Todos, para o slot premiado', () => {
    const on = rules({ racer: true });
    const s = createRound(1, on, makeRng(), { racerPrize: { slot: 2, prize: 0 } });
    expect(s.players.map(p => p.bombsCap)).toEqual([1, 1, 2, 1, 1]);
    expect(createRound(1, rules(), makeRng(), { racerPrize: { slot: 2, prize: 0 } }).players[2].bombsCap).toBe(1);
    expect(createRound(1, rules({ racer: true, mode: 'team' }), makeRng(), { racerPrize: { slot: 2, prize: 0 } }).players[2].bombsCap).toBe(1);
  });
  it('spawnOrder (opção extra) troca as casas de nascimento e abre o 3×3 nelas', () => {
    const s = createRound(1, rules(), makeRng(), { spawnOrder: [4, 3, 2, 1, 0] });
    expect([s.players[0].x, s.players[0].y]).toEqual([spawnX(8), spawnY(6)]);
    for (const c of around(8, 6)) expect(s.grid[c] === CODE.SOFT).toBe(false);
  });
  it('chars vão para os jogadores', () => {
    expect(createRound(1, rules(), makeRng(), { chars: [5, 4, 3, 2, 1] }).players.map(p => p.char)).toEqual([5, 4, 3, 2, 1]);
  });
});
