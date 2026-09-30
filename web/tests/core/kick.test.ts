import { arena, put, setCell, codeAt, C, withStage } from './kit';
import { tryKick, slideStep, stopKick } from '../../src/core/kick';
import { addBomb, tickBombs } from '../../src/core/bombs';
import { launchBomb, punchBomb, tickFlyers } from '../../src/core/flyers';
import { BTN, CODE, type Bomb, type GameEvent, type RoundState } from '../../src/core/types';
import { CELLS, cellCenter, centerX, centerY } from '../../src/core/units';
import { itemCode } from '../../src/core/state';
import { FUSE } from '../../src/core/constants';

function slide(s: RoundState, b: Bomb, n: number, ev: GameEvent[] = []): void {
  for (let i = 0; i < n; i++) { s.tick++; if (b.state === 'kicked' && s.bombs.includes(b)) slideStep(s, b, ev); }   // como tickBombs: removida (fundiu) não anda
}
function setup(bombCol = 5, lin = 1) {
  const s = arena();
  const p = put(s, 0, bombCol - 1, lin); p.kick = true; p.face = 2;
  const b = addBomb(s, 1, C(bombCol, lin));
  return { s, p, b };
}

describe('chute (t36, t41, t91)', () => {
  it('dispara no centro olhando para a bomba; a bomba sai da grade', () => {
    const { s, p, b } = setup(); const ev: GameEvent[] = [];
    expect(tryKick(s, p, ev)).toBe(true);
    expect([b.state, b.dir, b.kickedBy, codeAt(s, 5, 1)]).toEqual(['kicked', 2, 0, CODE.FLOOR]);
    expect(ev).toEqual([{ type: 'bomb_kicked', slot: 0 }]);
  });
  it('não dispara sem Chute, 2 px antes do centro, nem com pavio 1', () => {
    let k = setup(); k.p.kick = false; expect(tryKick(k.s, k.p, [])).toBe(false);
    k = setup(); k.p.x = centerX(4) - 2 * 256; expect(tryKick(k.s, k.p, [])).toBe(false);
    k = setup(); k.p.x = centerX(4) - 256; expect(tryKick(k.s, k.p, [])).toBe(true);
    k = setup(); k.b.fuse = 1; expect(tryKick(k.s, k.p, [])).toBe(false);
  });
  it('2 px/tick, 8 ticks por casa; para alinhada antes da parede (col 14)', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []);
    slide(s, b, 1); expect(b.x).toBe(centerX(5) + 2 * 256);
    slide(s, b, 7); expect([b.cell, b.x]).toEqual([C(6, 1), centerX(6)]);
    slide(s, b, 64); expect([b.cell, b.state]).toEqual([C(14, 1), 'kicked']);
    slide(s, b, 1); expect([b.state, codeAt(s, 14, 1), b.x, b.y]).toEqual(['idle', CODE.BOMB, centerX(14), centerY(1)]);
  });
  it('para antes de jogador, soft e outra bomba', () => {
    for (const block of ['player', 'soft', 'bomb'] as const) {
      const { s, p, b } = setup();
      if (block === 'player') put(s, 1, 8, 1);
      if (block === 'soft') setCell(s, 8, 1, CODE.SOFT);
      if (block === 'bomb') addBomb(s, 1, C(8, 1));   // parada: não funde (só bombas em movimento fundem)
      tryKick(s, p, []);
      slide(s, b, 40);
      expect([b.state, b.cell]).toEqual(['idle', C(7, 1)]);
    }
  });
  it('item no caminho é esmagado e a bomba segue', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, itemCode(0x03));
    tryKick(s, p, []);
    slide(s, b, 100);
    expect([codeAt(s, 7, 1), b.cell]).toEqual([CODE.FLOOR, C(14, 1)]);
  });
  it('ovo bloqueia', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, 0x097a);
    tryKick(s, p, []); slide(s, b, 40);
    expect(b.cell).toBe(C(6, 1));
  });
  it('X para a bomba chutada pelo jogador na casa em que ela está', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []);
    slide(s, b, 12);                               // centro em x = centro(5) + 24 px → casa 6
    stopKick(s, p);
    expect([b.state, b.cell, b.x, codeAt(s, 6, 1)]).toEqual(['idle', C(6, 1), centerX(6), CODE.BOMB]);
  });
  it('entrar em casa com chama marca a explosão para o tick seguinte', () => {
    const { s, p, b } = setup(); setCell(s, 7, 1, CODE.FLAME);
    tryKick(s, p, []);
    slide(s, b, 8);                                // chega em (6,1) no tick 108
    slide(s, b, 1);                                // tick 109: decide entrar em (7,1)
    expect(b.chainAt).toBe(110);
  });
  it('kickedBombEnter: stop para antes; {turn} entra e vira', () => {
    withStage(1, { kickedBombEnter: (_s, _b, cell) => (cell === C(8, 3) ? { turn: 4 } : 'go') }, () => {
      const { s, p, b } = setup(5, 3);
      tryKick(s, p, []);
      slide(s, b, 200);
      expect([b.state, b.cell]).toEqual(['idle', C(8, 11)]);
    });
    withStage(1, { kickedBombEnter: (_s, _b, cell) => (cell === C(9, 1) ? 'stop' : 'go') }, () => {
      const { s, p, b } = setup();
      tryKick(s, p, []); slide(s, b, 100);
      expect(b.cell).toBe(C(8, 1));
    });
  });

  it('parar em casa ocupada por outra bomba: estaciona na casa anterior', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []);
    slide(s, b, 12);                               // centro na casa 6; a casa 6 já tem bomba
    addBomb(s, 1, C(6, 1));
    stopKick(s, p);
    expect([b.state, b.cell, codeAt(s, 5, 1)]).toEqual(['idle', C(5, 1), CODE.BOMB]);
  });
  it('parar em casa de pressão ($EE80): estaciona na anterior; sem nenhuma, continua deslizando', () => {
    let k = setup();
    tryKick(k.s, k.p, []); slide(k.s, k.b, 12);
    setCell(k.s, 6, 1, CODE.PRESSURE);
    stopKick(k.s, k.p);
    expect([k.b.state, k.b.cell]).toEqual(['idle', C(5, 1)]);
    k = setup();
    tryKick(k.s, k.p, []); slide(k.s, k.b, 12);
    setCell(k.s, 6, 1, CODE.PRESSURE); addBomb(k.s, 1, C(5, 1));
    stopKick(k.s, k.p);
    expect(k.b.state).toBe('kicked');
  });
  it('parar sobre chama marca a explosão para o tick seguinte', () => {
    const { s, p, b } = setup();
    tryKick(s, p, []); slide(s, b, 12);
    setCell(s, 6, 1, CODE.FLAME);
    stopKick(s, p);
    expect([b.state, b.cell, b.chainAt]).toEqual(['idle', C(6, 1), s.tick + 1]);
  });
  it('cenário: chutar, arremessar sobre a casa da bomba que desliza, chutar de novo, X → nunca 2 bombas na mesma casa', () => {
    const s = arena({ players: 1 });
    const p = put(s, 0, 4, 3); p.kick = true; p.face = 2;
    const a = addBomb(s, 1, C(5, 3), { born: 0 });
    const b = addBomb(s, 1, C(2, 3), { born: 0 });
    const ev: GameEvent[] = [];
    const idleCount = (): number[] => {
      const n = new Array<number>(CELLS).fill(0);
      for (const o of s.bombs) if (o.state === 'idle') n[o.cell]++;
      return n;
    };
    const tick = (act?: () => void): void => {
      s.tick++; act?.(); tickBombs(s, ev); tickFlyers(s, ev);
      const n = idleCount();
      for (let c = 0; c < CELLS; c++) expect((s.grid[c] === CODE.BOMB) === (n[c] === 1) && n[c] <= 1, `tick ${s.tick}, casa ${c}`).toBe(true);
    };
    const t0 = s.tick;
    const [x, y] = cellCenter(C(2, 3));
    launchBomb(s, b, 'punch', 1, { x, y, z: 0 });            // soco de 3 casas: pousa em (5,3) em t0 + 17
    while (s.tick < t0 + 16) tick();
    tick(() => tryKick(s, p, ev));                            // t0 + 16: chuta A, que ainda ocupa (5,3) no pouso
    tick();                                                   // t0 + 17: B pousaria em (5,3)
    expect(ev.some(e => e.type === 'bomb_bounce' && e.cell === C(5, 3))).toBe(true);
    tick(() => tryKick(s, p, ev));                            // chutar de novo: não há bomba parada em (5,3)
    while (s.tick < t0 + 22) tick();
    tick(() => stopKick(s, p));                               // X
    while (s.tick < t0 + 60) tick();
    expect([a.state, b.state]).toEqual(['idle', 'idle']);
    expect(a.cell).not.toBe(b.cell);
  });
});

