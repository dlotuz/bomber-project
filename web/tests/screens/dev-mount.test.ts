import { createMatchSession, beginRound, resetCarry } from '../../src/game/match-session';
import { parseConfig } from '../../src/game/config';

beforeEach(() => resetCarry());

describe('?montaria (teste): humanos começam montados', () => {
  it('?montaria=9 → P1 humano montado no tipo 9, CPUs a pé', () => {
    const r = beginRound(createMatchSession(parseConfig('?quick&humans=1&montaria=9')));
    expect(r.players[0].mount).toMatchObject({ type: 9, phase: 'riding', slot: 1 });
    expect(r.players.slice(1).every(p => p.mount === null)).toBe(true);
  });

  it('no máximo 2 montados (vagas de sprite); sem o parâmetro ou fora de 1–F, ninguém', () => {
    const r = beginRound(createMatchSession(parseConfig('?quick&humans=5&montaria=a')));
    expect(r.players.filter(p => p.mount).length).toBe(2);
    expect(parseConfig('?quick').devMount).toBeUndefined();
    expect(parseConfig('?quick&montaria=0').devMount).toBeUndefined();
  });
});
