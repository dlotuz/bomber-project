import { playersScreen } from '../../src/screens/players';
import { rulesScreen, RULES_VALUE_X } from '../../src/screens/rules';
import { TONE_COLORS } from '../../src/render/text/text';
import type { SpriteBank } from '../../src/render/sprite-bank';
import { carry, resetCarry } from '../../src/game/match-session';
import { BTN } from '../../src/game/core-api';
import { mkApp, press, settle } from './helpers';
import { ASSETS } from './rom';
import { buildPlayersScene } from '../../src/render/screens-rom/players';
import { buildRulesScene } from '../../src/render/screens-rom/rules';
import { handCursor } from '../../src/render/screens-rom/scene';

beforeEach(() => resetCarry());

describe('jogadores (§6.4, A15)', () => {
  it('← vai de Humano a CPU a Nenhum e para; → volta; $01 mesmo no limite; grava', () => {
    const { app, sink, saves } = mkApp();
    const s = app.settings.setup;
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('cpu');
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('off');
    press(app, BTN.LEFT); expect(s.slots[0]).toBe('off');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(s.slots[0]).toBe('human');
    expect(sink.of('sfx').map(c => c.id)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(saves()).toBeGreaterThanOrEqual(4);
  });
  it('↑/↓ dão a volta nas 5 linhas', () => {
    const { app } = mkApp();
    const p = playersScreen(app); app.go(p);
    press(app, BTN.UP); expect(p.cursor).toBe(4);
    press(app, BTN.DOWN); expect(p.cursor).toBe(0);
  });
  it('valores e tons', () => {
    const { app } = mkApp();
    app.settings.setup.slots = ['human', 'cpu', 'off', 'cpu', 'cpu'];
    const p = playersScreen(app); app.go(p);
    expect([0, 1, 2].map(i => p.value(i))).toEqual([{ text: 'Humano', tone: 'green' }, { text: 'CPU', tone: 'red' }, { text: 'Nenhum', tone: 'blue' }]);
  });
  it('A ou START em qualquer linha → regras com $02', () => {
    const { app, sink } = mkApp();
    app.go(playersScreen(app)); press(app, BTN.DOWN); press(app, BTN.DOWN); sink.clear();
    press(app, BTN.START); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['rules', 2]);
  });
  it('menos de 2 ativos: A toca $03 e não avança', () => {
    const { app, sink } = mkApp();
    app.settings.setup.slots = ['human', 'off', 'off', 'off', 'off'];
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.A);
    expect([app.inTransition, app.screen.id, sink.of('sfx')[0].id]).toEqual([false, 'players', 3]);
  });
  it('B → modo com $03', () => {
    const { app, sink } = mkApp();
    app.go(playersScreen(app)); sink.clear();
    press(app, BTN.B); settle(app);
    expect([app.screen.id, sink.of('sfx')[0].id]).toEqual(['mode', 3]);
  });
});

describe('regras (§6.5)', () => {
  it('padrões: Normal, 3, 3:00, Não, Não, Não', () => {
    const { app } = mkApp();
    const r = rulesScreen(app); app.go(r);
    expect(r.values()).toEqual(['Normal', '3', '3:00', 'Não', 'Não', 'Não']);
  });
  it('←/→ param nos limites (sem volta) e tocam $01 sempre', () => {
    const { app, sink } = mkApp();
    const r = rulesScreen(app); app.go(r); sink.clear();
    press(app, BTN.DOWN);
    for (let k = 0; k < 3; k++) press(app, BTN.RIGHT);
    expect(r.values()[1]).toBe('5');
    press(app, BTN.DOWN);
    for (let k = 0; k < 3; k++) press(app, BTN.RIGHT);
    expect(r.values()[2]).toBe('∞');
    press(app, BTN.DOWN); press(app, BTN.LEFT);
    expect(r.values()[3]).toBe('Não');
    press(app, BTN.RIGHT); press(app, BTN.RIGHT);
    expect(r.values()[3]).toBe('Sim');
    expect(sink.of('sfx').filter(c => c.id === 1)).toHaveLength(12);
  });
  it('ligar a Corrida Bônus zera o prêmio guardado (§3.14)', () => {
    const { app } = mkApp();
    carry.racerPrize = { slot: 0, prize: 8 };
    const r = rulesScreen(app); app.go(r);
    for (let k = 0; k < 5; k++) press(app, BTN.DOWN);
    press(app, BTN.RIGHT);
    expect([r.values()[5], carry.racerPrize]).toEqual(['Sim', null]);
    expect(app.settings.setup.rules.racer).toBe(true);
  });
  it('A → personagens; B → jogadores', () => {
    const a = mkApp();
    a.app.go(rulesScreen(a.app)); press(a.app, BTN.A); settle(a.app);
    expect(a.app.screen.id).toBe('characters');
    const b = mkApp();
    b.app.go(rulesScreen(b.app)); press(b.app, BTN.B); settle(b.app);
    expect(b.app.screen.id).toBe('players');
  });
});

