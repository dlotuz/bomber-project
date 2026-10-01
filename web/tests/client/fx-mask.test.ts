import { groundMask } from '../../src/render/fx/mask';

describe('groundMask', () => {
  it('opaco onde os dois quadros batem, transparente onde um sprite cobre o chão', () => {
    const chao = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 255, 1, 2, 3, 255]);
    const com = new Uint8ClampedArray([10, 20, 30, 255, 99, 20, 30, 255, 1, 2, 4, 255]);
    const out = new Uint8ClampedArray(12);
    groundMask(com, chao, out);
    expect(Array.from(out)).toEqual([0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
