import { newRound, addBomb, place } from './helpers';
import { createAi, aiInputs, dangerMap, aiRoll, SAFE, AI_LEVELS } from '../../src/core/ai';
import { step, createRound } from '../../src/core/round';
import { idx } from '../../src/core/grid';
import { ITEM, CELL, defaultRules, type RoundState, type GameEvent } from '../../src/core/types';
import { hashState } from '../../src/core/hash';
import { INTRO_FRAMES } from '../../src/core/constants';

/** Roda `frames` ticks com a IA controlando os slots marcados em `cpu`; os demais ficam parados. */
function play(s: RoundState, cpu: boolean[], level: number, frames: number): GameEvent[] {
  const ai = createAi();
  const ev: GameEvent[] = [];
  for (let f = 0; f < frames && s.phase !== 'result'; f++) ev.push(...step(s, aiInputs(s, ai, cpu, level)));
  return ev;
}

describe('mapa de perigo', () => {
  it('marca o alcance da bomba com o tempo do pavio e deixa o resto seguro', () => {
    const s = newRound({ clear: true });
    addBomb(s, 7, 1, 50, 2);
    const d = dangerMap(s);
    expect(d[idx(7, 1)]).toBe(50);
    expect(d[idx(9, 1)]).toBe(50);
    expect(d[idx(7, 3)]).toBe(50);
    expect(d[idx(10, 1)]).toBe(SAFE);
    expect(d[idx(8, 2)]).toBe(SAFE);
  });
  it('chama atual = perigo 0', () => {
    const s = newRound({ clear: true });
    s.arena.flame[idx(4, 3)] = 10;
    expect(dangerMap(s)[idx(4, 3)]).toBe(0);
  });
  it('reação em cadeia antecipa a bomba atingida', () => {
    const s = newRound({ clear: true });
    addBomb(s, 5, 1, 10, 2);
    addBomb(s, 7, 1, 100, 2);
    const d = dangerMap(s);
    expect(d[idx(9, 1)]).toBe(10);
  });
  it('pilares e blocos param a chama como no jogo', () => {
    const s = newRound();                   // (3,1) é bloco destrutível
    addBomb(s, 2, 1, 40, 4);
    const d = dangerMap(s);
    expect(d[idx(3, 1)]).toBe(40);          // o bloco queima…
    expect(d[idx(4, 1)]).toBe(SAFE);        // …e segura o resto
    expect(d[idx(2, 2)]).toBe(SAFE);        // pilar
  });
  it('bomba hipotética entra no cálculo', () => {
    const s = newRound({ clear: true });
    const d = dangerMap(s, { gx: 5, gy: 5, range: 2, pierce: false });
    expect(d[idx(5, 7)]).toBeLessThan(SAFE);
    expect(d[idx(5, 8)]).toBe(SAFE);
  });
});

describe('comportamento', () => {
  it('pega um item próximo', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.arena.items[idx(3, 1)] = ITEM.FIRE;
    play(s, [true, false, false, false, false], 1, 120);
    expect(s.players[0].fire).toBe(1);
  });
  it('explode blocos e sobrevive às próprias bombas', () => {
    for (const level of [0, 1, 2]) {
      const s = newRound({ active: [true, true, false, false, false], seed: 3 });
      const soft0 = s.arena.cells.filter(c => c === CELL.SOFT).length;
      play(s, [true, false, false, false, false], level, 900);
      expect(s.players[0].alive, `nível ${level}`).toBe(true);
      expect(s.arena.cells.filter(c => c === CELL.SOFT).length, `nível ${level}`).toBeLessThan(soft0);
    }
  });
  it('foge de uma bomba colocada ao lado', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    place(s, 0, 5, 5);
    addBomb(s, 6, 5, 60, 3);
    play(s, [true, false, false, false, false], 2, 120);
    expect(s.players[0].alive).toBe(true);
  });
  it('partida só de CPUs termina, e nem sempre em empate', () => {
    let decided = 0;
    for (const seed of [1, 2, 3, 4]) {
      const s = createRound(1, { ...defaultRules(), timeIdx: 1 }, seed);  // 2:00
      for (let f = 0; f < INTRO_FRAMES; f++) step(s, [0, 0, 0, 0, 0]);
      play(s, [true, true, true, true, true], 1, 120 * 60 + 200);
      expect(s.phase, `seed ${seed}`).toBe('result');
      if (s.winners.length === 1) decided++;
    }
    expect(decided).toBeGreaterThan(0);
  });
  it('é determinística', () => {
    const run = () => {
      const s = createRound(1, { ...defaultRules(), timeIdx: 0 }, 9);
      for (let f = 0; f < INTRO_FRAMES; f++) step(s, [0, 0, 0, 0, 0]);
      play(s, [true, true, true, true, true], 2, 1500);
      return hashState(s);
    };
    expect(run()).toBe(run());
  });
});

describe('níveis', () => {
  it('Fraco reage mais devagar e erra mais que Forte', () => {
    expect(AI_LEVELS[0].react).toBeGreaterThan(AI_LEVELS[2].react);
    expect(AI_LEVELS[0].mistake).toBeGreaterThan(AI_LEVELS[2].mistake);
    expect(AI_LEVELS[0].hunt).toBe(false);
    expect(AI_LEVELS[2].hunt).toBe(true);
  });
  it('sorteio determinístico em 0..99', () => {
    expect(aiRoll(10, 2, 1)).toBe(aiRoll(10, 2, 1));
    const vals = new Set(Array.from({ length: 200 }, (_, f) => aiRoll(f, 0, 1)));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vals)).toBeLessThan(100);
    expect(vals.size).toBeGreaterThan(50);
  });
});