describe('regras: valores como no original (I10)', () => {
  it('cores por valor: Low/Off/∞ azul, Normal/números/tempos verde, Strong/On vermelho', () => {
    const { app } = mkApp();
    const r = rulesScreen(app); app.go(r);
    expect(r.tones()).toEqual(['green', 'green', 'green', 'blue', 'blue', 'blue']);
    const rl = app.settings.setup.rules;
    rl.cpuLevel = 0; rl.timeIdx = 4; rl.suddenDeath = true;
    expect(r.tones().slice(0, 4)).toEqual(['blue', 'green', 'blue', 'red']);
    rl.cpuLevel = 2; rl.timeIdx = 0;
    expect(r.tones().slice(0, 3)).toEqual(['red', 'green', 'green']);
  });
  it('valores alinhados à esquerda em x = 176 (coluna 11 do BG1 da captura), na cor do tom', () => {
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ putImageData() {} }) }) });
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    try {
      const { app } = mkApp();
      app.settings.setup.rules.suddenDeath = true;
      const r = rulesScreen(app); app.go(r);
      const texts: { text: string; color: string }[] = [], pos: { x: number; y: number; w: number }[] = [];
      const bank = { text: (t: string, color: string) => { texts.push({ text: t, color }); return { width: 7 * t.length, height: 8, tag: t }; } } as unknown as SpriteBank;
      const ctx = { fillStyle: '', fillRect() {}, drawImage(img: { width: number }, x: number, y: number) { pos.push({ x, y, w: img.width }); } } as unknown as CanvasRenderingContext2D;
      r.draw(ctx, bank, 0);
      expect(RULES_VALUE_X).toBe(176);
      // Valores: nas linhas 55 + 24·i, todos começando em x = 176 (sem alinhamento à direita).
      const valueDraws = pos.filter(p => p.x >= 150);
      expect(valueDraws.map(p => [p.x, p.y])).toEqual([0, 1, 2, 3, 4, 5].map(i => [176, 55 + 24 * i]));
      const color = (t: string) => texts.find(x => x.text === t)?.color;
      expect([color('NORMAL'), color('3'), color('3:00'), color('SIM')]).toEqual([TONE_COLORS.green, TONE_COLORS.green, TONE_COLORS.green, TONE_COLORS.red]);
    } finally { vi.unstubAllGlobals(); }
  });
});

// (12 = 3 movimentos ↓ + 3 no Coroas + 3 no Tempo + 3 na Morte Súbita, contando os do limite.)

describe.skipIf(!ASSETS)('cenas ROM: mão nas posições da regra (§6.4, §6.5)', () => {
  it('jogadores: mão em (24, 48 + 32·i) em cada linha', () => {
    for (let i = 0; i < 5; i++) {
      const f = buildPlayersScene(ASSETS!, { cursor: i });
      expect(f.oam).toEqual([handCursor(24, 48 + 32 * i)]);
    }
  });
  it('regras: mão em (16, 56 + 24·i) em cada linha', () => {
    for (let i = 0; i < 6; i++) {
      const f = buildRulesScene(ASSETS!, { cursor: i });
      expect(f.oam).toEqual([handCursor(16, 56 + 24 * i)]);
    }
  });
});
