import { handTarget, type HdText } from '../../src/render/hd-menu';

const item = (text: string, x: number, y: number, extra: Partial<HdText> = {}): HdText =>
  ({ text, x, y, size: 15, row: 16, tone: 'default', align: 'left', title: false, art: false, ...extra });

describe('mão dos menus HD aponta para a palavra da linha do cursor', () => {
  // tela de regras: mão em (16, 56 + 24·i), rótulos em x 32 e y 55 + 24·i, valores à direita
  const texts = [
    item('Configure as regras!', 128, 20, { title: true, align: 'center' }),
    ...[0, 1, 2].flatMap(i => [item(`rótulo ${i}`, 32, 55 + 24 * i), item(`valor ${i}`, 176, 55 + 24 * i)]),
  ];

  it.each([0, 1, 2])('cursor na linha %i → o rótulo dessa linha (o mais à esquerda da linha mais perto)', i => {
    expect(handTarget(texts, 16, 56 + 24 * i)?.text).toBe(`rótulo ${i}`);
  });

  it('linhas a 17 px (título): escolhe a linha certa, nunca a vizinha', () => {
    const rows = [item('BATTLE GAME', 94, 140, { art: true }), item('OPTIONS', 94, 157, { art: true })];
    expect(handTarget(rows, 78, 140)?.text).toBe('BATTLE GAME');
    expect(handTarget(rows, 78, 157)?.text).toBe('OPTIONS');
  });

  it('ignora o título e textos à esquerda da mão; sem texto a menos de meia linha → null', () => {
    expect(handTarget([item('título', 128, 52, { title: true })], 16, 48)).toBeNull();
    expect(handTarget([item('à esquerda', 4, 55)], 16, 56)).toBeNull();
    expect(handTarget([item('longe', 32, 100)], 16, 56)).toBeNull();
  });
});
