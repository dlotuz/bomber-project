import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, sanitizeName, migrate, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { configFromSetup, validateSetup, displayName } from '../../src/game/config';

const memory = (init: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

describe('configurações salvas', () => {
  it('padrão: P1 Teclado 1, P2 Teclado 2, P3–P5 Controles 1–3; 2 humanos e 3 CPUs', () => {
    const s = defaultSettings();
    expect(s.devices).toEqual(['kb0', 'kb1', 'gp0', 'gp1', 'gp2']);
    expect(s.setup.slots).toEqual(['human', 'human', 'cpu', 'cpu', 'cpu']);
    expect(s.setup.rules.matches).toBe(3);
    expect(s.keymaps[0].a).toBe('KeyJ');
  });
  it('salva e carrega de volta', () => {
    const st = memory();
    const s = defaultSettings();
    s.names[0] = 'ANA';
    s.devices[4] = 'gp3';
    s.setup.stage = 7;
    saveSettings(st, s);
    expect(loadSettings(st)).toEqual(s);
  });
  it('JSON corrompido ou ausente → padrão', () => {
    expect(loadSettings(memory({ [STORAGE_KEY]: '{oops' }))).toEqual(defaultSettings());
    expect(loadSettings(memory())).toEqual(defaultSettings());
    expect(loadSettings(null)).toEqual(defaultSettings());
  });
  it('campos inválidos caem no padrão, campos válidos são mantidos', () => {
    const s = normalizeSettings({
      names: ['bia', 42], devices: ['gp3', 'xbox'], keymaps: [{ up: 'KeyI', down: '' }],
      setup: { mode: 'team', slots: ['cpu', 'robot'], rules: { matches: 9, timeIdx: 4, racer: 'yes' }, chars: [5, 99], stage: 0 },
    });
    expect(s.names).toEqual(['BIA', '', '', '', '']);
    expect(s.devices.slice(0, 2)).toEqual(['gp3', 'kb1']);
    expect([s.keymaps[0].up, s.keymaps[0].down]).toEqual(['KeyI', 'KeyS']);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.slots.slice(0, 2)).toEqual(['cpu', 'human']);
    expect([s.setup.rules.matches, s.setup.rules.timeIdx, s.setup.rules.racer]).toEqual([3, 4, false]);
    expect(s.setup.chars.slice(0, 2)).toEqual([5, 1]);
    expect(s.setup.stage).toBe(1);
  });
  it('falha ao gravar não derruba o jogo', () => {
    const st: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(() => saveSettings(st, defaultSettings())).not.toThrow();
  });
  it('migrate: version 1 e sem version carregam sem mudanças (gancho para futuras migrações)', () => {
    const withVersion = defaultSettings();
    withVersion.names[0] = 'ANA';
    expect(migrate(withVersion)).toEqual(withVersion);
    const { version: _version, ...noVersion } = withVersion as unknown as Record<string, unknown>;
    expect(migrate(noVersion)).toEqual(noVersion);

    const st1 = memory({ [STORAGE_KEY]: JSON.stringify(withVersion) });
    expect(loadSettings(st1)).toEqual(withVersion);
    const st2 = memory({ [STORAGE_KEY]: JSON.stringify(noVersion) });
    expect(loadSettings(st2)).toEqual(withVersion);
  });
  it('nomes: maiúsculas, caracteres permitidos, até 8', () => {
    expect(sanitizeName('joão da silva')).toBe('JOAO DA');
    expect(sanitizeName('  zé-1  ')).toBe('ZE-1');
    expect(sanitizeName('😀abc')).toBe('ABC');
    expect(sanitizeName(undefined)).toBe('');
  });
});

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
