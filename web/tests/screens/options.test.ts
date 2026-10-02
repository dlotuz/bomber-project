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
  it('linhas na ordem: Opções, Controles e Jogabilidade', () => {
    const { app } = mkApp();
    expect(optionsScreen(app).rowIds()).toEqual(['controls', 'gameplay', 'fx', 'borders', 'smooth', 'music', 'sfx', 'romStatus', 'romLoad', 'romForget', 'reset', 'back']);
    expect(optionsScreen(app, 0, 'controls').rowIds()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'slot', 'slotSave', 'slotLoad', 'back']);
    expect(optionsScreen(app, 0, 'gameplay').rowIds()).toEqual(['spawns', 'escape', 'throwStun', 'sleep', 'password', 'slot', 'slotSave', 'slotLoad', 'back']);
  });
  it('slots de controles: salvar no 2 e carregar de volta; slot vazio não carrega', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'controls'); app.go(o);
    goRow(o, 'slot'); expect(o.value('slot')).toBe('1 VAZIO');
    goRow(o, 'slotLoad'); press(app, BTN.A);
    expect(app.settings.devices).toEqual(defaultSettings().devices);
    goRow(o, 'slot'); press(app, BTN.RIGHT);
    app.settings.keymaps[0].a = 'KeyZ'; app.settings.devices[4] = 'none';
    goRow(o, 'slotSave'); press(app, BTN.A);
    expect([o.value('slot'), o.value('slotSave')]).toEqual(['2', 'SALVO']);
    app.settings.keymaps[0].a = 'KeyJ'; app.settings.devices[4] = 'gp2';
    goRow(o, 'slotLoad'); press(app, BTN.A);
    expect([app.settings.keymaps[0].a, app.settings.devices[4], o.value('slotLoad')]).toEqual(['KeyZ', 'none', 'CARREGADO']);
    app.settings.keymaps[0].a = 'KeyQ';
    expect(app.settings.controlSlots[1]!.keymaps[0].a).toBe('KeyZ');   // o slot é uma cópia
  });
  it('slots de jogabilidade: o 1 vem com o padrão do jogo; carregar restaura', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'gameplay'); app.go(o);
    expect(o.value('slot')).toBe('1');
    Object.assign(app.settings.options, { gloveEscape: 25, throwStun: true, sleepSec: 7, randomSpawns: true });
    goRow(o, 'slotLoad'); press(app, BTN.A);
    const d = defaultSettings().options;
    expect([app.settings.options.gloveEscape, app.settings.options.throwStun, app.settings.options.sleepSec, app.settings.options.randomSpawns])
      .toEqual([d.gloveEscape, d.throwStun, d.sleepSec, d.randomSpawns]);
  });
  it('restaurar padrão não apaga os slots', () => {
    const { app } = mkApp();
    app.settings.controlSlots[2] = { devices: ['none', 'none', 'none', 'none', 'none'], keymaps: app.settings.keymaps, padmaps: app.settings.padmaps };
    const o = optionsScreen(app); app.go(o); goRow(o, 'reset'); press(app, BTN.A);
    expect(app.settings.controlSlots[2]?.devices[0]).toBe('none');
  });
  it('EFEITOS VISUAIS: ←/→ desliga e liga, e salva', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'fx');
    expect(o.value('fx')).toBe('SIM');
    press(app, BTN.LEFT);
    expect([app.settings.options.fx, o.value('fx')]).toEqual([false, 'NÃO']);
    press(app, BTN.RIGHT);
    expect(app.settings.options.fx).toBe(true);
  });
  it('BORDAS DA TELA: ←/→ troca entre PRETAS e BORRADAS (padrão), e salva', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'borders');
    expect(o.value('borders')).toBe('BORRADAS');
    press(app, BTN.LEFT);
    expect([app.settings.options.blurBorders, o.value('borders')]).toEqual([false, 'PRETAS']);
    press(app, BTN.RIGHT);
    expect(app.settings.options.blurBorders).toBe(true);
  });
  it('FILTRO SUAVE: padrão NÃO; ←/→ liga e desliga, e salva', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'smooth');
    expect(o.value('smooth')).toBe('NÃO');
    press(app, BTN.RIGHT);
    expect([app.settings.options.smooth, o.value('smooth')]).toEqual([true, 'SIM']);
    press(app, BTN.LEFT);
    expect(app.settings.options.smooth).toBe(false);
  });
  it('A em CONTROLES/JOGABILIDADE abre o submenu; B volta às Opções com o cursor nele', () => {
    const { app } = mkApp();
    const o = optionsScreen(app); app.go(o); goRow(o, 'gameplay');
    press(app, BTN.A); settle(app);
    expect((app.screen as Opt).page).toBe('gameplay');
    press(app, BTN.B); settle(app);
    const back = app.screen as Opt;
    expect([back.page, back.rowIds()[back.menu.cursor]]).toEqual(['main', 'gameplay']);
  });
  it('voltar dos controles de um jogador cai no submenu Controles', () => {
    const { app } = mkApp();
    app.go(remapScreen(app, 2));
    press(app, BTN.B); settle(app);
    const o = app.screen as Opt;
    expect([o.page, o.rowIds()[o.menu.cursor]]).toEqual(['controls', 'p3']);
  });
  it('dispositivo por jogador com ←/→, com volta; grava', () => {
    const { app, saves } = mkApp();
    const o = optionsScreen(app, 0, 'controls'); app.go(o); goRow(o, 'p1');
    press(app, BTN.RIGHT); expect(app.settings.devices[0]).toBe('gp0');
    press(app, BTN.LEFT); press(app, BTN.LEFT);
    expect([app.settings.devices[0], o.value('p1')]).toEqual(['none', 'NENHUM']);
    expect(saves()).toBeGreaterThanOrEqual(3);
  });
  it('dois jogadores nunca no mesmo controle: escolher o de outro troca os dois (M4); teclado repete', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'controls'); app.go(o);
    expect(o.value('p2')).toBe('TECLADO');
    goRow(o, 'p3'); press(app, BTN.RIGHT);                   // gp0 → gp1 (do P4): trocam
    expect(app.settings.devices).toEqual(['kb', 'kb', 'gp1', 'gp0', 'gp2']);
    goRow(o, 'p5'); press(app, BTN.RIGHT); press(app, BTN.RIGHT);   // gp2 → gp3 → nenhum; 'none' não troca
    expect(app.settings.devices).toEqual(['kb', 'kb', 'gp1', 'gp0', 'none']);
    goRow(o, 'p1'); press(app, BTN.RIGHT);                   // P1 pega o controle 1 do P4, que vai para o teclado
    expect(app.settings.devices).toEqual(['gp0', 'kb', 'gp1', 'kb', 'none']);
  });
  it('A no jogador abre os controles dele', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'controls'); app.go(o); goRow(o, 'p3');
    press(app, BTN.A); settle(app);
    expect(app.screen.id).toBe('remap');
  });
  it('spawns aleatórios: NÃO → SIM', () => {
    const { app } = mkApp();
    const o = optionsScreen(app, 0, 'gameplay'); app.go(o); goRow(o, 'spawns');
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
    expect([o.value('music'), o.value('sfx'), app.settings.options.randomSpawns]).toEqual([String(d.options.musicVol), String(d.options.sfxVol), false]);
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
  it('B volta ao título com o cursor em "OPTIONS"', () => {
    const { app } = mkApp();
    app.go(optionsScreen(app));
    press(app, BTN.B); settle(app);
    expect([app.screen.id, (app.screen as unknown as { cursor: number }).cursor]).toEqual(['title', 1]);
  });
});

