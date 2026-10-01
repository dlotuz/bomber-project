import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, migrate, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { DEFAULT_KEYMAPS, DEFAULT_PADMAP } from '../../src/input/input';

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};

describe('configurações v3', () => {
  it('padrão: versão 3, P1 e P2 no teclado, P3–P5 Controles 1–3, teclas e botões por jogador, opções', () => {
    const s = defaultSettings();
    expect(s.version).toBe(3);
    expect(s.devices).toEqual(['kb', 'kb', 'gp0', 'gp1', 'gp2']);
    expect([s.keymaps.length, s.padmaps.length]).toEqual([5, 5]);
    expect(s.padmaps[4]).toEqual(DEFAULT_PADMAP);
    expect(s.keymaps[2].a).toBe('');
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8, gloveEscape: 10, throwStun: false, sleepSec: 3, fx: true, allMounts: false });
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
    expect(s.version).toBe(3);
    expect(s.devices).toEqual(['gp0', 'kb', 'kb', 'none', 'gp1']);
    // Cada jogador herda o mapa do teclado que usava (P2 = Teclado 1, P3 = Teclado 2).
    expect(s.keymaps[1]).toMatchObject({ up: 'KeyT', a: 'KeyZ', x: 'KeyI', l: 'KeyQ', r: 'KeyE', select: 'KeyF' });
    expect(s.keymaps[2]).toEqual(DEFAULT_KEYMAPS[1]);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.rules.matches).toBe(5);
    expect(s.options.randomSpawns).toBe(false);
  });
  it('migra a v2: mapas por dispositivo viram por jogador', () => {
    const v2 = { version: 2, devices: ['gp1', 'kb1', 'kb0', 'none', 'none'],
      keymaps: [{ ...DEFAULT_KEYMAPS[0], a: 'KeyZ' }, { ...DEFAULT_KEYMAPS[1], a: 'KeyX' }], padmaps: [DEFAULT_PADMAP, { ...DEFAULT_PADMAP, a: 7, x: 1 }] };
    const s = normalizeSettings(migrate(v2));
    expect(s.devices).toEqual(['gp1', 'kb', 'kb', 'none', 'none']);
    expect([s.padmaps[0].a, s.keymaps[1].a, s.keymaps[2].a]).toEqual([7, 'KeyX', 'KeyZ']);
  });
  it('valores inválidos caem no padrão', () => {
    const s = normalizeSettings({ padmaps: [{ a: -1, b: 99, x: 'q' }], options: { musicVol: 11, sfxVol: 2.5, randomSpawns: 'sim', gloveEscape: 99 } });
    expect(s.padmaps[0]).toEqual(DEFAULT_PADMAP);
    expect(s.options).toEqual({ randomSpawns: false, musicVol: 8, sfxVol: 8, gloveEscape: 10, throwStun: false, sleepSec: 3, fx: true, allMounts: false });
  });
  it('efeitos visuais: padrão ligado, campo ausente em configuração antiga vira true, lixo vira padrão', () => {
    expect(defaultSettings().options.fx).toBe(true);
    expect(normalizeSettings({ options: { musicVol: 3 } }).options.fx).toBe(true);
    expect(normalizeSettings({ options: { fx: false } }).options.fx).toBe(false);
    expect(normalizeSettings({ options: { fx: 'não' } }).options.fx).toBe(true);
    expect(normalizeSettings({ options: { allMounts: true } }).options.allMounts).toBe(true);
    expect(normalizeSettings({ options: { allMounts: 1 } }).options.allMounts).toBe(false);
  });
  it('JSON corrompido → padrão; falha ao gravar não derruba', () => {
    const st = mem();
    st.setItem(STORAGE_KEY, '{nope');
    expect(loadSettings(st)).toEqual(defaultSettings());
    const bad: StorageLike = { getItem: () => null, setItem: () => { throw new Error('cota'); } };
    expect(() => saveSettings(bad, defaultSettings())).not.toThrow();
  });
});

describe('slots de controles e jogabilidade', () => {
  it('sem slots salvos (versão antiga): controles vazios, jogabilidade 1 = padrão do jogo', () => {
    const s = normalizeSettings({});
    expect(s.controlSlots).toEqual([null, null, null]);
    expect(s.gameplaySlots).toEqual([{ randomSpawns: false, gloveEscape: 10, throwStun: false, sleepSec: 3 }, null, null]);
  });
  it('slot inválido vira vazio; valores fora da faixa caem no padrão', () => {
    const s = normalizeSettings({
      controlSlots: [7, { devices: ['kb', 'xx'], keymaps: [{ a: 'KeyZ' }] }, null],
      gameplaySlots: [null, { gloveEscape: 99, sleepSec: 5 }, 'x'],
    });
    expect(s.controlSlots[0]).toBeNull();
    expect([s.controlSlots[1]!.devices[1], s.controlSlots[1]!.keymaps[0].a]).toEqual(['kb', 'KeyZ']);
    expect(s.gameplaySlots).toEqual([null, { randomSpawns: false, gloveEscape: 10, throwStun: false, sleepSec: 5 }, null]);
  });
});
