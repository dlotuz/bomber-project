import { arena, put, setCell, codeAt, C } from './kit';
import { punchBomb, startLift, throwHeld, tossHeld, aimThrow, tickFlyers, spawnItemFlyer, dropHeld } from '../../src/core/flyers';
import { addBomb, bombById } from '../../src/core/bombs';
import { CODE, type GameEvent, type RoundState } from '../../src/core/types';
import { itemCode } from '../../src/core/state';

function fly(s: RoundState, n: number, ev: GameEvent[] = []): GameEvent[] {
  for (let i = 0; i < n; i++) { s.tick++; tickFlyers(s, ev); }
  return ev;
}
function punchSetup(bomb: [number, number], player: [number, number], face: 0 | 2 | 4 | 6, players = 2) {
  const s = arena({ players });
  const p = put(s, 0, player[0], player[1]); p.punch = true; p.face = face;
  const b = addBomb(s, 0, C(bomb[0], bomb[1]));
  return { s, p, b };
}

describe('soco (t42, t43, t49)', () => {
  it('3 casas em 17 ticks, pavio congelado; pose de soco', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2); const ev: GameEvent[] = [];
    expect(punchBomb(s, p, ev)).toBe(true);
    expect([b.state, codeAt(s, 5, 1), p.act, p.actLeft]).toEqual(['air', CODE.FLOOR, 'punch', 8]);
    expect(ev).toEqual([{ type: 'punch', slot: 0 }]);
    fly(s, 16);
    expect(b.state).toBe('air');
    const ev2 = fly(s, 1);
    expect([b.state, b.cell, codeAt(s, 8, 1), b.fuse]).toEqual(['idle', C(8, 1), CODE.BOMB, 126]);
    expect(ev2).toEqual([{ type: 'bomb_landed', cell: C(8, 1) }]);
    expect(s.flyers).toEqual([]);
  });
  it('arco horizontal com pico de 10 px', () => {
    const { s, p } = punchSetup([5, 1], [4, 1], 2);
    punchBomb(s, p, []);
    let minZ = 0;
    for (let i = 0; i < 17; i++) { fly(s, 1); if (s.flyers[0]) minZ = Math.min(minZ, s.flyers[0].z); }
    expect(minZ).toBe(-10);
  });
  it('sem bomba à frente: só a pose', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
    expect(punchBomb(s, p, [])).toBe(false);
    expect(p.act).toBe('punch');
  });
  it('pouso em casa ocupada quica 1 casa em 8 ticks', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.SOFT);
    punchBomb(s, p, []);
    const ev = fly(s, 25);
    expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
    expect(ev.filter(e => e.type === 'bomb_bounce').length).toBe(1);
  });
  it('volta pela borda: da col 13 para a direita pousa na col 2 (17 + 3 × 8 ticks)', () => {
    const { s, p, b } = punchSetup([13, 3], [12, 3], 2);
    punchBomb(s, p, []);
    fly(s, 40); expect(b.state).toBe('air');
    fly(s, 1); expect([b.state, b.cell]).toEqual(['idle', C(2, 3)]);
  });
  it('volta pela borda: da lin 2 para cima, com jogador em (2,11), pousa na lin 10 (t49)', () => {
    const { s, p, b } = punchSetup([2, 2], [2, 3], 0, 4);
    put(s, 3, 2, 11);
    punchBomb(s, p, []);
    const ev = fly(s, 33);
    expect([b.state, b.cell]).toEqual(['idle', C(2, 10)]);
    expect(ev.filter(e => e.type === 'bomb_bounce').length).toBe(2);
  });
  it('pouso em bloco queimando: a bomba some', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.BURNING);
    punchBomb(s, p, []);
    fly(s, 17);
    expect(bombById(s, b.id)).toBeUndefined();
    expect(s.flyers).toEqual([]);
    expect(p.bombsFree).toBe(1);
  });
  it('pouso em chama: vira bomba e explode em 2 ticks', () => {
    const { s, p, b } = punchSetup([5, 1], [4, 1], 2);
    setCell(s, 8, 1, CODE.FLAME);
    punchBomb(s, p, []);
    fly(s, 17);
    expect([b.state, b.chainAt]).toEqual(['idle', s.tick + 2]);
  });
  it('em `won` voadores congelam', () => {
    const { s, p } = punchSetup([5, 1], [4, 1], 2);
    punchBomb(s, p, []);
    s.phase = 'won';
    fly(s, 30);
    expect(s.flyers.length).toBe(1);
  });
});

