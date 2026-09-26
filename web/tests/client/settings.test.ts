import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { DEFAULT_KEYMAPS, DEFAULT_PADMAP } from '../../src/input/input';

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};

describe('configurações v2', () => {
  it('padrão: versão 2, P1 Teclado 1, P2 Teclado 2, P3–P5 Controles 1–3, 4 mapas de gamepad, opções', () => {
    const s = defaultSettings();
    expect(s.version).toBe(2);
    expect(s.devices).toEqual(['kb0', 'kb1', 'gp0', 'gp1', 'gp2']);
    expect(s.padmaps).toHaveLength(4);
    expect(s.padmaps[3]).toEqual(DEFAULT_PADMAP);
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8 });
    expect(s.setup.rules).not.toHaveProperty('randomSpawns');
  });
  it('salva e carrega de volta', () => {
    const st = mem();
    const s = defaultSettings();
    s.options.musicVol = 3; s.padmaps[1].a = 7; s.keymaps[0].select = 'KeyZ';
    saveSettings(st, s);
    const back = loadSettings(st);
    expect(back.options.musicVol).toBe(3);
    expect(back.padmaps[1].a).toBe(7);
    expect(back.keymaps[0].select).toBe('KeyZ');
  });
  it('migra a v1: teclas novas com o padrão, randomSpawns vai para Opções e vale Não (original)', () => {
    const v1 = { version: 1, devices: ['gp0', 'kb0', 'kb1', 'none', 'gp1'], keymaps: [{ up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH', a: 'KeyZ', b: 'KeyX', y: 'KeyC', start: 'Space' }],
      setup: { mode: 'team', rules: { matches: 5, randomSpawns: true } } };
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify(v1));
    const s = loadSettings(st);
    expect(s.version).toBe(2);
    expect(s.devices).toEqual(['gp0', 'kb0', 'kb1', 'none', 'gp1']);
    expect(s.keymaps[0]).toMatchObject({ up: 'KeyT', a: 'KeyZ', x: 'KeyI', l: 'KeyQ', r: 'KeyE', select: 'KeyF' });
    expect(s.keymaps[1]).toEqual(DEFAULT_KEYMAPS[1]);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.rules.matches).toBe(5);
    expect(s.options.randomSpawns).toBe(false);
  });
  it('valores inválidos caem no padrão', () => {
    const s = normalizeSettings({ padmaps: [{ a: -1, b: 99, x: 'q' }], options: { musicVol: 11, sfxVol: 2.5, randomSpawns: 'sim' } });
    expect(s.padmaps[0]).toEqual(DEFAULT_PADMAP);
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8 });
  });
  it('JSON corrompido → padrão; falha ao gravar não derruba', () => {
    const st = mem();
    st.setItem(STORAGE_KEY, '{nope');
    expect(loadSettings(st)).toEqual(defaultSettings());
    const bad: StorageLike = { getItem: () => null, setItem: () => { throw new Error('cota'); } };
    expect(() => saveSettings(bad, defaultSettings())).not.toThrow();
  });
});
