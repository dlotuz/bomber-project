import { arena, put, setCell, codeAt, C } from './kit';
import { applyItem, pickup, dropCategory, placeDropped, loseItems, leakOne, STUN_LOSS } from '../../src/core/items';
import { addBomb, refundBomb } from '../../src/core/bombs';
import { CODE, ITEM, type GameEvent } from '../../src/core/types';
import { itemCode } from '../../src/core/state';
import { makeRng, rnd } from '../../src/core/rng';
import { FREE_CELLS } from '../../src/core/tables/cells';
import { MOUNTS, NO_MOUNT } from '../../src/core/mounts';

const onGrid = (s: ReturnType<typeof arena>, id: number) => s.grid.filter(v => v === itemCode(id)).length;

describe('efeitos (§3.8)', () => {
  it('máximos: bombas 8, fogo 7, patins 5', () => {
    const s = arena(); const p = s.players[0];
    for (let i = 0; i < 12; i++) { applyItem(s, p, ITEM.BOMB, []); applyItem(s, p, ITEM.FIRE, []); applyItem(s, p, ITEM.SPEED, []); }
    expect([p.bombsCap, p.bombsFree, p.fire, p.speedLv]).toEqual([8, 8, 7, 5]);
  });
  it('habilidades, exclusões e efeitos especiais', () => {
    const s = arena(); const p = s.players[0];
    applyItem(s, p, ITEM.KICK, []); applyItem(s, p, ITEM.PASS_BOMB, []);
    expect([p.kick, p.passBomb]).toEqual([false, true]);
    applyItem(s, p, ITEM.KICK, []);
    expect([p.kick, p.passBomb]).toEqual([true, false]);
    applyItem(s, p, ITEM.PIERCE, []); expect(p.bombType).toBe(2);
    applyItem(s, p, ITEM.REMOTE, []); expect(p.bombType).toBe(1);
    applyItem(s, p, ITEM.VEST, []); expect(p.inv).toBe(511);
    for (const [id, key] of [[ITEM.FULL_FIRE, 'fullFire'], [ITEM.GLOVE, 'glove'], [ITEM.HEART, 'heart'], [ITEM.PASS_SOFT, 'passSoft'], [ITEM.PUNCH, 'punch'], [ITEM.P, 'pItem']] as const) {
      applyItem(s, p, id, []); expect(p[key]).toBe(true);
    }
    applyItem(s, p, 0x22, []); expect(p.disease).toBe(0x22);
  });
  it('traje: costume = rnd(8)', () => {
    const s = arena(); const p = s.players[0];
    const r = makeRng(s.rng.seed); const want = rnd(r, 8);
    applyItem(s, p, ITEM.COSTUME, []);
    expect(p.costume).toBe(want);
  });
});

describe('coleta', () => {
  it('pega o item da casa, limpa a grade e emite item_picked', () => {
    const s = arena(); const p = put(s, 0, 4, 1); setCell(s, 4, 1, itemCode(ITEM.FIRE));
    const ev: GameEvent[] = [];
    pickup(s, p, ev);
    expect([p.fire, codeAt(s, 4, 1)]).toEqual([1, CODE.FLOOR]);
    expect(ev).toEqual([{ type: 'item_picked', slot: 0, item: ITEM.FIRE }]);
  });
  it('ovo vai para a montaria (grade fica como a montaria deixar)', () => {
    const s = arena(); const p = put(s, 0, 4, 1); setCell(s, 4, 1, 0x097c);
    const got: number[] = [];
    MOUNTS.current = { ...NO_MOUNT, stepOnEgg: (_s, _p, cell) => { got.push(cell); } };
    try { pickup(s, p, []); } finally { MOUNTS.current = NO_MOUNT; }
    expect(got).toEqual([C(4, 1)]);
    expect(codeAt(s, 4, 1)).toBe(0x097c);
  });
});

