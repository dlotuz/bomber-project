import { follower } from '../../src/render/anim/follow';

describe('ovo reserva segue o dono andando (não pula de casa)', () => {
  it('anda até a casa-alvo na velocidade do dono (mín. 1 px/tick) e para nela', () => {
    const f = follower(), key = {};
    expect(f(key, 63, 47, 0)(0, 47, 48)).toEqual({ x: 47, y: 48 });   // 1º desenho: já no alvo
    const xs: number[] = [];
    for (let t = 1; t <= 20; t++) xs.push(f(key, 63 + t, 47, t)(0, 63, 48).x);   // alvo 16 px à frente
    expect(xs.slice(0, 16)).toEqual(Array.from({ length: 16 }, (_, i) => 48 + i));
    expect(xs.at(-1)).toBe(63);
  });
  it('dono a 2 px/tick: o ovo acompanha a 2 px/tick; tick repetido (TIME UP) não anda', () => {
    const f = follower(), key = {};
    f(key, 0, 0, 0)(0, 0, 0);
    expect(f(key, 2, 0, 1)(0, 16, 0)).toEqual({ x: 2, y: 0 });
    expect(f(key, 2, 0, 1)(0, 16, 0)).toEqual({ x: 2, y: 0 });
  });
});