describe('luva (t48)', () => {
  it('levanta em 4 ticks; a bomba sai da grade e fica na mão', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true;
    const b = addBomb(s, 0, C(4, 1));
    expect(startLift(s, p, [])).toBe(true);
    expect([b.state, p.carry, codeAt(s, 4, 1), p.act, p.actLeft]).toEqual(['held', b.id, CODE.FLOOR, 'lift', 4]);
    expect(startLift(s, p, [])).toBe(false);
  });
  it('sem alvo: 5 casas em 12 ticks (horizontal) e 11 ticks (vertical)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []);
    const ev: GameEvent[] = [];
    throwHeld(s, p, ev);
    expect([p.carry, p.act, p.actLeft]).toEqual([-1, 'throw', 20]);
    expect(ev).toEqual([{ type: 'throw', slot: 0 }]);
    fly(s, 11); expect(b.state).toBe('air');
    fly(s, 1); expect([b.state, b.cell]).toEqual(['idle', C(9, 1)]);
    const s2 = arena(); const q = put(s2, 0, 4, 11); q.glove = true; q.face = 0;
    const b2 = addBomb(s2, 0, C(4, 11)); startLift(s2, q, []); throwHeld(s2, q, []);
    fly(s2, 11);
    expect([b2.state, b2.cell]).toEqual(['idle', C(4, 6)]);
  });
  it('mira: o 1º jogador a 2, 3 ou 4 casas; senão 5', () => {
    const s = arena({ players: 3 });
    put(s, 0, 4, 1); put(s, 1, 7, 1); put(s, 2, 12, 5);
    expect(aimThrow(s, C(4, 1), 2, 0)).toBe(3);
    expect(aimThrow(s, C(4, 1), 6, 0)).toBe(5);
    put(s, 1, 5, 1);
    expect(aimThrow(s, C(4, 1), 2, 0)).toBe(5);    // a 1 casa não conta
  });
  it('cair em cima de jogador quica (e o atordoa, T12)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true; p.face = 2;
    put(s, 1, 7, 1);
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []); throwHeld(s, p, []);
    fly(s, 12 + 8);                               // THROW[3] horizontal tem 12 passos + quique de 8
    expect([b.state, b.cell]).toEqual(['idle', C(8, 1)]);
  });
  it('dropHeld: a bomba da mão cai na casa se estiver livre', () => {
    const s = arena(); const p = put(s, 0, 4, 1); p.glove = true;
    const b = addBomb(s, 0, C(4, 1)); startLift(s, p, []);
    dropHeld(s, p);
    expect([b.state, p.carry, codeAt(s, 4, 1)]).toEqual(['idle', -1, CODE.BOMB]);
  });
});

describe('itens voando ($C1:6715)', () => {
  it('script 1 = 5 casas para a direita, pousa como item', () => {
    const s = arena();
    spawnItemFlyer(s, 0x03, C(8, 5), 1);
    fly(s, 12);
    expect(codeAt(s, 13, 5)).toBe(itemCode(0x03));
    expect(s.flyers).toEqual([]);
  });
  it('casa ocupada quica; bloco queimando some', () => {
    const s = arena(); setCell(s, 13, 5, CODE.SOFT);
    spawnItemFlyer(s, 0x21, C(8, 5), 1);
    fly(s, 20);
    expect(codeAt(s, 14, 5)).toBe(itemCode(0x21));
    const s2 = arena(); setCell(s2, 13, 5, CODE.BURNING);
    spawnItemFlyer(s2, 0x03, C(8, 5), 1);
    fly(s2, 12);
    expect([s2.flyers.length, codeAt(s2, 13, 5)]).toEqual([0, CODE.BURNING]);
  });
});

describe('reflect (luva × luva) e soco em quem segura bomba', () => {
  function holding(s: RoundState, slot: number, col: number, face: 0 | 2 | 4 | 6) {
    const p = put(s, slot, col, 1); p.glove = true; p.face = face;
    const b = addBomb(s, slot, C(col, 1));
    startLift(s, p, []);
    return { p, b };
  }
  it('bomba da luva em quem segura bomba com a luva volta na direção de quem jogou', () => {
    const s = arena({ players: 2 });
    const a = holding(s, 0, 4, 2), d = holding(s, 1, 7, 6);
    throwHeld(s, a.p, []);
    const f = s.flyers[0];
    for (let i = 0; i < 60 && f.dir === 1; i++) fly(s, 1);
    expect(f.dir).toBe(3);                       // voltou para a esquerda
    expect(d.p.act).not.toBe('stunned');
    expect(d.p.carry).toBe(d.b.id);              // o defensor segue com a bomba na cabeça
    for (let i = 0; i < 80 && a.p.act !== 'stunned'; i++) fly(s, 1);
    expect(a.p.act).toBe('stunned');             // cai em quem jogou
  });
  it('quicou antes de cair em quem segura bomba: sem reflect — atordoa e a bomba dele cai na casa da frente', () => {
    const s = arena({ players: 2 });
    const a = holding(s, 0, 4, 2);
    setCell(s, 9, 1, CODE.SOFT);                 // arremesso de 5 casas cai no bloco (9,1) e quica para a (10,1)
    const d = holding(s, 1, 10, 2);
    throwHeld(s, a.p, []);
    const f = s.flyers[0];
    expect(f.flight).toBe('throw5');
    for (let i = 0; i < 80 && d.p.act !== 'stunned'; i++) fly(s, 1);
    expect(d.p.act).toBe('stunned');
    expect(f.dir).toBe(1);
    expect([d.b.state, d.b.cell]).toEqual(['idle', C(11, 1)]);
  });
  it('bomba largada com B caindo direto em quem segura bomba: também reflete', () => {
    const s = arena({ players: 2 });
    const a = holding(s, 0, 4, 2), d = holding(s, 1, 5, 6);
    tossHeld(s, a.p);
    const f = s.flyers[0];
    for (let i = 0; i < 40 && f.dir === 1; i++) fly(s, 1);
    expect(f.dir).toBe(3);
    expect([d.p.act, d.p.carry]).toEqual(['lift', d.b.id]);
  });
  it('soco em quem segura bomba: atordoa e ele larga a própria bomba na casa da frente', () => {
    const s = arena({ players: 2 });
    const d = holding(s, 1, 8, 6);
    const p = put(s, 0, 4, 1); p.punch = true; p.face = 2;
    addBomb(s, 0, C(5, 1));
    punchBomb(s, p, []);
    for (let i = 0; i < 60 && d.p.act !== 'stunned'; i++) fly(s, 1);
    expect(d.p.act).toBe('stunned');
    expect(d.p.carry).toBe(-1);
    expect([d.b.state, d.b.cell]).toEqual(['idle', C(7, 1)]);
  });
});
