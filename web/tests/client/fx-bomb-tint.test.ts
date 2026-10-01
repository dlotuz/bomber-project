import { isBombBody, tintBomb } from '../../src/render/fx/bomb-tint';

describe('cor da bomba por jogador', () => {
  it('corpo escuro (azul-marinho do fallback, azul-petróleo da ROM) é corpo; grama, contorno preto, brilho e pavio não', () => {
    expect([[52, 64, 106], [21, 26, 46], [74, 123, 123], [41, 82, 82], [24, 49, 41]].map(c => isBombBody(c[0], c[1], c[2]))).toEqual([true, true, true, true, true]);
    expect([[47, 125, 58], [82, 173, 0], [0, 0, 0], [11, 11, 20], [165, 206, 181], [255, 122, 26], [99, 0, 0]].map(c => isBombBody(c[0], c[1], c[2]))).toEqual([false, false, false, false, false, false, false]);
  });
  it('pinta só pixel de ator com cor de corpo dentro do círculo; o resto fica transparente', () => {
    const W = 20, H = 20, base = new Uint8ClampedArray(W * H * 4), actor = new Uint8ClampedArray(W * H * 4);
    const put = (x: number, y: number, c: number[], isActor: boolean) => {
      base.set([...c, 255], (y * W + x) * 4);
      actor[(y * W + x) * 4 + 3] = isActor ? 0 : 255;   // máscara de chão: 0 = coberto por ator
    };
    put(10, 10, [52, 64, 106], true);    // corpo da bomba → pinta
    put(11, 10, [0, 0, 0], true);        // contorno → não
    put(12, 10, [52, 64, 106], false);   // chão da mesma cor → não
    put(2, 2, [52, 64, 106], true);      // fora do círculo → não
    const out = tintBomb(base, actor, W, 10, 10, 0xff5f5f);
    const at = (x: number, y: number) => Array.from(out.slice(((y - 2) * 16 + (x - 2)) * 4, ((y - 2) * 16 + (x - 2)) * 4 + 4));
    expect(at(10, 10)[3]).toBe(255);
    expect(at(10, 10)[0]).toBeGreaterThan(at(10, 10)[2]);   // puxado para o vermelho do P1
    expect(at(11, 10)[3]).toBe(0);
    expect(at(12, 10)[3]).toBe(0);
    expect(at(2, 2)[3]).toBe(0);
  });
});
