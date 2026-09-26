import { CODE, defaultRules } from '../../src/core/types';
import { emptyRound, itemCode, itemOfCode, isItemCode, isEggCode, setAct, setFace, createPlayer, isPillar } from '../../src/core/state';
import { rangeOf, STAGE_NAMES } from '../../src/core/constants';
import { cellOf } from '../../src/core/units';

describe('estado', () => {
  it('rodada vazia: paredes nas bordas, pilares em col ímpar × lin par, resto piso', () => {
    const s = emptyRound(1, defaultRules());
    expect(s.grid.length).toBe(221);
    expect(s.grid[cellOf(1, 5)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(15, 5)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(8, 0)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(8, 12)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(3, 2)]).toBe(CODE.HARD);
    expect(s.grid[cellOf(2, 2)]).toBe(CODE.FLOOR);
    expect(isPillar(13, 10) && !isPillar(14, 10)).toBe(true);
    expect(s.phase).toBe('intro');
    expect(s.clock).toEqual({ sec: 181, sub: 1 });
  });
  it('jogador inicial: nível 1, 1 bomba, fogo 0, sem invencibilidade, olhando para baixo', () => {
    const p = createPlayer(0, true);
    expect([p.speedLv, p.bombsCap, p.bombsFree, p.fire, p.inv, p.face, p.costume, p.carry]).toEqual([1, 1, 1, 0, 0, 4, -1, -1]);
    expect(p.act).toBe('idle');
  });
  it('códigos de item: 0940+id, caveira 0980+id, ovo 0970+t', () => {
    expect(itemCode(0x01)).toBe(0x0941);
    expect(itemCode(0x21)).toBe(0x09a1);
    expect(itemCode(0x3a)).toBe(0x097a);
    for (const id of [0x01, 0x0f, 0x12, 0x21, 0x2b, 0x30, 0x3f]) expect(itemOfCode(itemCode(id))).toBe(id);
    expect(isItemCode(0x0941) && isItemCode(0x09a1) && !isItemCode(CODE.BOMB) && !isItemCode(CODE.PAD)).toBe(true);
    expect(isEggCode(0x097c) && !isEggCode(0x0941)).toBe(true);
  });
  it('alcance: fogo 0..8 → 2..10, fogo 9 → 10, fogo 10 → 1', () => {
    expect([0, 1, 7, 8, 9, 10].map(rangeOf)).toEqual([2, 3, 9, 10, 10, 1]);
  });
  it('setAct/setFace reiniciam actT0 só quando mudam', () => {
    const s = emptyRound(1, defaultRules());
    const p = s.players[0];
    s.tick = 50; setAct(s, p, 'walk'); expect(p.actT0).toBe(50);
    s.tick = 60; setAct(s, p, 'walk'); expect(p.actT0).toBe(50);
    s.tick = 70; setFace(s, p, 2); expect(p.actT0).toBe(70);
    s.tick = 80; setAct(s, p, 'throw', 20); expect([p.actT0, p.actLeft]).toEqual([80, 20]);
  });
  it('nomes das fases em PT-BR', () => {
    expect(STAGE_NAMES).toEqual(['O Clássico', 'Rápido e Devagar', 'Bombardeio Orbital', 'Não Me Empurre', 'Escola de Choques',
      'Piso Traiçoeiro', 'Esconde-Explode', 'Caça-Níquel', 'Gangorra', 'Alfaiataria']);
  });
});
