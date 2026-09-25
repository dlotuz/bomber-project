import { newRound, run, input, place, addBomb } from './helpers';
import { BTN, DIR, CELL, ITEM } from '../../src/core/types';
import { cellX, idx } from '../../src/core/grid';

describe('habilidades', () => {
  it('chute: bomba desliza até o obstáculo (P3 em 13,1)', () => {
    const s = newRound({ clear: true });
    s.players[0].kick = true;
    const b = addBomb(s, 3, 1);
    run(s, 17, input(0, BTN.RIGHT));
    expect(b.slide).toBe(DIR.RIGHT);
    run(s, 100);
    expect(b.slide).toBe(DIR.NONE);
    expect(cellX(b.x)).toBe(12);
  });
  it('sem chute a bomba não se move', () => {
    const s = newRound({ clear: true });
    const b = addBomb(s, 3, 1);
    run(s, 30, input(0, BTN.RIGHT));
    expect(cellX(b.x)).toBe(3);
  });
  it('soco (Y): bomba voa 3 casas em 24 frames', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    run(s, 1, input(0, BTN.Y));
    expect(b.flight).not.toBeNull();
    run(s, 23);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(5);
  });
  it('voo quica quando a casa de pouso está ocupada (por outra bomba)', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    addBomb(s, 5, 1);
    run(s, 1, input(0, BTN.Y));
    run(s, 31);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(6);
  });
  it('voo quica quando a casa de pouso está ocupada por um jogador', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    place(s, 1, 5, 1);
    run(s, 1, input(0, BTN.Y));
    run(s, 31);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(6);
  });
  it('voo quica quando a casa de pouso está ocupada por um item', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    s.arena.items[idx(5, 1)] = ITEM.FIRE;
    run(s, 1, input(0, BTN.Y));
    run(s, 31);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(6);
  });
  it('voo: sai do campo por um lado e reaparece pelo lado oposto', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true;
    place(s, 0, 3, 1); s.players[0].facing = DIR.LEFT;
    const b = addBomb(s, 2, 1);
    run(s, 1, input(0, BTN.Y));
    expect(b.flight).not.toBeNull();
    run(s, 30);
    expect(b.flight).toBeNull();
    expect(cellX(b.x)).toBe(12);
  });
  it('voo: depois de 20 quiques a bomba some (linha inteira bloqueada)', () => {
    const s = newRound({ clear: true });
    s.players[0].punch = true; s.players[0].facing = DIR.RIGHT;
    const b = addBomb(s, 2, 1);
    for (let x = 1; x <= 13; x++) s.arena.cells[idx(x, 1)] = CELL.HARD; // toda a linha bloqueada
    run(s, 1, input(0, BTN.Y));
    expect(b.flight).not.toBeNull();
    run(s, 300);
    expect(s.bombs.find(x => x.id === b.id)).toBeUndefined();
  });
  it('luva: segurar A sobre a bomba levanta; soltar arremessa 3 casas', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.glove = true; p.facing = DIR.RIGHT;
    const b = addBomb(s, 1, 1, 999, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    expect(b.carried).toBe(true);
    expect(p.carrying).toBe(b.id);
    run(s, 5, input(0, BTN.A));
    run(s, 1);
    expect(b.flight).not.toBeNull();
    run(s, 23);
    expect(cellX(b.x)).toBe(4);
    expect(p.carrying).toBe(-1);
  });
  it('bomba carregada não conta o pavio', () => {
    const s = newRound({ clear: true });
    s.players[0].glove = true;
    const b = addBomb(s, 1, 1, 10, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    run(s, 30, input(0, BTN.A));
    expect(b.fuse).toBe(10);
  });
  it('perfurante (P) destrói todos os soft blocks no alcance', () => {
    const s = newRound();                        // linha 1: (3..6,1) soft
    s.players[0].pierce = true; s.players[0].fire = 2;
    run(s, 1, input(0, BTN.A));
    run(s, 127);
    for (const x of [3, 4, 5]) expect(s.arena.burning[idx(x, 1)]).toBeGreaterThan(0);
    expect(s.arena.cells[idx(6, 1)]).toBe(CELL.SOFT);
    expect(s.arena.burning[idx(6, 1)]).toBe(0);
  });
});
