vi.mock('../../src/app/rom-api', async orig => ({
  ...(await orig<typeof import('../../src/app/rom-api')>()), openRomDialog: vi.fn(), forgetStoredRom: vi.fn(async () => {}),
}));
import * as romApi from '../../src/app/rom-api';
import { optionsScreen } from '../../src/screens/options';
import { remapScreen } from '../../src/screens/remap';
import { KEY_FIELDS, DEFAULT_PADMAP } from '../../src/input/input';
import { defaultSettings } from '../../src/app/settings';
import { BTN } from '../../src/game/core-api';
import { idleInput } from '../../src/input/input';
import { mkApp, press, settle, inputOf, RecordingSink } from './helpers';
import { ASSETS } from './rom';
import { optionsPpuFrame, OPTIONS_FRAME } from '../../src/render/screens-rom/options';
import { MENU_GEO } from '../../src/render/screens-rom/scene';
import { createImage, renderPpu } from '../../src/render/ppu';
import { MUSIC, BANK } from '../../src/app/audio';

type Opt = ReturnType<typeof optionsScreen>;
const goRow = (o: Opt, id: string) => { o.menu.cursor = o.rowIds().indexOf(id); };
beforeEach(() => vi.clearAllMocks());

describe('opções (§6.13)', () => {
  it('linhas na ordem', () => {
    const { app } = mkApp();
    expect(optionsScreen(app).rowIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'kb1', 'kb2', 'gp1', 'gp2', 'gp3', 'gp4',
      'spawns', 'music', 'sfx', 'romStatus', 'romLoad', 'romForget', 'reset', 'back']);
  });
  it('dispositivo por jogador com ←/→, com volta; grava', () => {
    const { app, saves } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'p1');
    press(app, BTN.RIGHT); expect(app.settings.devices[0]).toBe('kb1');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect([app.settings.devices[0], o.value('p1')]).toEqual(['none', 'NENHUM']);
    expect(saves()).toBeGreaterThanOrEqual(3);
  });
  it('spawns aleatórios: NÃO → SIM', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'spawns');
    expect(o.value('spawns')).toBe('NÃO');
    press(app, BTN.RIGHT);
    expect([app.settings.options.randomSpawns, o.value('spawns')]).toEqual([true, 'SIM']);
  });
  it('volume 0..10 sem volta, repassado ao áudio', () => {
    const { app } = mkApp();
    const got: number[][] = [];
    app.audio.setSink(Object.assign(new RecordingSink(), { setVolume: (m: number, s: number) => { got.push([m, s]); } }));
    const o = optionsScreen(app); app.go(o); goRow(o, 'music');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect([app.settings.options.musicVol, got.at(-1)]).toEqual([10, [1, 0.8]]);
    goRow(o, 'sfx');
    for (let k = 0; k < 9; k++) press(app, BTN.LEFT);
    expect([app.settings.options.sfxVol, got.at(-1)]).toEqual([0, [1, 0]]);
  });
  it('ROM: estado; carregar abre o painel; esquecer pede confirmação', async () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o);
    expect(o.value('romStatus')).toBe('NÃO CARREGADA');
    goRow(o, 'romLoad'); press(app, BTN.A);
    expect(romApi.openRomDialog).toHaveBeenCalledTimes(1);
    goRow(o, 'romForget'); press(app, BTN.A);
    expect([o.asking, (romApi.forgetStoredRom as ReturnType<typeof vi.fn>).mock.calls.length]).toEqual([true, 0]);
    press(app, BTN.B);
    expect([o.asking, app.screen.id]).toEqual([false, 'options']);
    press(app, BTN.A); press(app, BTN.A);
    expect(romApi.forgetStoredRom).toHaveBeenCalledTimes(1);
  });
  it('restaurar padrão', () => {
    const { app } = mkApp();
    Object.assign(app.settings, { devices: ['gp3', 'gp3', 'none', 'none', 'none'] });
    app.settings.options.musicVol = 2; app.settings.padmaps[0].a = 9; app.settings.keymaps[0].a = 'KeyZ';
    const o = optionsScreen(app); app.go(o); goRow(o, 'reset');
    press(app, BTN.A);
    const d = defaultSettings();
    expect([app.settings.devices, app.settings.options, app.settings.padmaps, app.settings.keymaps]).toEqual([d.devices, d.options, d.padmaps, d.keymaps]);
  });
  // Fix round 1: reset trocava `st.options` por um objeto novo, mas um alias tirado na criação da tela
  // continuava apontando para o objeto antigo — música/efeitos/spawns pareciam obedecer, mas editavam um
  // objeto órfão nunca salvo em `app.settings`. Cobre o valor mostrado, o volume repassado e uma edição
  // depois do reset persistindo de verdade.
  it('restaurar padrão também repõe volume/spawns "ao vivo" (sem alias congelado); edição depois do reset persiste', () => {
    const { app } = mkApp();
    const got: number[][] = [];
    app.audio.setSink(Object.assign(new RecordingSink(), { setVolume: (m: number, s: number) => { got.push([m, s]); } }));
    app.settings.options.musicVol = 2; app.settings.options.sfxVol = 3; app.settings.options.randomSpawns = true;
    const o = optionsScreen(app); app.go(o);
    goRow(o, 'reset'); press(app, BTN.A);
    const d = defaultSettings();
    expect([o.value('music'), o.value('sfx'), o.value('spawns')]).toEqual([String(d.options.musicVol), String(d.options.sfxVol), 'NÃO']);
    expect(got.at(-1)).toEqual([d.options.musicVol / 10, d.options.sfxVol / 10]);
    goRow(o, 'music'); press(app, BTN.RIGHT);
    expect([app.settings.options.musicVol, o.value('music')]).toEqual([d.options.musicVol + 1, String(d.options.musicVol + 1)]);
    expect(got.at(-1)).toEqual([(d.options.musicVol + 1) / 10, d.options.sfxVol / 10]);
  });
  // Fix round 1: brief pede `ensureMenus(MUSIC.title)` na criação (Opções é aberta direto do título, então
  // mantém a mesma música — banco de menus $30 + música $01 — em vez de trocar para a dos outros menus).
  it('ao entrar: ensureMenus(MUSIC.title) — banco de menus e música do título', () => {
    const { app, sink } = mkApp();
    app.go(optionsScreen(app));
    expect(sink.calls.map(c => [c.op, c.id])).toEqual([['bank', BANK.menus], ['music', MUSIC.title]]);
  });
  it('B volta ao título com o cursor em "Opções"', () => {
    const { app } = mkApp();
    app.go(optionsScreen(app));
    press(app, BTN.B); settle(app);
    expect([app.screen.id, (app.screen as unknown as { cursor: number }).cursor]).toEqual(['title', 2]);
  });
});

