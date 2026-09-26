import { defaultSettings } from '../../../src/app/settings';
import { configFromSetup, validateSetup, displayName } from '../../../src/game/config';

describe('da escolha dos menus para a partida', () => {
  it('configFromSetup: ativos, humanos, times, regras e nomes', () => {
    const s = defaultSettings();
    s.setup.mode = 'team';
    s.setup.slots = ['human', 'cpu', 'off', 'human', 'cpu'];
    s.setup.teams = [0, 1, 0, 1, 0];
    s.setup.rules.matches = 5;
    s.setup.stage = 4;
    const cfg = configFromSetup(s.setup, ['ANA', '', '', '', '']);
    expect(cfg.rules.active).toEqual([true, true, false, true, true]);
    expect(cfg.humans).toEqual([true, false, false, true, false]);
    expect([cfg.rules.mode, cfg.rules.matches, cfg.stage]).toEqual(['team', 5, 4]);
    expect(cfg.rules.teams).toEqual([0, 1, 0, 1, 0]);
    expect(cfg.names[0]).toBe('ANA');
  });
  it('validação da formação', () => {
    expect(validateSetup('ffa', ['human', 'off', 'off', 'off', 'off'], [0, 1, 0, 1, 0])).toBe('PRECISA DE 2 JOGADORES');
    expect(validateSetup('ffa', ['human', 'cpu', 'off', 'off', 'off'], [0, 1, 0, 1, 0])).toBeNull();
    expect(validateSetup('team', ['human', 'cpu', 'off', 'off', 'off'], [0, 0, 1, 1, 1])).toBe('CADA TIME PRECISA DE 1 JOGADOR');
    expect(validateSetup('team', ['human', 'cpu', 'off', 'off', 'off'], [0, 1, 1, 1, 1])).toBeNull();
  });
  it('nome de exibição', () => {
    expect(displayName(['ANA', '', ' ', '', ''], 0)).toBe('ANA');
    expect(displayName(['ANA', '', ' ', '', ''], 2)).toBe('P3');
  });
});
