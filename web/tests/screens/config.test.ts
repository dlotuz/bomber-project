import { configFromSetup, parseConfig, canStart, activeCount } from '../../src/game/config';

const setup = {
  mode: 'team' as const, slots: ['human', 'cpu', 'off', 'human', 'cpu'] as const, teams: [0, 1, 0, 1, 0],
  rules: { cpuLevel: 2 as const, matches: 4, timeIdx: 4, suddenDeath: true, badBomber: true, racer: false }, chars: [5, 4, 3, 2, 1], stage: 7,
};

describe('configuração da partida', () => {
  it('configFromSetup: regras, ativos, humanos, equipes, personagens, dispositivos e spawns aleatórios', () => {
    const c = configFromSetup(setup, true, ['kb', 'gp0', 'none', 'kb', 'gp1']);
    expect(c.rules).toMatchObject({ cpuLevel: 2, matches: 4, timeIdx: 4, suddenDeath: true, badBomber: true, racer: false,
      randomSpawns: true, mode: 'team', teams: [0, 1, 0, 1, 0], active: [true, true, false, true, true] });
    expect(c.humans).toEqual([true, false, false, true, false]);
    expect([c.stage, c.chars, c.devices, c.seed]).toEqual([7, [5, 4, 3, 2, 1], ['kb', 'gp0', 'none', 'kb', 'gp1'], null]);
  });
  it('parseConfig (?quick): padrões, spawns aleatórios desligados (original)', () => {
    const c = parseConfig('');
    expect([c.stage, c.rules.matches, c.rules.timeIdx, c.rules.randomSpawns, c.rules.mode]).toEqual([1, 3, 2, false, 'ffa']);
    expect(c.rules.active).toEqual([true, true, true, true, true]);
    expect(parseConfig('?spawns=1&seed=42&players=3&humans=1').rules.randomSpawns).toBe(true);
    const d = parseConfig('?seed=42&players=3&humans=1');
    expect([d.seed, d.rules.active, d.humans]).toEqual([42, [true, true, true, false, false], [true, false, false, false, false]]);
  });
  it('canStart exige 2 ativos (A15)', () => {
    expect(activeCount(['human', 'off', 'off', 'off', 'cpu'])).toBe(2);
    expect(canStart(['human', 'off', 'off', 'off', 'off'])).toBe(false);
    expect(canStart(['off', 'cpu', 'cpu', 'off', 'off'])).toBe(true);
  });
});
