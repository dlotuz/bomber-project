import {
  defaultSettings, loadSettings, saveSettings, normalizeSettings, migrate, STORAGE_KEY, type StorageLike,
} from '../../src/app/settings';
import { DEFAULT_KEYMAPS, DEFAULT_PADMAP } from '../../src/input/input';

const mem = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
};

describe('configurações v4', () => {
  it('padrão: versão 4, já com o DEV CONTROLES carregado (3 teclados, P4/P5 nos controles 2 e 1), teclas e botões por jogador, opções', () => {
    const s = defaultSettings();
    expect(s.version).toBe(4);
    expect(s.devices).toEqual(['kb', 'kb', 'kb', 'gp1', 'gp0']);
    expect(s.keymaps[1].power).toBe('Numpad7');
    expect([s.keymaps.length, s.padmaps.length]).toEqual([5, 5]);
    expect(s.padmaps[4]).toEqual(DEFAULT_PADMAP);
    expect(s.keymaps[2].a).toBe('Enter');
    expect(s.options).toEqual({ randomSpawns: true, musicVol: 8, sfxVol: 8, gloveEscape: 10, throwStun: false, sleepSec: 3, fx: true, allMounts: true, screen: 'hd', smooth: false });
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
  it('migra a v1: teclas novas com o padrão, randomSpawns sai das regras e Opções fica com o padrão (Sim)', () => {
    const v1 = { version: 1, devices: ['gp0', 'kb0', 'kb1', 'none', 'gp1'], keymaps: [{ up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH', a: 'KeyZ', b: 'KeyX', y: 'KeyC', start: 'Space' }],
      setup: { mode: 'team', rules: { matches: 5, randomSpawns: true } } };
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify(v1));
    const s = loadSettings(st);
    expect(s.version).toBe(4);
    expect(s.devices).toEqual(['gp0', 'kb', 'kb', 'none', 'gp1']);
    // Cada jogador herda o mapa do teclado que usava (P2 = Teclado 1, P3 = Teclado 2).
    expect(s.keymaps[1]).toMatchObject({ up: 'KeyT', a: 'KeyZ', x: 'KeyI', l: 'KeyQ', r: 'KeyE', select: 'KeyF' });
    expect(s.keymaps[2]).toEqual(DEFAULT_KEYMAPS[1]);
    expect(s.setup.mode).toBe('team');
    expect(s.setup.rules.matches).toBe(5);
    expect(s.options.randomSpawns).toBe(true);
  });
  it('migra a v3: spawns aleatórios ligados e o PODER (P) do controle no RB (R vai para o RT), sem pisar em botão já usado', () => {
    const v3 = { version: 3, options: { randomSpawns: false, musicVol: 4 },
      padmaps: [{ ...DEFAULT_PADMAP, r: 5, power: -1 }, { ...DEFAULT_PADMAP, r: 5, power: -1, a: 7 }, { ...DEFAULT_PADMAP, r: 5, power: 6 }],
      online: { device: 'gp0', padmap: { ...DEFAULT_PADMAP, r: 5, power: -1 } } };
    const s = normalizeSettings(migrate(v3));
    expect([s.options.randomSpawns, s.options.musicVol]).toEqual([true, 4]);
    expect([s.padmaps[0].power, s.padmaps[0].r]).toEqual([5, 7]);
    expect([s.padmaps[1].power, s.padmaps[1].r]).toEqual([-1, 5]);   // RT já era o A: fica como estava
    expect([s.padmaps[2].power, s.padmaps[2].r]).toEqual([6, 5]);    // P já tinha botão
    expect([s.online.padmap.power, s.online.padmap.r]).toEqual([5, 7]);
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
    expect(s.options).toEqual({ randomSpawns: true, musicVol: 8, sfxVol: 8, gloveEscape: 10, throwStun: false, sleepSec: 3, fx: true, allMounts: true, screen: 'hd', smooth: false });
  });
  it('efeitos visuais: padrão ligado, campo ausente em configuração antiga vira true, lixo vira padrão', () => {
    expect(defaultSettings().options.fx).toBe(true);
    expect(normalizeSettings({ options: { musicVol: 3 } }).options.fx).toBe(true);
    expect(normalizeSettings({ options: { fx: false } }).options.fx).toBe(false);
    expect(normalizeSettings({ options: { fx: 'não' } }).options.fx).toBe(true);
    expect(normalizeSettings({ options: { musicVol: 3 } }).options.allMounts).toBe(true);
    expect(normalizeSettings({ options: { allMounts: false } }).options.allMounts).toBe(false);
    expect(normalizeSettings({ options: { allMounts: 1 } }).options.allMounts).toBe(true);
    expect(normalizeSettings({ options: { musicVol: 3 } }).options.screen).toBe('hd');
    expect(normalizeSettings({ options: { screen: 'classic' } }).options.screen).toBe('classic');
    expect(normalizeSettings({ options: { screen: 'xyz' } }).options.screen).toBe('hd');
    // salvos antigos: BORDAS e ARTE deixaram de existir; hdArt=true não liga mais a arte HD
    const old = normalizeSettings({ options: { blurBorders: false, hdArt: true } }).options as unknown as Record<string, unknown>;
    expect(old.screen).toBe('hd');
    expect('hdArt' in old || 'blurBorders' in old).toBe(false);
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
    expect(s.gameplaySlots).toEqual([{ randomSpawns: true, gloveEscape: 10, throwStun: false, sleepSec: 3 }, null, null]);
  });
  it('slot inválido vira vazio; valores fora da faixa caem no padrão', () => {
    const s = normalizeSettings({
      controlSlots: [7, { devices: ['kb', 'xx'], keymaps: [{ a: 'KeyZ' }] }, null],
      gameplaySlots: [null, { gloveEscape: 99, sleepSec: 5 }, 'x'],
    });
    expect(s.controlSlots[0]).toBeNull();
    expect([s.controlSlots[1]!.devices[1], s.controlSlots[1]!.keymaps[0].a]).toEqual(['kb', 'KeyZ']);
    expect(s.gameplaySlots).toEqual([null, { randomSpawns: true, gloveEscape: 10, throwStun: false, sleepSec: 5 }, null]);
  });
});
