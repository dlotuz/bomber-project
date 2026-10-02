import {
  fitScale, fitOptionsFor, screenFromUrl, resolveScreenKind, screenLayout, coverRect, screenModeFromUrl, resolveScreenMode, SCREEN_W, SCREEN_H, TV_ASPECT,
} from '../../src/render/display';
import { smoothFactor } from '../../src/render/fx/smooth-gl';

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
  it('modo CLÁSSICA: maior inteiro que cabe, pixel quadrado (4× no Full HD)', () => {
    const o = fitOptionsFor('classic');
    expect(o).toEqual({ fill: false, tv: false });
    expect(fitScale(1920, 1080, o)).toEqual({ sx: 4, sy: 4 });
  });
  it('atalhos de teste: ?tela=inteiro e ?proporcao=pixel afinam o HD', () => {
    expect(fitOptionsFor('hd', '?tela=inteiro&proporcao=pixel')).toEqual({ fill: false, tv: false });
    expect(fitOptionsFor('hd', '?tela=inteiro')).toEqual({ fill: false, tv: true });
    expect(fitOptionsFor('hd', '?proporcao=pixel')).toEqual({ fill: true, tv: false });
  });
  it('a URL tem prioridade sobre as Opções: ?tela=classica força o clássico, ?tela=hd força o HD', () => {
    expect(resolveScreenKind('?tela=classica', 'hd')).toBe('classic');
    expect(resolveScreenKind('?tela=hd', 'classic')).toBe('hd');
    expect(resolveScreenKind('?quick', 'classic')).toBe('classic');
    expect(fitOptionsFor('hd', '?tela=classica')).toEqual({ fill: false, tv: false });
    expect(fitOptionsFor('classic', '?tela=hd')).toEqual({ fill: true, tv: true });
    expect(screenFromUrl('')).toEqual({});
  });
  it('sem parâmetros: preencher e 4:3 ligados; nunca menor que 1×', () => {
    expect(fitOptionsFor('hd')).toEqual({ fill: true, tv: true });
    expect(fitScale(100, 100, { fill: true, tv: true })).toEqual({ sx: TV_ASPECT, sy: 1 });
  });
});

describe('janela inteira: imagem centrada e bordas', () => {
  it('Full HD: canvas 1920×1080, imagem 1440×1080 centrada (faixas de 240 px dos lados)', () => {
    expect(screenLayout(1920, 1080, { fill: true, tv: true })).toMatchObject({ w: 1920, h: 1080, gw: 1440, gh: 1080, ox: 240, oy: 0 });
  });
  it('retrato 1080×1920: imagem na largura toda, centrada na vertical', () => {
    const L = screenLayout(1080, 1920, { fill: true, tv: true });
    expect([L.w, L.h, L.gw, L.gh, L.ox]).toEqual([1080, 1920, 1080, 810, 0]);
    expect(L.oy).toBe(555);
  });
  it('CLÁSSICA: 4× (1024×896) no meio do Full HD, pixel quadrado', () => {
    expect(screenLayout(1920, 1080, fitOptionsFor('classic'))).toMatchObject({ gw: 1024, gh: 896, ox: 448, oy: 92 });
  });
  it('janela menor que a base: o canvas nunca fica menor que a imagem (1×)', () => {
    const L = screenLayout(100, 100, { fill: true, tv: false });
    expect([L.w, L.h, L.ox, L.oy]).toEqual([256, 224, 0, 0]);
  });
  it('fundo borrado: a imagem ampliada por igual cobre a tela toda, centrada', () => {
    expect(coverRect(1920, 1080, 1440, 1080)).toEqual({ x: 0, y: -180, w: 1920, h: 1440 });
    const r = coverRect(1080, 1920, 1080, 810);
    expect(r.h).toBeCloseTo(1920);
    expect(r.x + r.w / 2).toBeCloseTo(540);
    expect(r.w / r.h).toBeCloseTo(1080 / 810);
  });
  it('1920×1080: HD = 1440×1080 centrado com fundo borrado; CLÁSSICA = 1024×896 com bordas pretas', () => {
    expect(screenLayout(1920, 1080, fitOptionsFor('hd'))).toMatchObject({ gw: 1440, gh: 1080, ox: 240, oy: 0 });
    expect(resolveScreenMode({}, { screen: 'hd', smooth: false }).blur).toBe(true);
    const c = screenLayout(1920, 1080, fitOptionsFor('classic'));
    expect([c.sx, c.sy, c.gw, c.gh]).toEqual([4, 4, 1024, 896]);
    expect(resolveScreenMode({}, { screen: 'classic', smooth: false }).blur).toBe(false);
    expect(resolveScreenMode({}, { screen: 'classic', smooth: false }, resolveScreenKind('?tela=hd', 'classic')).blur).toBe(true);
  });
  it('?bordas=preto força as faixas pretas; sem o parâmetro vale a opção', () => {
    expect(screenModeFromUrl('?bordas=preto')).toEqual({ blur: false });
    expect(screenModeFromUrl('?bordas=borrado')).toEqual({ blur: true });
    expect(screenModeFromUrl('?quick')).toEqual({});
    expect(resolveScreenMode({}, { screen: 'hd', smooth: false })).toEqual({ blur: true, smooth: false });
    expect(resolveScreenMode({}, { screen: 'classic', smooth: false })).toEqual({ blur: false, smooth: false });
    expect(resolveScreenMode({ blur: false }, { screen: 'hd', smooth: false })).toEqual({ blur: false, smooth: false });
  });
  it('?filtro=suave liga o filtro suave (padrão: nítido); ?filtro=nitido força o nítido', () => {
    expect(screenModeFromUrl('?quick&filtro=suave')).toEqual({ smooth: true });
    expect(screenModeFromUrl('?filtro=nitido&bordas=preto')).toEqual({ smooth: false, blur: false });
    expect(resolveScreenMode({ smooth: true }, { screen: 'hd', smooth: false })).toEqual({ blur: true, smooth: true });
    expect(resolveScreenMode({ smooth: false }, { screen: 'hd', smooth: true }).smooth).toBe(false);
    expect(resolveScreenMode({}, { screen: 'hd', smooth: true }).smooth).toBe(true);
  });
  it('fator inteiro do filtro suave: o inteiro logo acima da escala vertical, entre 2 e 8', () => {
    expect(smoothFactor(1080 / 224)).toBe(5);   // Full HD: 1280×1120, reduzido de leve para 1440×1080
    expect(smoothFactor(4)).toBe(4);
    expect(smoothFactor(1)).toBe(2);
    expect(smoothFactor(12)).toBe(8);
  });
});