describe('drops da morte ($C2:1258)', () => {
  it('cada categoria sai inteira; fogo total, coração e doença não saem', () => {
    const s = arena(); const p = s.players[0];
    Object.assign(p, { bombsCap: 4, fire: 3, speedLv: 3, glove: true, bombType: 1, passSoft: true, punch: true, kick: true, passBomb: false, pItem: true, fullFire: true, heart: true });
    for (let k = 0; k < 10; k++) dropCategory(s, p, k, []);
    expect([onGrid(s, ITEM.BOMB), onGrid(s, ITEM.GLOVE), onGrid(s, ITEM.REMOTE), onGrid(s, ITEM.PASS_SOFT), onGrid(s, ITEM.FIRE),
      onGrid(s, ITEM.PUNCH), onGrid(s, ITEM.KICK), onGrid(s, ITEM.SPEED), onGrid(s, ITEM.P), onGrid(s, ITEM.FULL_FIRE)])
      .toEqual([3, 1, 1, 1, 3, 1, 1, 2, 1, 0]);
    expect([p.bombsCap, p.fire, p.speedLv, p.glove, p.fullFire, p.heart]).toEqual([1, 0, 1, false, true, true]);
  });
  it('casa: FREE_CELLS[rnd(113)] se livre', () => {
    const s = arena({ players: 0 });
    const r = makeRng(s.rng.seed); const i = rnd(r, 113);
    expect(placeDropped(s, ITEM.BOMB)).toBe(FREE_CELLS[i]);
    expect(s.grid[FREE_CELLS[i]]).toBe(itemCode(ITEM.BOMB));
  });
  it('ocupada: avança rnd(8) na lista (até 15 vezes)', () => {
    const s = arena({ players: 0 });
    const r = makeRng(s.rng.seed); const i = rnd(r, 113);
    let j = i;
    do { j = (j + rnd(r, 8)) % 113; } while (j === i);
    s.grid[FREE_CELLS[i]] = CODE.SOFT;
    const got = placeDropped(s, ITEM.FIRE);
    expect(got).toBe(FREE_CELLS[j]);
    expect(s.grid[got]).toBe(itemCode(ITEM.FIRE));
  });
  it('jogador de pé ocupa a casa; sem casa livre o item se perde', () => {
    const s = arena();
    for (const c of FREE_CELLS) s.grid[c] = CODE.SOFT;
    expect(placeDropped(s, ITEM.FIRE)).toBe(-1);
  });
});

describe('perdas por atordoamento ($C2:51C4)', () => {
  it('doença é a 1ª perda: sai como caveira voando', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x22; p.fire = 3;
    loseItems(s, p, 1, []);
    expect([p.disease, p.fire]).toEqual([0, 3]);
    expect(s.flyers.map(f => [f.kind, f.ref >= 0x21 && f.ref <= 0x2b])).toEqual([['item', true]]);
  });
  it('traje é a 2ª prioridade', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.costume = 3; p.fire = 3;
    loseItems(s, p, 1, []);
    expect([p.costume, p.fire]).toEqual([-1, 3]);
    expect(s.flyers[0].ref).toBe(ITEM.COSTUME);
  });
  it('só fogo: perde 1 por vez e cada um voa', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.fire = 3;
    loseItems(s, p, 2, []);
    expect(p.fire).toBe(1);
    expect(s.flyers.map(f => f.ref)).toEqual([ITEM.FIRE, ITEM.FIRE]);
  });
  it('perda de capacidade com todas as bombas no campo: sem "dívida" ($C2:5318 e devolução $C1:5588)', () => {
    const s = arena(); const p = put(s, 0, 8, 5);
    p.bombsCap = 3; p.bombsFree = 0;
    const bombs = [C(4, 1), C(6, 1), C(8, 1)].map(c => addBomb(s, 0, c));
    expect(STUN_LOSS[3](s, p, [])).toBe(ITEM.BOMB);
    expect([p.bombsCap, p.bombsFree]).toEqual([2, 0]);
    for (const b of bombs) refundBomb(s, b);
    expect([p.bombsCap, p.bombsFree]).toEqual([2, 2]);        // volta à capacidade nova, nunca acima
    expect(STUN_LOSS[3](s, p, [])).toBe(ITEM.BOMB);
    expect([p.bombsCap, p.bombsFree]).toEqual([1, 1]);
  });
  it('nada a perder: termina sem voadores', () => {
    const s = arena(); const p = put(s, 0, 8, 5);
    loseItems(s, p, 4, []);
    expect(s.flyers).toEqual([]);
    expect([p.speedLv, p.bombsCap]).toEqual([1, 1]);
  });
  it('$2B perde 1 item e nunca a própria doença', () => {
    const s = arena(); const p = put(s, 0, 8, 5); p.disease = 0x2b; p.kick = true;
    leakOne(s, p, []);
    expect([p.disease, p.kick]).toEqual([0x2b, false]);
    expect(s.flyers[0].ref).toBe(ITEM.KICK);
  });
});
