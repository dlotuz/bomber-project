import { newRound, run, place } from './helpers';
import { CELL } from '../../src/core/types';
import { idx } from '../../src/core/grid';
import { ringCells } from '../../src/core/round';
import { PRESSURE_START_FRAMES } from '../../src/core/constants';

const two = { active: [true, true, false, false, false] };

describe('fim de rodada', () => {
  it('um sobrevivente vence', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5;
    run(s, 78);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([0]);
  });
  it('espera a animação de morte terminar', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5;
    run(s, 77);
    expect(s.phase).toBe('playing');
  });
  it('todos morrem → empate', () => {
    const s = newRound({ clear: true, ...two });
    s.arena.flame[idx(13, 11)] = 5; s.arena.flame[idx(1, 1)] = 5;
    const ev = run(s, 78);
    expect(s.winners).toEqual([]);
    expect(ev.some(e => e.type === 'round_end')).toBe(true);
  });
  it('tempo esgotado sem morte súbita → empate', () => {
    const s = newRound({ clear: true, ...two });
    s.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([]);
  });
  it('tempo esgotado com morte súbita → prorrogação', () => {
    const s = newRound({ clear: true, ...two, suddenDeath: true });
    s.timeLeft = 1;
    run(s, 1);
    expect(s.phase).toBe('playing');
    expect(s.pressure.overtime).toBe(true);
  });
  it('tempo infinito não conta e não tem pressão', () => {
    const s = newRound({ clear: true, timeIdx: 4 });
    run(s, 100);
    expect(s.timeLeft).toBe(-1);
    expect(s.pressure.next).toBe(0);
  });
  it('times: rodada acaba quando só resta um time; todo o time ganha', () => {
    const s = newRound({ clear: true, mode: 'team', teams: [0, 1, 0, 1, 0] });
    s.arena.flame[idx(13, 11)] = 5; s.arena.flame[idx(1, 11)] = 5;
    run(s, 78);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([0, 2, 4]);
  });
});

describe('pressão', () => {
  it('anel externo começa em (1,1) no sentido horário', () => {
    const r = ringCells(0);
    expect(r[0]).toBe(idx(1, 1));
    expect(r[12]).toBe(idx(13, 1));
    expect(r).toHaveLength(44);
  });
  it('primeiro bloco cai 6 frames após 1:00 restante e mata quem está na casa', () => {
    const s = newRound({ clear: true });
    s.timeLeft = PRESSURE_START_FRAMES + 1;
    run(s, 5);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.EMPTY);
    run(s, 1);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    run(s, 1);
    expect(s.players[0].dying).toBeGreaterThan(0);
  });
  it('preenche só os 2 anéis externos e para', () => {
    // só P2 e P5 jogam, ambos no miolo, para a rodada não acabar
    const s = newRound({ clear: true, timeIdx: 0, active: [false, true, false, false, true] });
    place(s, 1, 6, 5);
    run(s, 2000);
    expect(s.phase).toBe('playing');
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(2, 3)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(3, 3)]).toBe(CELL.EMPTY);
  });
});
