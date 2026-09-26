import { MenuList, cycle, clamp } from '../../../src/screens/menu';
import { BTN } from '../../../src/core';

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
