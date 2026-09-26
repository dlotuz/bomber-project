import { arena, put } from './kit';
import { step } from '../../src/core/step';
import { groupsStanding } from '../../src/core/round-end';
import type { GameEvent, RoundState } from '../../src/core/types';

/** Roda até o tick `until`, chamando `before(tick)` antes de cada passo (para simular fim de animação de morte). */
function drive(s: RoundState, until: number, before: (t: number) => void = () => {}): GameEvent[] {
  const ev: GameEvent[] = [];
  while (s.tick < until && s.phase !== 'over') { before(s.tick + 1); ev.push(...step(s, [0, 0, 0, 0, 0])); }
  return ev;
}
function dies(s: RoundState, slot: number, at: number): void {
  const p = s.players[slot]; p.state = 'dying'; p.hitT0 = at; s.lastHit = at;
}

describe('fim de rodada (t75, t86, t95, t97, t103)', () => {
  it('vitória decidida 2 ticks depois; 128 de comemoração depois das animações; victory_sfx em +31', () => {
    const s = arena(); put(s, 0, 4, 1); put(s, 1, 8, 5);
    dies(s, 1, 100);                                 // P2 atingido no tick 100
    const ev = drive(s, 400, t => { if (t === 165) s.players[1].state = 'out'; });
    expect(s.endAt).toBe(103);
    expect(s.celebT0).toBe(165);
    expect(ev.filter(e => e.type === 'victory_sfx')).toEqual([{ type: 'victory_sfx', slot: 0 }]);
    expect([s.phase, s.phaseT0]).toEqual(['over', 165 + 128]);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
    expect(ev.filter(e => e.type === 'round_over').length).toBe(1);
  });
  it('em `won` o vencedor fica em victory', () => {
    const s = arena(); put(s, 0, 4, 1); dies(s, 1, 100);
    drive(s, 103);
    expect([s.phase, s.players[0].act]).toEqual(['won', 'victory']);
  });
  it('todos mortos: empate no tick em que a última animação termina, sem os 128', () => {
    const s = arena(); dies(s, 0, 100); dies(s, 1, 110);
    drive(s, 400, t => { if (t === 165) s.players[0].state = 'out'; if (t === 175) s.players[1].state = 'out'; });
    expect([s.phase, s.phaseT0]).toEqual(['over', 175]);
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'dead' });
  });
  it('se o último de pé morre dentro dos 2 ticks, vira empate', () => {
    const s = arena(); put(s, 0, 4, 1); dies(s, 1, 100);
    drive(s, 400, t => { if (t === 102) dies(s, 0, 102); if (t === 165) s.players[1].state = 'out'; if (t === 167) s.players[0].state = 'out'; });
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'dead' });
  });
  it('TIME UP: 160 ticks congelado e empate', () => {
    const s = arena(); s.phase = 'timeUp'; s.phaseT0 = 100;
    drive(s, 400);
    expect([s.phase, s.phaseT0]).toEqual(['over', 260]);
    expect(s.result).toEqual({ kind: 'draw', winner: null, reason: 'time' });
  });
  it('times: a rodada acaba quando resta 1 time de pé; vencedor = menor slot de pé', () => {
    const s = arena({ players: 4, rules: { mode: 'team', teams: [1, 0, 0, 1, 0] } });
    for (const [slot, col] of [[0, 4], [1, 6], [2, 8], [3, 10]]) put(s, slot, col, 1);
    expect(groupsStanding(s)).toBe(2);
    s.players[1].state = 'out'; s.players[2].state = 'out';
    expect(groupsStanding(s)).toBe(1);
    drive(s, 400);
    expect(s.result).toEqual({ kind: 'win', winner: 0, reason: 'last' });
  });
});
