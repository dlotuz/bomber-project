import { mkRound, placePx, run, BTN, cx, cy } from './helpers';
import { cellOf, cellAt, EGG_TYPES, lockAct, placeBombAt, explodeAt, isEnemy } from '../../src/core/mounts/core-api';
import { MOUNTS } from '../../src/core/mounts';
import { mountModule } from '../../src/core/mounts/module';
import type { GameEvent } from '../../src/core/types';
import { addBomb } from '../../src/core/bombs';
import { CHAIN_DELAY } from '../../src/core/constants';

describe('adaptador do core', () => {
  it('convenção de casas do plano 6: cellOf(col, lin) e cellAt(x, y)', () => {
    expect(cellOf(2, 1)).toBe(19);
    expect(cellAt(31 * 256, 47 * 256)).toBe(cellOf(2, 1));
    expect(cellAt(32 * 256, 47 * 256)).toBe(cellOf(2, 1));
    expect(cellAt(40 * 256, 47 * 256)).toBe(cellOf(3, 1));
    expect(cellAt(31 * 256, 56 * 256)).toBe(cellOf(2, 2));
  });
  it('EGG_TYPES = $C1:5DA4 & $0F', () => {
    expect([...EGG_TYPES]).toEqual([2, 3, 0xa, 0xc, 0xd, 0xe, 0xf, 2, 3, 0xa, 0xc, 0xd, 0xe, 0xf]);
  });
  it('lockAct: o jogador volta a agir no tick atual + n', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(2), cy(1));
    lockAct(s, p, 'mounting', 43);
    const x0 = p.x;
    for (let i = 1; i <= 42; i++) { run(s, 1, { 0: BTN.RIGHT }); expect(p.x, `tick +${i}`).toBe(x0); }
    run(s, 1, { 0: BTN.RIGHT });
    expect(p.x).toBeGreaterThan(x0);
  });
  it('placeBombAt: bomba do jogador na casa pedida, gasta 1 e emite bomb_placed', () => {
    const s = mkRound();
    const p = placePx(s, 0, cx(5), cy(1));
    p.bombsCap = 2; p.bombsFree = 2;
    const ev: GameEvent[] = [];
    expect(placeBombAt(s, p, cellOf(6, 1), ev)).toBe(true);
    expect(s.grid[cellOf(6, 1)]).toBe(0xc900);
    expect(p.bombsFree).toBe(1);
    expect(ev).toContainEqual({ type: 'bomb_placed', slot: 0, cell: cellOf(6, 1) });
    s.grid[cellOf(7, 1)] = 0xcc80;
    expect(placeBombAt(s, p, cellOf(7, 1), ev)).toBe(false);
    p.disease = 0x24;
    expect(placeBombAt(s, p, cellOf(8, 1), ev)).toBe(false);
  });
  it('explodeAt: cruz de alcance 2 com dono, sem mexer nas bombas do dono', () => {
    const s = mkRound();
    const p = s.players[0];
    const free = p.bombsFree;
    const ev: GameEvent[] = [];
    explodeAt(s, cellOf(6, 1), 2, 0, ev);
    ev.push(...run(s, 1));
    expect(s.grid[cellOf(8, 1)]).toBe(0x1000);
    expect(s.grid[cellOf(4, 1)]).toBe(0x1000);
    expect(s.grid[cellOf(9, 1)]).not.toBe(0x1000);
    expect(ev).toContainEqual({ type: 'explosion', cell: cellOf(6, 1), owner: 0 });
    expect(p.bombsFree).toBe(free);
  });
  it('explodeAt sobre uma bomba parada: a casa continua dela (grade C900) e ela entra na cadeia', () => {
    const s = mkRound();
    const b = addBomb(s, 1, cellOf(6, 1));
    explodeAt(s, cellOf(6, 1), 2, 0, []);
    expect([s.grid[cellOf(6, 1)], b.chainAt, s.grid[cellOf(7, 1)]]).toEqual([0xc900, s.tick + CHAIN_DELAY, 0x1000]);
  });
  it('isEnemy: outro jogador de pé é adversário; o próprio não; em times, o parceiro não', () => {
    const s = mkRound({ players: [0, 2] });
    expect(isEnemy(s, s.players[0], s.players[2])).toBe(true);
    expect(isEnemy(s, s.players[0], s.players[0])).toBe(false);
    s.rules.mode = 'team'; s.rules.teams = [0, 1, 0, 1, 0];
    expect(isEnemy(s, s.players[0], s.players[2])).toBe(false);
  });
  it('o registro do core aponta para o módulo do plano 9', () => {
    expect(MOUNTS.current).toBe(mountModule);
  });
});