describe('remapeamento', () => {
  it('teclado: A na ação, depois a tecla nova; aplica e grava; Escape cancela', () => {
    const { app, saves } = mkApp();
    const applied = vi.spyOn(app, 'applyInput');
    const r = remapScreen(app, 'kb0'); app.go(r);
    r.menu.cursor = KEY_FIELDS.indexOf('a');
    press(app, BTN.A);
    expect(r.capturing).toBe('a');
    app.update(inputOf(0, 0, undefined, { key: 'KeyZ' }));
    expect([app.settings.keymaps[0].a, r.capturing, applied.mock.calls.length > 0, saves() > 0]).toEqual(['KeyZ', null, true, true]);
    app.update(inputOf(BTN.A, BTN.A));                        // a tecla nova ainda segurada: não reabre
    expect(r.capturing).toBeNull();
    app.update(idleInput());
    r.menu.cursor = KEY_FIELDS.indexOf('b');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'Escape' }));
    expect([r.capturing, app.settings.keymaps[0].b]).toEqual([null, 'KeyK']);
  });
  it('gamepad: só aceita botão do próprio controle', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 'gp1'); app.go(r);
    r.menu.cursor = KEY_FIELDS.indexOf('start');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 0, button: 3 } }));
    expect(r.capturing).toBe('start');
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 1, button: 11 } }));
    expect([r.capturing, app.settings.padmaps[1].start, app.settings.padmaps[0]]).toEqual([null, 11, DEFAULT_PADMAP]);
  });
  it('B fora da captura volta às opções', () => {
    const { app } = mkApp();
    app.go(remapScreen(app, 'kb1'));
    press(app, BTN.B); settle(app);
    expect(app.screen.id).toBe('options');
  });
});

// Não há cena "options" no jogo original (a tela é nova): não existe captura para comparar pixel a pixel.
// Aqui só verificamos que a cena ROM real (`rules`, reaproveitada) monta e renderiza sem estourar, com a
// moldura de corda em bandas (uma por trecho de MENU_GEO.rulesBg1Bands) e a mão na linha do cursor — a API
// de cena da T5 (sceneGfx/menuMaps/menuBg1Vofs/handCursor) de verdade, não só a via de fallback.
describe.skipIf(!ASSETS)('quadro ROM (cena rules reaproveitada, sem captura própria)', () => {
  it('optionsPpuFrame: uma banda por trecho do HDMA do BG1, mão na linha do cursor, e renderiza sem estourar', () => {
    const handY = 28 + 3 * 10;
    const f = optionsPpuFrame(ASSETS!, 'Opções', 'menuTitle', handY);
    expect(f.bands).toHaveLength(MENU_GEO.rulesBg1Bands.length);
    expect(f.bands.map(b => b.bg1?.[1])).toEqual(MENU_GEO.rulesBg1Bands.map(b => b[1]));
    expect(f.bands.at(-1)!.y1).toBe(224);
    expect(f.oam).toEqual([{ x: 8, y: handY, size: 16, pal: MENU_GEO.hand.pal, prio: 3, hflip: false, vflip: false, src: { tile: MENU_GEO.hand.tile } }]);
    const img = createImage(256, 224);
    expect(() => renderPpu(f, img)).not.toThrow();
    // A moldura de corda desenha algo (não é só o fundo transparente/preto) dentro do retângulo (7,15)-(248,218).
    let sawEdge = false;
    for (let y = OPTIONS_FRAME.y0; y <= OPTIONS_FRAME.y1 && !sawEdge; y++) {
      const rowStart = y * 256 * 4;
      for (let x = OPTIONS_FRAME.x0; x <= OPTIONS_FRAME.x1; x++) {
        const i = rowStart + x * 4;
        if (img.data[i + 3] === 255 && (img.data[i] !== 0 || img.data[i + 1] !== 0 || img.data[i + 2] !== 0)) { sawEdge = true; break; }
      }
    }
    expect(sawEdge).toBe(true);
  });
  it('funciona com um título bem mais largo (o do remapeamento de gamepad)', () => {
    const f = optionsPpuFrame(ASSETS!, 'BOTÕES DO CONTROLE 4', 'ascii8', 28);
    expect(() => renderPpu(f, createImage(256, 224))).not.toThrow();
  });
});
