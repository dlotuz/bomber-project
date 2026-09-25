import { newRound, addBomb, place } from './helpers';
import { createAi, aiInputs, dangerMap, aiRoll, SAFE, AI_LEVELS } from '../../src/core/ai';
import { step, createRound } from '../../src/core/round';
import { idx } from '../../src/core/grid';
import { ITEM, CELL, DIR, DISEASE, defaultRules, type RoundState, type GameEvent } from '../../src/core/types';
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
  it('braço da explosão para em outra bomba', () => {
    const s = newRound({ clear: true });
    addBomb(s, 2, 1, 40, 5);
    addBomb(s, 4, 1, 200, 1);
    const d = dangerMap(s);
    expect(d[idx(5, 1)]).toBe(40);  // B explodes with A (chain reaction)
    expect(d[idx(6, 1)]).toBe(SAFE);
    expect(d[idx(7, 1)]).toBe(SAFE);
  });
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
  it('bombas voando são previstas na casa de pouso', () => {
    const s = newRound({ clear: true });
    addBomb(s, 5, 5, 50, 2);
    const b = s.bombs[0];
    b.flight = { dx: 1, dy: 0, cellsLeft: 3, progress: 0, bounces: 0 };
    const d = dangerMap(s);
    expect(d[idx(8, 5)]).toBe(74);
    expect(d[idx(10, 5)]).toBe(74);
    expect(d[idx(5, 5)]).toBe(SAFE);
  });
  it('bomba chutada é prevista na casa onde para, com o pavio que continua correndo', () => {
    const s = newRound({ clear: true });
    s.arena.cells[idx(6, 5)] = CELL.SOFT;       // barra o deslize: para no centro de (5,5)
    const b = addBomb(s, 3, 5, 50, 1);
    b.slide = DIR.RIGHT;
    const d = dangerMap(s);
    expect(d[idx(5, 5)]).toBe(50);
    expect(d[idx(5, 4)]).toBe(50);
    expect(d[idx(6, 5)]).toBe(50);                // o bloco queima
    expect(d[idx(4, 5)]).toBe(50);                // trajeto (e braço)
    expect(d[idx(3, 4)]).toBe(SAFE);              // de onde saiu não explode mais
    expect(d[idx(3, 6)]).toBe(SAFE);
  });
  it('bomba chutada que não para a tempo explode no meio do caminho (igual ao core)', () => {
    const s = newRound({ clear: true });
    const b = addBomb(s, 3, 5, 50, 1);
    b.slide = DIR.RIGHT;
    const d = dangerMap(s);
    // 50 frames × 16 sub = 6,25 casas: explode em (9,5)
    expect(d[idx(9, 4)]).toBe(50);
    expect(d[idx(9, 6)]).toBe(50);
    expect(d[idx(10, 5)]).toBe(50);
    expect(d[idx(11, 5)]).toBe(SAFE);
    expect(d[idx(3, 4)]).toBe(SAFE);
    // confere com o core
    let at = -1;
    for (let f = 1; f <= 60 && at < 0; f++) {
      for (const e of step(s, [0, 0, 0, 0, 0])) if (e.type === 'explosion') { at = f; expect([e.gx, e.gy]).toEqual([9, 5]); }
    }
    expect(at).toBe(50);
  });
  it('bomba chutada que entra numa chama explode na hora', () => {
    const s = newRound({ clear: true });
    s.arena.flame[idx(5, 5)] = 30;
    const b = addBomb(s, 3, 5, 100, 1);
    b.slide = DIR.RIGHT;
    const d = dangerMap(s);
    // entra em (5,5) no 12º tick (192 sub = 1,5 casa), com a chama ainda acesa; o core confirma
    let at = -1, where: number[] = [];
    const probe = structuredClone(s);
    for (let f = 1; f <= 40 && at < 0; f++) {
      for (const e of step(probe, [0, 0, 0, 0, 0])) if (e.type === 'explosion') { at = f; where = [e.gx, e.gy]; }
    }
    expect([at, ...where]).toEqual([12, 5, 5]);
    expect(d[idx(5, 6)]).toBe(12);
    expect(d[idx(6, 5)]).toBe(12);
    expect(d[idx(7, 5)]).toBe(SAFE);
  });
  it('pressão: todas as casas que ainda vão cair, com o tick exato de cada uma (conferido no core)', () => {
    const s = newRound({ clear: true, timeIdx: 0 });   // 1:00 → pressão começa com 30 s restantes
    const total = s.timeLeft;
    for (let f = 0; f < total - s.pressure.startAt - 200; f++) step(s, [0, 0, 0, 0, 0]);
    const d = dangerMap(s);
    const probe = structuredClone(s);
    const drop = new Map<number, number>();
    for (let f = 1; f <= 200 + 6 * 90 && drop.size < 20; f++) {
      for (const e of step(probe, [0, 0, 0, 0, 0])) if (e.type === 'pressure_block') drop.set(idx(e.gx, e.gy), f);
    }
    expect(drop.size).toBe(20);
    for (const [i, f] of drop) expect(d[i], `casa ${i}`).toBe(f);
    expect(d[idx(7, 6)]).toBe(SAFE);                 // miolo não cai
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
  it('fuga passa por uma casa cuja chama apaga antes de o CPU chegar', () => {
    // (1,1) com bomba; (1,2) bloqueada; a única saída é (2,1), em chamas por mais 20 frames
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.arena.cells[idx(1, 2)] = CELL.SOFT;
    s.arena.flame[idx(2, 1)] = 20;
    addBomb(s, 1, 1, 72, 2);
    play(s, [true, false, false, false, false], 2, 200);
    expect(s.players[0].alive).toBe(true);
  });
  it('tempo de chegada conta o quanto o CPU já andou rumo à próxima casa', () => {
    // quase na divisa de (5,5) para (6,5); bomba em (4,5) alcance 3; só dá tempo de fugir por (6,5)→(7,5)→(7,4)
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.arena.cells[idx(5, 4)] = CELL.SOFT;
    s.arena.cells[idx(5, 6)] = CELL.SOFT;
    place(s, 0, 5, 5);
    s.players[0].x += 60;
    addBomb(s, 4, 5, 50, 3);
    play(s, [true, false, false, false, false], 2, 150);
    expect(s.players[0].alive).toBe(true);
  });
  it('sem refúgio alcançável: vai para a casa que explode por último e espera as chamas passarem', () => {
    // em (3,1): (3,2) bloqueada; à esquerda a bomba A (30 frames) pega (1..3,1); à direita a bomba B (100 frames)
    // fecha o corredor em (5,1). Ir para (4,1) (explode só em 100) e voltar depois que as chamas de A apagam.
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.arena.cells[idx(3, 2)] = CELL.SOFT;
    s.arena.cells[idx(1, 2)] = CELL.SOFT;
    place(s, 0, 3, 1);
    addBomb(s, 1, 1, 30, 2);
    addBomb(s, 5, 1, 100, 1);
    play(s, [true, false, false, false, false], 2, 200);
    expect(s.players[0].alive).toBe(true);
  });
  it('Normal e Forte preferem refúgio com duas saídas a um beco igualmente perto', () => {
    // em (5,5) sobre a própria bomba (alcance 1), laterais fechadas: refúgios a 2 casas são (5,3) e (5,7).
    // (5,3) é beco (vizinhos fechados); (5,7) tem três saídas. O índice menor seria (5,3).
    for (const level of [1, 2]) {
      const s = newRound({ clear: true, active: [true, true, false, false, false] });
      for (const [x, y] of [[4, 3], [6, 3], [5, 2], [4, 5], [6, 5]]) s.arena.cells[idx(x, y)] = CELL.SOFT;
      place(s, 0, 5, 5);
      addBomb(s, 5, 5, 128, 1, 0, [0]);
      play(s, [true, false, false, false, false], level, 40);
      expect(Math.floor(s.players[0].y / 128) - 2, `nível ${level}`).toBeGreaterThan(5);   // desceu rumo a (5,7)
    }
  });
  it('não solta bomba na casa de outro jogador com Luva (ele pegaria e arremessaria)', () => {
    const s = newRound({ active: [true, true, false, false, false], seed: 3 });
    place(s, 0, 1, 1);
    place(s, 1, 1, 1);
    s.players[1].glove = true;
    const ev = play(s, [true, true, false, false, false], 1, 300);
    expect(ev.filter(e => e.type === 'bomb_thrown')).toEqual([]);
    expect(ev.some(e => e.type === 'bomb_placed')).toBe(true);
  });
  it('bomba nova/chutada antecipa a próxima decisão conforme o nível', () => {
    for (const level of [1, 2]) {
      const s = newRound({ clear: true, active: [true, true, false, false, false] });
      place(s, 0, 9, 5);
      place(s, 1, 13, 11);
      const ai = createAi();
      const cpu = [true, false, false, false, false];
      step(s, aiInputs(s, ai, cpu, level));
      ai.brains[0].nextThink = s.frame + 50;
      addBomb(s, 3, 5, 100, 2).slide = DIR.RIGHT;
      step(s, aiInputs(s, ai, cpu, level));
      expect(ai.brains[0].nextThink - s.frame, `nível ${level}`).toBeLessThanOrEqual(AI_LEVELS[level].react);
    }
  });
  it('diarreia: CPU re-planeja a cada frame e sobrevive', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    place(s, 0, 5, 5);
    place(s, 1, 12, 11);
    s.players[0].disease = DISEASE.DIARRHEA;
    s.players[0].diseaseTimer = 600;
    play(s, [true, false, false, false, false], 1, 300);
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

/** Roda a IA num slot e mede bombas colocadas e a maior sequência de frames com a posição alternando A,B,A,B. */
function watch(s: RoundState, slot: number, level: number, frames: number): { bombs: number; osc: number } {
  const ai = createAi();
  const cpu = [0, 1, 2, 3, 4].map(i => i === slot);
  let bombs = 0, osc = 0, run = 0;
  const p = s.players[slot];
  let a = -1, b = -1;
  for (let f = 0; f < frames && s.phase !== 'result'; f++) {
    for (const e of step(s, aiInputs(s, ai, cpu, level))) if (e.type === 'bomb_placed' && e.slot === slot) bombs++;
    const cur = p.x * 4096 + p.y;
    run = cur === a && cur !== b ? run + 1 : 0;
    osc = Math.max(osc, run);
    a = b; b = cur;
  }
  return { bombs, osc };
}

describe('velocidade alta', () => {
  // speedSub 12 e 15 não dividem 128: o jogador passa do centro da casa e a IA não pode exigir centro exato
  for (const [name, prep] of [
    ['velocidade 5 (12 sub/frame)', (q: RoundState) => { q.players[0].speed = 5; }],
    ['velocidade 4 (11 sub/frame)', (q: RoundState) => { q.players[0].speed = 4; }],
    ['doença FAST (15 sub/frame)', (q: RoundState) => { q.players[0].disease = DISEASE.FAST; q.players[0].diseaseTimer = 5000; }],
  ] as const) {
    it(`${name}: coloca bombas e não fica indo e voltando`, () => {
      const s = newRound({ active: [true, true, false, false, false], seed: 3 });
      place(s, 1, 13, 11);
      prep(s);
      const r = watch(s, 0, 1, 1200);
      expect(r.bombs).toBeGreaterThanOrEqual(3);
      expect(r.osc).toBeLessThanOrEqual(60);
      expect(s.players[0].alive).toBe(true);
    });
  }
  it('arena limpa, oponente parado longe: vai até ele e bomba', () => {
    const s = newRound({ clear: true, active: [true, true, false, false, false] });
    s.players[0].speed = 5;
    place(s, 1, 13, 11);
    const r = watch(s, 0, 1, 1200);
    expect(r.bombs).toBeGreaterThanOrEqual(1);
    expect(r.osc).toBeLessThanOrEqual(60);
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
