import { bombMask, isBombBody, tintBodyPixels, tintBomb, tintBombsInPlace } from '../../src/render/fx/bomb-tint';

const BODY = [52, 64, 106];       // azul-marinho do corpo (fallback)
const FLOOR = [47, 125, 58];      // grama
const MOUNT = [40, 60, 90];       // parte escura da montaria: passa no teste de "corpo", mas não é bomba

/** Quadro W×H RGBA opaco preenchido com `c`. */
function frame(W: number, H: number, c: number[]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < d.length; i += 4) d.set([...c, 255], i);
  return d;
}
const put = (d: Uint8ClampedArray, W: number, x: number, y: number, c: number[]) => d.set([...c, 255], (y * W + x) * 4);
const px = (d: Uint8ClampedArray, W: number, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

describe('cor da bomba por jogador', () => {
  it('corpo escuro (azul-marinho do fallback, azul-petróleo da ROM) é corpo; grama, contorno preto, brilho e pavio não', () => {
    expect([[52, 64, 106], [21, 26, 46], [74, 123, 123], [41, 82, 82], [24, 49, 41]].map(c => isBombBody(c[0], c[1], c[2]))).toEqual([true, true, true, true, true]);
    expect([[47, 125, 58], [82, 173, 0], [0, 0, 0], [11, 11, 20], [165, 206, 181], [255, 122, 26], [99, 0, 0]].map(c => isBombBody(c[0], c[1], c[2]))).toEqual([false, false, false, false, false, false, false]);
  });

  it('pinta só pixel de bomba à vista com cor de corpo dentro do círculo; o resto fica transparente', () => {
    const W = 20, H = 20, base = new Uint8ClampedArray(W * H * 4), vis = new Uint8ClampedArray(W * H * 4);
    const set = (x: number, y: number, c: number[], visible: boolean) => {
      base.set([...c, 255], (y * W + x) * 4);
      vis[(y * W + x) * 4 + 3] = visible ? 255 : 0;
    };
    set(10, 10, BODY, true);         // corpo da bomba → pinta
    set(11, 10, [0, 0, 0], true);    // contorno → não
    set(12, 10, BODY, false);        // mesma cor, mas não é bomba à vista (chão, montaria) → não
    set(2, 2, BODY, true);           // fora do círculo → não
    const out = tintBomb(base, vis, W, 10, 10, 0xff5f5f);
    const at = (x: number, y: number) => Array.from(out.slice(((y - 2) * 16 + (x - 2)) * 4, ((y - 2) * 16 + (x - 2)) * 4 + 4));
    expect(at(10, 10)[3]).toBe(255);
    expect(at(10, 10)[0]).toBeGreaterThan(at(10, 10)[2]);   // puxado para o vermelho do P1
    expect(at(11, 10)[3]).toBe(0);
    expect(at(12, 10)[3]).toBe(0);
    expect(at(2, 2)[3]).toBe(0);
  });
});

describe('bomba por baixo de quem está na frente (oclusão)', () => {
  // Bomba 5×5 em (8..12, 8..12); a montaria cobre as linhas 10..12 (a metade de baixo) e pinta por cima com uma cor
  // escura que o teste de corpo aceitaria.
  const W = 20, H = 20;
  const noBombs = frame(W, H, FLOOR), bombsOnly = frame(W, H, FLOOR), base = frame(W, H, FLOOR);
  for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) { put(bombsOnly, W, x, y, BODY); put(base, W, x, y, y >= 10 ? MOUNT : BODY); }
  put(base, W, 15, 10, MOUNT);   // resto da montaria, fora da bomba

  it('máscara: bomba onde o "só bombas" difere do "sem bombas", à vista onde o quadro completo ainda a mostra', () => {
    const vis = new Uint8ClampedArray(W * H * 4);
    bombMask(base, bombsOnly, noBombs, vis);
    expect(px(vis, W, 10, 8)[3]).toBe(255);    // metade de cima: à vista
    expect(px(vis, W, 10, 11)[3]).toBe(0);     // coberta pela montaria
    expect(px(vis, W, 15, 10)[3]).toBe(0);     // montaria fora da bomba
    expect(px(vis, W, 2, 2)[3]).toBe(0);       // chão
  });

  it('a cor entra na base só na parte à vista: a montaria por cima continua intacta', () => {
    const vis = new Uint8ClampedArray(W * H * 4), b = Uint8ClampedArray.from(base);
    bombMask(b, bombsOnly, noBombs, vis);
    const rects = tintBombsInPlace(b, vis, W, [[10, 10, 0xe83030]]);
    expect(rects).toEqual([[2, 2]]);
    const top = px(b, W, 10, 9);
    expect(top[0]).toBeGreaterThan(top[2]);                    // corpo à vista: vermelho do P3
    for (let y = 10; y <= 12; y++) for (let x = 8; x <= 12; x++) expect(px(b, W, x, y)).toEqual([...MOUNT, 255]);
    expect(px(b, W, 15, 10)).toEqual([...MOUNT, 255]);
  });

  it('bomba toda coberta (montado em cima dela): nada é pintado', () => {
    const covered = Uint8ClampedArray.from(base);
    for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) put(covered, W, x, y, MOUNT);
    const vis = new Uint8ClampedArray(W * H * 4), b = Uint8ClampedArray.from(covered);
    bombMask(b, bombsOnly, noBombs, vis);
    tintBombsInPlace(b, vis, W, [[10, 10, 0xe83030]]);
    expect(b).toEqual(covered);
  });
});

describe('arte HD: corpo da bomba na cor do dono', () => {
  it('pinta o corpo, mantém contorno, brilho, pavio e transparência', () => {
    const d = new Uint8ClampedArray([...BODY, 255, 0, 0, 0, 255, 240, 240, 250, 255, 255, 122, 26, 255, ...BODY, 0]);
    tintBodyPixels(d, 0x3070ff);
    expect(d[2]).toBeGreaterThan(d[0]);                       // corpo azul do P4
    expect(Array.from(d.slice(4, 16))).toEqual([0, 0, 0, 255, 240, 240, 250, 255, 255, 122, 26, 255]);
    expect(Array.from(d.slice(16))).toEqual([...BODY, 0]);    // transparente fica como está
  });
});
