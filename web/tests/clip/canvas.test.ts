import { clipLayout, CLIP_W, CLIP_H } from '../../src/clip/canvas';

describe('quadro do clipe (1280×720 fixo)', () => {
  it('HD (4:3 da TV): o jogo na altura toda, centrado, com as bordas para o fundo borrado', () => {
    expect(clipLayout({ w: 1920, h: 1440 })).toMatchObject({ w: CLIP_W, h: CLIP_H, gw: 960, gh: 720, ox: 160, oy: 0 });
  });
  it('clássico (8:7) também cabe na altura; mais largo que 16:9 cabe na largura', () => {
    expect(clipLayout({ w: 1792, h: 1568 })).toMatchObject({ gw: 823, gh: 720, ox: 228, oy: 0 });
    expect(clipLayout({ w: 2000, h: 720 })).toMatchObject({ gw: 1280, gh: 461, ox: 0, oy: 129 });
  });
  it('escala relativa à base 256×224 (para o fundo borrado)', () => {
    const L = clipLayout({ w: 1920, h: 1440 });
    expect([L.sy, L.sx]).toEqual([720 / 224, 960 / 256]);
  });
});
