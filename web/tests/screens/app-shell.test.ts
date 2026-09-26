import { App, type TransitionSpec } from '../../src/app/app';
import { FADE_OUT_1, FADE_IN_1, FADE_OUT_2, FADE_IN_2, FADE_OUT_12, FADE_MENU, FADE_FROM_TITLE, FADE_TO_TITLE, fadeSpec, MENU_ENTRY_AT } from '../../src/app/fade';
import { AudioDirector, setGameEventAudio, SFX, MUSIC, BANK } from '../../src/app/audio';
import { BTN } from '../../src/game/core-api';
import { mkApp, probe, brightnessTrace, range, RecordingSink, inputOf, idle } from './helpers';
import { defaultSettings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';

describe('tabelas de fade (spec §6, R2)', () => {
  it('menus: 15 f de saída (14→0) e 15 f de entrada (1→15)', () => {
    expect(FADE_OUT_1).toEqual(range(14, 0));
    expect(FADE_IN_1).toEqual(range(1, 15));
  });
  it('título: 2 f por passo; preto no frame 28', () => {
    expect(FADE_OUT_2).toHaveLength(29);
    expect(FADE_OUT_2.slice(0, 4)).toEqual([14, 14, 13, 13]);
    expect(FADE_OUT_2[27]).toBe(1);
    expect(FADE_OUT_2[28]).toBe(0);
    expect(FADE_IN_2.slice(0, 3)).toEqual([1, 1, 2]);
    expect(FADE_IN_2[28]).toBe(15);
  });
  it('B do VS: 12 f de saída', () => {
    expect(FADE_OUT_12).toHaveLength(12);
    expect(FADE_OUT_12[0]).toBe(14);
    expect(FADE_OUT_12[11]).toBe(0);
  });
  it('a entrada começa sempre no f58', () => {
    for (const s of [FADE_MENU, FADE_FROM_TITLE, FADE_TO_TITLE]) expect(s.out.length + s.black).toBe(MENU_ENTRY_AT);
    expect(FADE_MENU.black).toBe(43);
  });
});

describe('transição', () => {
  it('menu: brilho 14..0, preto até f57, 1..15 de f58 a f72; tela nova criada em f58, entrada real em f73', () => {
    const { app } = mkApp();
    const a = probe('a'); const b = probe('b');
    app.go(a);
    let created = -1;
    app.transition(() => { created = app.tick; return b; }, FADE_MENU);
    expect(app.brightness()).toBe(14);                       // f0 = o frame do botão
    const t0 = app.tick;
    const trace = brightnessTrace(app, 73);                   // f1..f73
    expect(trace.slice(0, 14)).toEqual(range(13, 0));        // f1..f14
    expect(trace.slice(14, 57).every(v => v === 0)).toBe(true); // f15..f57
    expect(trace.slice(57, 72)).toEqual(range(1, 15));       // f58..f72
    expect(trace[72]).toBe(15);                              // f73
    expect(created - t0).toBe(58);
    expect(a.updates).toBe(0);                               // a tela velha não recebe update durante a saída
    expect(b.updates).toBe(16);                              // 15 ociosos (fade-in) + 1 real (f73)
    expect(app.inTransition).toBe(false);
  });
  it('durante o fade-in a tela nova só recebe entrada ociosa', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.go(probe('a'));
    app.transition(() => b, FADE_MENU);
    for (let k = 0; k < 60; k++) app.update(inputOf(BTN.A, BTN.A));
    expect(b.last!.pressedAny).toBe(0);
  });
  it('sem fade-in: a tela nova é criada e recebe a entrada real no mesmo frame', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.go(probe('a'));
    const spec: TransitionSpec = { out: FADE_OUT_1, black: 353, in: [] };
    app.transition(() => b, spec);
    idle(app, 367);
    expect(app.screen.id).toBe('a');
    app.update(inputOf(BTN.A, BTN.A));                        // frame 368 = 15 + 353
    expect(app.screen.id).toBe('b');
    expect(b.updates).toBe(1);
    expect(b.last!.pressedAny).toBe(BTN.A);
    expect(app.brightness()).toBe(15);
  });
  it('só entrada (boot): tela criada na hora, brilho 1..15', () => {
    const { app } = mkApp();
    const b = probe('b');
    app.transition(() => b, { out: [], black: 0, in: FADE_IN_1 });
    expect(app.screen.id).toBe('b');
    expect(app.brightness()).toBe(1);
    expect(brightnessTrace(app, 15)).toEqual([...range(2, 15), 15]);
  });
  it('cues rodam no frame certo, contado do frame do botão', () => {
    const { app } = mkApp();
    app.go(probe('a'));
    const hits: [string, number][] = [];
    const t0 = app.tick;
    app.transition(() => probe('b'), fadeSpec(FADE_OUT_1, FADE_IN_1, [
      { at: 0, run: () => hits.push(['zero', app.tick - t0]) },
      { at: 15, run: () => hits.push(['preto', app.tick - t0]) },
      { at: 58, run: a => hits.push([a.screen.id, app.tick - t0]) },
    ]));
    idle(app, 80);
    expect(hits).toEqual([['zero', 0], ['preto', 15], ['a', 58]]);   // o cue roda antes de criar a tela nova
  });
  it('fora da transição o brilho vem da tela (padrão 15, limitado a 0..15)', () => {
    const { app } = mkApp();
    app.go(probe('a', { brightness: () => 7 }));
    expect(app.brightness()).toBe(7);
    app.go(probe('b', { brightness: () => 99 }));
    expect(app.brightness()).toBe(15);
    app.go(probe('c'));
    expect(app.brightness()).toBe(15);
  });
  it('go() cancela a transição em curso', () => {
    const { app } = mkApp();
    app.go(probe('a'));
    app.transition(() => probe('b'), FADE_MENU);
    app.go(probe('c'));
    expect(app.inTransition).toBe(false);
    idle(app, 100);
    expect(app.screen.id).toBe('c');
  });
});