describe('X segurado: minha bomba não pode ser chutada pelos outros', () => {
  it('dono segurando X: outro jogador não chuta; eu mesmo chuto; soltou X, chuta', () => {
    const { s, p, b } = setup();                // p (slot 0) chuta a bomba do slot 1
    s.players[1].prevBtn = BTN.X;
    expect(tryKick(s, p, [])).toBe(false);
    expect(b.state).toBe('idle');
    s.players[1].prevBtn = 0;
    expect(tryKick(s, p, [])).toBe(true);
  });
  it('a própria bomba: X segurado não impede o dono de chutar', () => {
    const { s, p, b } = setup();
    b.owner = 0; p.prevBtn = BTN.X;
    expect(tryKick(s, p, [])).toBe(true);
  });
  it('o soco continua valendo na bomba de quem segura X', () => {
    const { s, p, b } = setup();
    s.players[1].prevBtn = BTN.X; p.punch = true;
    expect(punchBomb(s, p, [])).toBe(true);
    expect(b.state).toBe('air');
  });
});

describe('evolução: duas bombas em movimento que se batem (comum+comum = D, D+comum = S, S+comum = H)', () => {
  /** Bomba em (4,1) deslizando para a direita e outra em (10,1) deslizando para a esquerda. */
  function collide(la = 0, lb = 0) {
    const s = arena();
    const a = addBomb(s, 0, C(4, 1), { level: la });
    const b = addBomb(s, 1, C(10, 1), { level: lb });
    for (const [x, dir] of [[a, 2], [b, 6]] as const) {
      x.state = 'kicked'; x.dir = dir; x.step = 0; x.kickedBy = 0; x.turn = -1; s.grid[x.cell] = CODE.FLOOR;
    }
    s.players[0].bombsFree = 0; s.players[1].bombsFree = 0;
    for (let i = 0; i < 60; i++) {
      s.tick++;
      for (const x of [a, b]) if (x.state === 'kicked' && s.bombs.includes(x)) slideStep(s, x, []);
    }
    const alive = s.bombs.filter(x => x === a || x === b);
    return { s, a, b, alive };
  }
  it('comum + comum em movimento: sobra uma D parada, com pavio novo; a outra volta ao dono', () => {
    const { s, alive } = collide(0, 0);
    expect(alive.length).toBe(1);
    const m = alive[0];
    expect([m.level, m.state, m.fuse, s.grid[m.cell]]).toEqual([1, 'idle', FUSE, CODE.BOMB]);
    expect(s.players[0].bombsFree + s.players[1].bombsFree).toBe(1);
  });
  it('D + comum = S; S + comum = H (tanto faz qual das duas é a evoluída)', () => {
    expect(collide(1, 0).alive.map(x => x.level)).toEqual([2]);
    expect(collide(0, 1).alive.map(x => x.level)).toEqual([2]);
    expect(collide(2, 0).alive.map(x => x.level)).toEqual([3]);
    expect(collide(0, 2).alive.map(x => x.level)).toEqual([3]);
  });
  it('outras combinações em movimento só batem e param (D+D, D+S, H+comum)', () => {
    for (const [la, lb] of [[1, 1], [1, 2], [3, 0]] as const) {
      const r = collide(la, lb);
      expect(r.alive.map(x => [x.level, x.state]), `${la}+${lb}`).toEqual([[la, 'idle'], [lb, 'idle']]);
    }
  });
  it('bomba em movimento batendo em bomba parada não funde (só para encostada)', () => {
    for (const lv of [0, 1, 2]) {
      const { s, p, b } = setup();
      b.level = lv;
      const t = addBomb(s, 2, C(8, 1));
      tryKick(s, p, []); slide(s, b, 40);
      expect([t.level, b.level, b.state, b.cell], `nível ${lv}`).toEqual([0, lv, 'idle', C(7, 1)]);
    }
  });
});
