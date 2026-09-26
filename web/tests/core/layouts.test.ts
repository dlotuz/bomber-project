import { LAYOUTS, STAGE_NAMES } from '../../src/core';

describe('LAYOUTS (miniaturas)', () => {
  it('10 fases de 11 × 13; fase 1 = todo soft com pilares; fase 5 sem soft; fase 3 com as casas das bolas livres', () => {
    expect(LAYOUTS.length).toBe(10);
    for (const l of LAYOUTS) { expect(l.length).toBe(11); for (const r of l) expect(r.length).toBe(13); }
    expect(LAYOUTS[0][0]).toBe('xxxxxxxxxxxxx');
    expect(LAYOUTS[0][1]).toBe('x#x#x#x#x#x#x');
    expect(LAYOUTS[4].join('').includes('x')).toBe(false);
    expect(LAYOUTS[2][4][4]).toBe('.');              // bola da fase 3: o objeto vem do init da arena (plano 8)
    expect(STAGE_NAMES.length).toBe(10);
  });
});
