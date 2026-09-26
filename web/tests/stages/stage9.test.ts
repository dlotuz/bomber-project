// Carrega o registro antes: sem isso o ciclo stage9 → kit → núcleo → stages/index deixa STAGES[9] undefined.
import '../../src/core/stages';
import { stage9, st9, upEnd, sawWords, JUMP_DY } from '../../src/core/stages/stage9';
import { stage9Ai } from '../../src/core/ai/stages/stage9';
import { BTN, CODE } from '../../src/core/types';
import { cellOf, px } from '../../src/core/units';
import { playerCell } from '../../src/core/state';
import { romLayers, fallbackLayers } from '../../src/render/battle-layers';
import '../../src/render/rom/stages/stage9';
import '../../src/render/fallback/stages/stage9';
import { stageArena, put, run, stageEvents, fakeBuilder, fakeAssets, fakeCtx } from './kit';

describe('arena 9: gangorras [D15]', () => {
  it('4 gangorras de 3 casas; esquerda estado 0 (ponta de cima B), direita estado 1 (ponta de cima A)', () => {
    const s = stageArena(9);
    const w = st9(s).saws;
    expect(w.map(x => [x.a, x.b, x.state])).toEqual([
      [cellOf(4, 3), cellOf(6, 3), 0], [cellOf(4, 9), cellOf(6, 9), 0], [cellOf(10, 3), cellOf(12, 3), 1], [cellOf(10, 9), cellOf(12, 9), 1]]);
    expect(w.map(upEnd)).toEqual([cellOf(6, 3), cellOf(6, 9), cellOf(10, 3), cellOf(10, 9)]);
    for (const c of [cellOf(4, 3), cellOf(5, 3), cellOf(6, 3)]) expect(s.grid[c]).toBe(CODE.FLOOR);
  });
  it('palavras: estado 0 08EC 48E2 48E0; estado 1 08E0 08E2 08E4; transição 08E6 08E8 08EA por 2 ticks', () => {
    const w = { a: 0, b: 2, state: 0 as 0 | 1, transUntil: 0 };
    expect(sawWords(w, 10)).toEqual([0x08ec, 0x48e2, 0x48e0]);
    w.state = 1;
    expect(sawWords(w, 10)).toEqual([0x08e0, 0x08e2, 0x08e4]);
    w.transUntil = 12;
    expect(sawWords(w, 10)).toEqual([0x08e6, 0x08e8, 0x08ea]);
    expect(sawWords(w, 11)).toEqual([0x08e6, 0x08e8, 0x08ea]);
    expect(sawWords(w, 12)).toEqual([0x08e0, 0x08e2, 0x08e4]);
  });
  it('entrar na ponta de cima lança quem está na outra: pulo de 14 ticks com o perfil medido; depois vai e volta', () => {
    const s = stageArena(9);
    const p1 = put(s, 1, 4, 3);                                   // P2 na ponta A
    const p0 = put(s, 0, 6, 4);                                   // P1 sobe para a ponta B (de cima no estado 0)
    const launches: [number, number][] = [];
    const ys: number[] = [];
    let t0 = -1;
    for (let i = 0; i < 80; i++) {
      const ev = run(s, 1, st => (playerCell(st.players[0]) === cellOf(6, 3) ? [0, 0, 0, 0, 0] : [BTN.UP, 0, 0, 0, 0]));
      for (const e of stageEvents(ev, 'a9_launch')) { launches.push([s.tick, e.slot!]); if (t0 < 0) t0 = s.tick; }
      if (t0 >= 0 && s.tick > t0 && s.tick <= t0 + 15) ys.push(px(p1.y) - 79);   // centro da lin 3 = 79
    }
    expect(launches.slice(0, 3).map(([, slot]) => slot)).toEqual([1, 0, 1]);
    expect(launches[1][0] - launches[0][0]).toBe(15);
    expect(launches[2][0] - launches[1][0]).toBe(15);
    expect(ys).toEqual([...JUMP_DY, 0]);
    expect(JUMP_DY).toEqual([0, 0, 0, -6, -10, -13, -15, -16, -16, -16, -15, -13, -10, -6]);
    expect(p0.state).toBe('alive');
  });
  it('entrar na ponta de baixo não vira', () => {
    const s = stageArena(9);
    put(s, 0, 4, 4);
    const ev = run(s, 30, st => (playerCell(st.players[0]) === cellOf(4, 3) ? [0, 0, 0, 0, 0] : [BTN.UP, 0, 0, 0, 0]));
    expect(stageEvents(ev, 'a9_launch').length).toBe(0);
    expect(st9(s).saws[0].state).toBe(0);
  });
  it('← no início do pulo: voa 8 px/tick (ticks 3..14), dá a volta (−25 → 247), quica no muro até a col 14 (medido b19)', () => {
    const s = stageArena(9);
    const p1 = put(s, 1, 4, 3);
    put(s, 0, 6, 4);
    const xs: number[] = [];
    let t0 = -1, landed = -1;
    // P1 chega na ponta B no tick 108; P2 segura ← nos ticks 106 e 107 (anda 2 px, continua na ponta A) e solta.
    const input = (st: typeof s) => [playerCell(st.players[0]) === cellOf(6, 3) ? 0 : BTN.UP, st.tick === 105 || st.tick === 106 ? BTN.LEFT : 0, 0, 0, 0];
    for (let i = 0; i < 40; i++) {
      const ev = run(s, 1, input);
      if (t0 < 0 && stageEvents(ev, 'a9_launch').some(e => e.slot === 1)) t0 = s.tick;
      if (t0 >= 0 && s.tick > t0 && s.tick <= t0 + 23) xs.push(px(p1.x));
      if (t0 >= 0 && landed < 0 && s.tick > t0 && p1.act !== 'launched') landed = s.tick;
    }
    expect(t0).toBe(108);
    expect(xs).toEqual([63, 63, 63, 55, 47, 39, 31, 23, 15, 7, -1, -9, -17, 247, 239, 236, 233, 230, 227, 225, 223, 223, 223]);
    expect(landed).toBe(t0 + 23);
    expect(playerCell(p1)).toBe(cellOf(14, 3));
  });
  it('IA: evita as pontas de uma gangorra com adversário em cima', () => {
    const s = stageArena(9);
    put(s, 1, 5, 3);
    expect([...stage9Ai.avoid!(s, 0)].sort((a, b) => a - b)).toEqual([cellOf(4, 3), cellOf(6, 3)]);
    expect([...stage9Ai.avoid!(s, 1)]).toEqual([]);
  });
  it('ROM: palavras das 12 casas e paleta 5 animada (6 quadros de 14 ticks a partir de $D7:DDDC)', () => {
    const s = stageArena(9);
    const { b, calls } = fakeBuilder();
    const layer = romLayers.find(l => l.id === 'stage9')!;
    s.tick = 0;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.bg2.size).toBe(12);
    expect(calls.bg2.get('4,3')).toBe(0x08ec);
    expect(calls.bg2.get('12,9')).toBe(0x08e4);
    expect(calls.cgram.get(80)).toBe(0xd7dddc & 0x7fff);
    s.tick = 14;
    layer.draw(s, b, fakeAssets(), 0);
    expect(calls.cgram.get(80)).toBe((0xd7dddc + 32) & 0x7fff);
  });
  it('fallback: 4 pranchas', () => {
    const c = fakeCtx();
    fallbackLayers.find(l => l.id === 'stage9')!.draw(stageArena(9), c.ctx, {} as never, 0);
    expect(c.log.filter(x => x === 'stroke').length).toBe(4);
  });
});