describe('contadores e desenho', () => {
  it('tick conta todo update; frame para quando a tela congela', () => {
    const { app } = mkApp();
    let fz = false;
    app.go(probe('a', { frozen: () => fz }));
    idle(app, 3); fz = true; idle(app, 4);
    expect(app.tick).toBe(7);
    expect(app.frame).toBe(3);
  });
  it('overlay preto com alfa 1 − b/15, só quando b < 15', () => {
    const { app } = mkApp();
    const fills: string[] = [];
    const fake = { fillStyle: '', fillRect() { fills.push(String(fake.fillStyle)); } };
    const ctx = fake as unknown as CanvasRenderingContext2D;
    app.go(probe('a', { brightness: () => 15 }));
    app.draw(ctx, {} as never);
    expect(fills).toEqual([]);
    app.go(probe('b', { brightness: () => 5 }));
    app.draw(ctx, {} as never);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toBe(`rgba(0,0,0,${1 - 5 / 15})`);
  });
  it('audio.tick() uma vez por update', () => {
    const { app, sink } = mkApp();
    app.go(probe('a'));
    idle(app, 5);
    expect(sink.ticks).toBe(5);
  });
});

describe('AudioDirector', () => {
  it('bloco faz STOP (música atual some); lembra banco e música e repete no sink novo', () => {
    const d = new AudioDirector(new RecordingSink());
    d.bank(BANK.menus); d.music(MUSIC.title);
    expect(d.current).toEqual({ bank: 0x30, music: 0x01 });
    d.bank(BANK.battle);
    expect(d.current).toEqual({ bank: 0x2f, music: null });
    d.music(MUSIC.battle);
    const real = new RecordingSink();
    d.setSink(real);
    expect(real.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x2f], ['music', 0x14]]);
  });
  it('stop e fade esquecem a música; sfx e voz passam direto', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    d.music(0x15); d.fade();
    expect(d.current.music).toBeNull();
    d.music(0x18); d.stop();
    expect(d.current.music).toBeNull();
    d.sfx(SFX.confirm); d.voice(0x07);
    expect(s.calls.map(c => c.op)).toEqual(['music', 'fade', 'music', 'stop', 'sfx', 'voice']);
  });
  it('ensureMenus: sobe o banco $30 e a música só se ainda não estiverem', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    d.ensureMenus(MUSIC.title);
    d.ensureMenus(MUSIC.title);
    expect(s.calls.map(c => [c.op, c.id])).toEqual([['bank', 0x30], ['music', 0x01]]);
    d.ensureMenus(MUSIC.menus);
    expect(s.calls.map(c => [c.op, c.id]).slice(2)).toEqual([['music', 0x12]]);
  });
  it('volume só chega a sinks que implementam VolumeControl, também depois de trocar o sink', () => {
    const d = new AudioDirector(new RecordingSink());
    d.setVolume(0.5, 0.25);
    const got: number[][] = [];
    const vc = Object.assign(new RecordingSink(), { setVolume: (m: number, s: number) => got.push([m, s]) });
    d.setSink(vc);
    expect(got).toEqual([[0.5, 0.25]]);
    d.setVolume(1, 0);
    expect(got).toEqual([[0.5, 0.25], [1, 0]]);
  });
  it('playEvents repassa ao mapeador registrado (plano 11)', () => {
    const s = new RecordingSink();
    const d = new AudioDirector(s);
    const seen: unknown[] = [];
    setGameEventAudio((sink, ev) => { seen.push(...ev); sink.sfx(0x07); });
    d.playEvents([{ type: 'explosion' } as never]);
    expect(seen).toHaveLength(1);
    expect(s.of('sfx')).toHaveLength(1);
    setGameEventAudio(() => {});
  });
});

describe('App com configurações', () => {
  it('applyInput usa o gancho applyInput quando existe, senão setKeymaps', () => {
    const maps: unknown[] = []; const whole: unknown[] = [];
    const a1 = new App(defaultSettings(), { save() {}, setKeymaps: m => maps.push(m), seed: () => 1 });
    a1.applyInput();
    expect(maps).toHaveLength(1);
    const a2 = new App(defaultSettings(), { save() {}, setKeymaps: m => maps.push(m), seed: () => 1, applyInput: s => whole.push(s) });
    a2.applyInput();
    expect(whole).toHaveLength(1);
    expect(maps).toHaveLength(1);
  });
  it('sem sink, usa o NoopSink', () => {
    const a = new App(defaultSettings(), { save() {}, setKeymaps() {}, seed: () => 1 });
    a.go(probe('x'));
    a.update(idleInput());
    expect(a.audio.current).toEqual({ bank: null, music: null });
  });
});