describe('controles do jogador', () => {
  const row = (f: string) => ['device', ...KEY_FIELDS, 'all', 'reset', 'back'].indexOf(f);
  it('teclado: A na ação, depois a tecla nova; aplica e grava; Escape cancela', () => {
    const { app, saves } = mkApp();
    const applied = vi.spyOn(app, 'applyInput');
    const r = remapScreen(app, 0); app.go(r);
    r.menu.cursor = row('a');
    press(app, BTN.A);
    expect(r.capturing).toBe('a');
    app.update(inputOf(0, 0, undefined, { key: 'KeyZ' }));
    expect([app.settings.keymaps[0].a, r.capturing, applied.mock.calls.length > 0, saves() > 0]).toEqual(['KeyZ', null, true, true]);
    app.update(inputOf(BTN.A, BTN.A));                        // a tecla nova ainda segurada: não reabre
    expect(r.capturing).toBeNull();
    app.update(idleInput());
    r.menu.cursor = row('b');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'Escape' }));
    expect([r.capturing, app.settings.keymaps[0].b]).toEqual([null, 'KeyK']);
  });
  it('teclado: tecla já usada em outra ação (até de outro jogador) troca as duas; F5/Tab são ignoradas (M3)', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 0); app.go(r);
    r.menu.cursor = row('a');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'F5' }));
    app.update(inputOf(0, 0, undefined, { key: 'Tab' }));
    expect([r.capturing, app.settings.keymaps[0].a]).toEqual(['a', 'KeyJ']);
    app.update(inputOf(0, 0, undefined, { key: 'ArrowUp' }));   // era o CIMA do P2
    expect([r.capturing, app.settings.keymaps[0].a, app.settings.keymaps[1].up]).toEqual([null, 'ArrowUp', 'KeyJ']);
  });
  it('controle: botão já usado em outra ação troca as duas', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 3); app.go(r);                 // P4 = controle 2 (gp1)
    r.menu.cursor = row('a');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 1, button: 9 } }));   // 9 era START
    expect([r.capturing, app.settings.padmaps[3].a, app.settings.padmaps[3].start, app.settings.padmaps[2]]).toEqual([null, 9, DEFAULT_PADMAP.a, DEFAULT_PADMAP]);
  });
  it('captura aceita qualquer dispositivo: jogador no teclado aperta um botão do controle e passa para ele', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 0); app.go(r);                 // P1 = teclado
    r.menu.cursor = row('up');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 1, button: 12 } }));
    expect([r.capturing, app.settings.devices[0], app.settings.devices[3], app.settings.padmaps[0].up]).toEqual([null, 'gp1', 'kb', 12]);
  });
  it('configurar todos: pede as 12 ações em sequência', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 2); app.go(r);
    app.settings.devices[2] = 'kb';
    r.menu.cursor = row('all');
    press(app, BTN.A);
    const keys = ['KeyT', 'KeyG', 'KeyF', 'KeyH', 'KeyB', 'KeyN', 'KeyM', 'KeyV', 'KeyR', 'KeyY', 'KeyU', 'KeyO'];
    for (const [k, f] of KEY_FIELDS.filter(g => g !== 'power').entries()) {
      expect(r.capturing).toBe(f);
      app.update(inputOf(0, 0, undefined, { key: keys[k] })); app.update(idleInput());
    }
    expect([r.capturing, Object.values(app.settings.keymaps[2])]).toEqual([null, [...keys, '']]);   // PODER fica de fora
    expect(app.settings.keymaps[0].select).toBe('');          // F era o SELECT do P1: fica com a tecla antiga do P3 (nenhuma)
  });
  it('dispositivo: A e depois um botão escolhe aquele controle; uma tecla escolhe o teclado', () => {
    const { app } = mkApp();
    const r = remapScreen(app, 0); app.go(r);
    r.menu.cursor = row('device');
    press(app, BTN.A);
    expect(r.capturing).toBe('device');
    app.update(inputOf(0, 0, undefined, { padButton: { pad: 2, button: 0 } }));
    expect(app.settings.devices).toEqual(['gp2', 'kb', 'gp0', 'gp1', 'kb']);   // P5 tinha o controle 3: troca
    app.update(idleInput());
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'KeyP' }));
    expect(app.settings.devices[0]).toBe('kb');
  });
  it('sem dispositivo (NENHUM) ainda dá para configurar: a tecla apertada põe o jogador no teclado', () => {
    const { app } = mkApp();
    app.settings.devices[0] = 'none';
    const r = remapScreen(app, 0); app.go(r);
    r.menu.cursor = row('a');
    press(app, BTN.A);
    app.update(inputOf(0, 0, undefined, { key: 'KeyZ' }));
    expect([app.settings.devices[0], app.settings.keymaps[0].a]).toEqual(['kb', 'KeyZ']);
  });
  it('restaurar padrão do jogador (teclas, botões e dispositivo)', () => {
    const { app } = mkApp();
    app.settings.keymaps[0].a = 'KeyZ'; app.settings.padmaps[0].a = 5; app.settings.devices[0] = 'none';
    const r = remapScreen(app, 0); app.go(r);
    r.menu.cursor = row('reset'); press(app, BTN.A);
    expect([app.settings.keymaps[0], app.settings.padmaps[0], app.settings.devices[0]]).toEqual([defaultSettings().keymaps[0], DEFAULT_PADMAP, 'kb']);
  });
  it('B fora da captura volta às opções, com o cursor no jogador', () => {
    const { app } = mkApp();
    app.go(remapScreen(app, 1));
    press(app, BTN.B); settle(app);
    expect([app.screen.id, (app.screen as unknown as { menu: { cursor: number } }).menu.cursor]).toEqual(['options', 1]);
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
    const f = optionsPpuFrame(ASSETS!, 'CONTROLES DO JOGADOR 5', 'ascii8', 28);
    expect(() => renderPpu(f, createImage(256, 224))).not.toThrow();
  });
});
