import { fitScale, fitOptionsFromUrl, SCREEN_W, SCREEN_H, TV_ASPECT } from '../../src/render/display';

describe('tamanho da imagem na tela', () => {
  it('Full HD (1920×1080), padrão: ocupa a altura toda (escala quebrada) e alarga para 4:3 como a TV', () => {
    const { sx, sy } = fitScale(1920, 1080, { fill: true, tv: true });
    expect(SCREEN_H * sy).toBeCloseTo(1080);
    expect(SCREEN_W * sx).toBeCloseTo(1440);   // 1080 × 4/3
    expect(sx / sy).toBeCloseTo(7 / 6);
  });
  it('janela estreita: limita pela largura, mantendo o 4:3', () => {
    const { sx, sy } = fitScale(800, 1080, { fill: true, tv: true });
    expect(SCREEN_W * sx).toBeCloseTo(800);
    expect(SCREEN_H * sy).toBeCloseTo(600);
  });
  it('?tela=inteiro&proporcao=pixel volta ao comportamento antigo: maior inteiro que cabe, pixel quadrado', () => {
    const o = fitOptionsFromUrl('?tela=inteiro&proporcao=pixel');
    expect(o).toEqual({ fill: false, tv: false });
    expect(fitScale(1920, 1080, o)).toEqual({ sx: 4, sy: 4 });
  });
  it('sem parâmetros: preencher e 4:3 ligados; nunca menor que 1×', () => {
    expect(fitOptionsFromUrl('')).toEqual({ fill: true, tv: true });
    expect(fitScale(100, 100, { fill: true, tv: true })).toEqual({ sx: TV_ASPECT, sy: 1 });
  });
});
