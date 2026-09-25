import { newRound, run, place, input, addBomb } from './helpers';
import { BTN, CELL, ITEM } from '../../src/core/types';
import { idx, cellX, cellY, centerX } from '../../src/core/grid';
import { ringCells } from '../../src/core/round';
import { PRESSURE_START_FRAMES, T, DEATH_FRAMES } from '../../src/core/constants';

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
  it('times: todos os times somem ao mesmo tempo → empate', () => {
    const s = newRound({ clear: true, mode: 'team', teams: [0, 1, 0, 1, 0], active: [true, true, false, false, false] });
    s.arena.flame[idx(1, 1)] = 5; s.arena.flame[idx(13, 11)] = 5;
    run(s, 78);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([]);
  });
  it('bomba carregada cai na casa do carregador quando ele morre por chama', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.glove = true;
    const b = addBomb(s, 1, 1, 999, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    expect(p.carrying).toBe(b.id);
    s.arena.flame[idx(1, 1)] = 5;
    run(s, 1, input(0, BTN.A)); // segura A para não soltar a bomba antes da chama matar
    expect(p.dying).toBeGreaterThan(0);
    expect(b.carried).toBe(false);
    expect(s.bombs.find(x => x.id === b.id)).toBeDefined();
    expect(idx(cellX(b.x), cellY(b.y))).toBe(idx(1, 1));
  });
});

describe('pressão', () => {
  it('anel externo começa em (1,1) no sentido horário', () => {
    const r = ringCells(0);
    expect(r[0]).toBe(idx(1, 1));
    expect(r[12]).toBe(idx(13, 1));
    expect(r).toHaveLength(44);
  });
  it('primeiro bloco cai 6 frames após 1:00 restante e mata quem está na casa no mesmo frame', () => {
    const s = newRound({ clear: true });
    s.timeLeft = PRESSURE_START_FRAMES + 1;
    run(s, 5);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.EMPTY);
    run(s, 1);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.players[0].dying).toBeGreaterThan(0);
  });
  it('pressão mata mesmo a 1 subpixel da borda da casa; não dá para escapar movendo no frame seguinte', () => {
    const s = newRound({ clear: true });
    place(s, 0, 1, 1);
    s.players[0].x = centerX(1) + T / 2 - 1; // ainda na casa (1,1), a 1 subpixel da borda
    s.timeLeft = PRESSURE_START_FRAMES + 1;
    run(s, 6);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.players[0].dying).toBeGreaterThan(0);
    run(s, 1, input(0, BTN.RIGHT));
    expect(s.players[0].dying).toBeGreaterThan(0);
    expect(s.players[0].alive).toBe(true);
  });
  it('preenche só os 2 anéis externos e para', () => {
    // só P2 e P5 jogam, ambos no miolo, para a rodada não acabar
    const s = newRound({ clear: true, timeIdx: 0, active: [false, true, false, false, true] });
    place(s, 1, 6, 5);
    s.timeLeft = s.pressure.startAt; // pula direto para o início da pressão (item 3: 0:30 com Tempo 1:00)
    run(s, 600);
    expect(s.phase).toBe('playing');
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(2, 3)]).toBe(CELL.HARD);
    expect(s.arena.cells[idx(3, 3)]).toBe(CELL.EMPTY);
  });
  it('início da pressão = metade do tempo total quando Tempo é 1:00 (0:30)', () => {
    const s = newRound({ timeIdx: 0 }); // 60*60 = 3600 frames totais
    expect(s.pressure.startAt).toBe(1800); // 0:30
  });
  it('início da pressão continua em 1:00 para Tempo 2:00 ou mais', () => {
    const s2 = newRound({ timeIdx: 1 }); // 2:00
    const s3 = newRound({ timeIdx: 2 }); // 3:00
    const s4 = newRound({ timeIdx: 3 }); // 5:00
    expect(s2.pressure.startAt).toBe(PRESSURE_START_FRAMES);
    expect(s3.pressure.startAt).toBe(PRESSURE_START_FRAMES);
    expect(s4.pressure.startAt).toBe(PRESSURE_START_FRAMES);
  });
  it('morte súbita: a pressão para de cair quando resta ≤1 jogador de pé', () => {
    const s = newRound({ clear: true, active: [true, false, false, false, true], suddenDeath: true });
    place(s, 0, 1, 1); // primeira casa da ordem de pressão
    place(s, 4, 7, 6); // fica a salvo, bem longe na ordem
    s.timeLeft = 1;
    run(s, 1); // 0:00: entra em prorrogação e já derruba o bloco de (1,1) no mesmo frame
    expect(s.pressure.overtime).toBe(true);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.players[0].dying).toBeGreaterThan(0);
    run(s, 100); // a pressão não pode continuar: só resta 1 jogador de pé
    expect(s.arena.cells[idx(2, 1)]).toBe(CELL.EMPTY);
    run(s, DEATH_FRAMES);
    expect(s.phase).toBe('result');
    expect(s.winners).toEqual([4]);
  });
  it('carregador esmagado: a bomba carregada some se a casa vira HARD pela pressão', () => {
    const s = newRound({ clear: true });
    const p = s.players[0];
    p.glove = true;
    const b = addBomb(s, 1, 1, 999, 2, 4, [0]);
    run(s, 1, input(0, BTN.A));
    expect(p.carrying).toBe(b.id);
    s.timeLeft = s.pressure.startAt + 1;
    run(s, 6, input(0, BTN.A)); // segura A para não soltar a bomba antes da queda do bloco
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.players[0].dying).toBeGreaterThan(0);
    expect(s.bombs.find(x => x.id === b.id)).toBeUndefined();
  });
  it('pressão remove bomba e item da casa', () => {
    const s = newRound({ clear: true, active: [false, true, false, false, true] });
    s.arena.items[idx(1, 1)] = ITEM.FIRE;
    addBomb(s, 1, 1, 999, 2, 4, []);
    s.timeLeft = s.pressure.startAt + 1;
    run(s, 6);
    expect(s.arena.cells[idx(1, 1)]).toBe(CELL.HARD);
    expect(s.arena.items[idx(1, 1)]).toBe(ITEM.NONE);
    expect(s.bombs).toHaveLength(0);
  });
});
