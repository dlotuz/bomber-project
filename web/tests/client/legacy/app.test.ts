import { App, type Screen } from '../../../src/app/app';
import { defaultSettings } from '../../../src/app/settings';
import { idleInput } from '../../../src/input/input';

describe('App', () => {
  const hooks = () => {
    const calls = { save: 0, keymaps: 0 };
    return { calls, h: { save: () => { calls.save++; }, setKeymaps: () => { calls.keymaps++; }, seed: () => 42 } };
  };
  it('encaminha update/draw para a tela atual e troca com go()', () => {
    const { h } = hooks();
    const app = new App(defaultSettings(), h);
    const seen: string[] = [];
    const b: Screen = { id: 'b', update: () => seen.push('b'), draw: () => {} };
    const a: Screen = { id: 'a', update: () => { seen.push('a'); app.go(b); }, draw: () => {} };
    app.go(a);
    app.update(idleInput());
    app.update(idleInput());
    expect(seen).toEqual(['a', 'b']);
    expect(app.screen.id).toBe('b');
  });
  it('contador de animação para quando a tela está congelada', () => {
    const { h } = hooks();
    const app = new App(defaultSettings(), h);
    let frozen = false;
    app.go({ id: 'x', update() {}, draw() {}, frozen: () => frozen });
    app.update(idleInput());
    frozen = true;
    app.update(idleInput());
    expect(app.frame).toBe(1);
  });
  it('save, applyKeymaps e seed usam os ganchos', () => {
    const { h, calls } = hooks();
    const app = new App(defaultSettings(), h);
    app.save(); app.applyKeymaps();
    expect(calls).toEqual({ save: 1, keymaps: 1 });
    expect(app.seed()).toBe(42);
  });
});
