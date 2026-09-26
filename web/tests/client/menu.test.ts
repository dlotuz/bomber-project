import { MenuList, cycle, clamp } from '../../src/screens/menu';
import { App, type Screen } from '../../src/app/app';
import { defaultSettings } from '../../src/app/settings';
import { idleInput } from '../../src/input/input';
import { BTN } from '../../src/legacy-core';

describe('MenuList', () => {
  const make = () => {
    const log: string[] = [];
    const list = new MenuList([
      { label: 'A', disabled: true },
      { label: 'B', select: () => log.push('B'), left: () => log.push('B<'), right: () => log.push('B>') },
      { label: 'C', disabled: true },
      { label: 'D', select: () => log.push('D') },
    ]);
    return { list, log };
  };
  it('começa no primeiro item ativo e pula desativados com volta', () => {
    const { list } = make();
    expect(list.cursor).toBe(1);
    expect(list.handle(BTN.DOWN)).toBe('moved');
    expect(list.cursor).toBe(3);
    list.handle(BTN.DOWN);
    expect(list.cursor).toBe(1);
    list.handle(BTN.UP);
    expect(list.cursor).toBe(3);
  });
  it('ESQ/DIR mudam valor; A e START selecionam; B volta', () => {
    const { list, log } = make();
    expect(list.handle(BTN.LEFT)).toBe('changed');
    expect(list.handle(BTN.RIGHT)).toBe('changed');
    expect(list.handle(BTN.A)).toBe('selected');
    list.handle(BTN.DOWN);
    expect(list.handle(BTN.START)).toBe('selected');
    expect(log).toEqual(['B<', 'B>', 'B', 'D']);
    expect(list.handle(BTN.B)).toBe('back');
    expect(list.handle(0)).toBeNull();
  });
  it('cycle e clamp', () => {
    expect(cycle(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycle(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(cycle(['a', 'b', 'c'], 'x', 1)).toBe('b');
    expect([clamp(9, 1, 5), clamp(0, 1, 5), clamp(3, 1, 5)]).toEqual([5, 1, 3]);
  });
});

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
